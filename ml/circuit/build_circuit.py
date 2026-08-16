"""One-time "model certification" step: compiles the trained ONNX model
into an EZKL zk-SNARK circuit and runs the trusted setup, producing the
artifacts that define the certified evaluation pipeline:

  answer_scorer.onnx  -> settings.json -> model.compiled -> kzg.srs
                                                            -> vk.key + pk.key

Visibility scheme (this is the core privacy design of the project):
  - input_visibility  = "hashed"  -> the candidate's raw answers stay
        PRIVATE to the prover; only a Poseidon hash of the answers is
        exposed as a public instance, so a verifier can confirm proofs
        against a specific committed candidate input without ever
        seeing the answers themselves.
  - param_visibility  = "fixed"   -> model weights are baked directly
        into the circuit (this is what "certifies" the pipeline: the
        compiled circuit + verification key cryptographically fix the
        exact weights used).
  - output_visibility = "public"  -> the claimed score is a public
        output that the verifier reads directly from the proof.

Run once (or whenever a new model version is certified). Everything it
produces under ml/circuit/artifacts/ is the PUBLIC verification bundle;
answer_scorer.pt / .onnx source weights are not needed by the verifier.
"""
import asyncio
import inspect
import json
import os
import sys

import ezkl
import numpy as np

import sys

USE_LLM = "--llm" in sys.argv

if USE_LLM:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "llm_model"))
    from config import VOCAB_SIZE, MAX_SEQ_LEN  # type: ignore # noqa: E402
else:
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "model"))
    from config import INPUT_DIM, NUM_OPTIONS, NUM_QUESTIONS  # type: ignore # noqa: E402
    from train import generate_answer_key, one_hot_answers, synthetic_dataset  # type: ignore # noqa: E402

CIRCUIT_DIR = os.path.dirname(os.path.abspath(__file__))
if USE_LLM:
    MODEL_DIR = os.path.join(CIRCUIT_DIR, "..", "llm_model")
    ARTIFACTS_DIR = os.path.join(CIRCUIT_DIR, "artifacts_llm")
    ONNX_PATH = os.path.join(MODEL_DIR, "llm_scorer.onnx")
else:
    MODEL_DIR = os.path.join(CIRCUIT_DIR, "..", "model")
    ARTIFACTS_DIR = os.path.join(CIRCUIT_DIR, "artifacts")
    ONNX_PATH = os.path.join(MODEL_DIR, "answer_scorer.onnx")

SETTINGS_PATH = os.path.join(ARTIFACTS_DIR, "settings.json")
CALIBRATION_PATH = os.path.join(ARTIFACTS_DIR, "calibration.json")
COMPILED_PATH = os.path.join(ARTIFACTS_DIR, "model.compiled")
SRS_PATH = os.path.join(ARTIFACTS_DIR, "kzg.srs")
VK_PATH = os.path.join(ARTIFACTS_DIR, "vk.key")
PK_PATH = os.path.join(ARTIFACTS_DIR, "pk.key")


async def _maybe_await(result):
    if inspect.isawaitable(result):
        return await result
    return result


def _write_calibration_data():
    if USE_LLM:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "llm_model"))
        from train import generate_synthetic_data  # type: ignore # noqa: E402
        xs, _ = generate_synthetic_data(1)
        single = {"input_data": [xs[0].tolist()]}
    else:
        answer_key = generate_answer_key(42)
        xs, _ = synthetic_dataset(answer_key, n_samples=32, seed=99)
        single = {"input_data": [xs[0].tolist()]}
    
    with open(CALIBRATION_PATH, "w") as f:
        json.dump(single, f)


async def build():
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    run_args = ezkl.PyRunArgs()
    run_args.input_visibility = "hashed"
    run_args.output_visibility = "public"
    run_args.param_visibility = "fixed"
    run_args.input_scale = 7
    run_args.param_scale = 7

    print("[1/6] gen_settings ...")
    ok = await _maybe_await(ezkl.gen_settings(ONNX_PATH, SETTINGS_PATH, run_args))
    assert ok, "gen_settings failed"

    print("[2/6] writing calibration data ...")
    _write_calibration_data()

    print("[3/6] calibrate_settings ...")
    ok = await _maybe_await(
        ezkl.calibrate_settings(CALIBRATION_PATH, ONNX_PATH, SETTINGS_PATH, "resources")
    )
    assert ok, "calibrate_settings failed"

    print("[4/6] compile_circuit ...")
    ok = await _maybe_await(ezkl.compile_circuit(ONNX_PATH, COMPILED_PATH, SETTINGS_PATH))
    assert ok, "compile_circuit failed"

    print("[5/6] get_srs ...")
    try:
        ok = await _maybe_await(ezkl.get_srs(SETTINGS_PATH, None, SRS_PATH))
    except Exception:
        if os.path.exists(SRS_PATH):
            os.remove(SRS_PATH)
        ok = await _maybe_await(ezkl.get_srs(SETTINGS_PATH, None, SRS_PATH))
    assert ok, "get_srs failed"

    print("[6/6] setup (trusted setup: proving key + verification key) ...")
    ok = await _maybe_await(ezkl.setup(COMPILED_PATH, VK_PATH, PK_PATH, SRS_PATH))
    assert ok, "setup failed"

    print("\nCircuit build complete. Artifacts in", ARTIFACTS_DIR)
    for name in ["settings.json", "model.compiled", "kzg.srs", "vk.key", "pk.key"]:
        p = os.path.join(ARTIFACTS_DIR, name)
        size = os.path.getsize(p) if os.path.exists(p) else -1
        print(f"  {name:20s} {size:>10} bytes")


if __name__ == "__main__":
    asyncio.run(build())
