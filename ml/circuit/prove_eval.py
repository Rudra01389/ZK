"""CLI used by the backend to generate a real EZKL proof for one candidate
evaluation.

Usage (from Node via child_process, or directly):
    python3 prove_eval.py '{"answers": [0,2,1,3, ... 20 ints in [0,3]]}'

Prints a single JSON object to stdout:
{
  "score": 85.0,
  "input_commitment": "0x...",     # poseidon hash of the private input (hex)
  "proof_path": "...",              # where proof.json was written
  "witness_path": "...",
  "timings_ms": {"witness": .., "proof": ..},
  "proof_size_bytes": ...
}

Nothing about the raw candidate answers is written to stdout beyond what
the caller already passed in (they are only used locally to build the
witness file, which stays private / server-side).
"""
import asyncio
import inspect
import json
import os
import sys
import time
import uuid

import ezkl
import numpy as np

CIRCUIT_DIR = os.path.dirname(os.path.abspath(__file__))


async def _maybe_await(result):
    if inspect.isawaitable(result):
        return await result
    return result


def _omr_input(answers):
    sys.path.insert(0, os.path.join(CIRCUIT_DIR, "..", "model"))
    from config import NUM_OPTIONS, NUM_QUESTIONS  # noqa: E402
    from train import one_hot_answers  # noqa: E402

    if len(answers) != NUM_QUESTIONS or any(a < 0 or a >= NUM_OPTIONS for a in answers):
        raise ValueError(f"answers must be {NUM_QUESTIONS} ints in [0,{NUM_OPTIONS - 1}]")

    return one_hot_answers(np.array(answers, dtype=np.int64))


def _llm_input(answer_text):
    sys.path.insert(0, os.path.join(CIRCUIT_DIR, "..", "llm_model"))
    from tokenizer import encode_one_hot, tokenize_text  # noqa: E402

    tokens = tokenize_text(answer_text)
    return np.array(encode_one_hot(tokens), dtype=np.float32).reshape(-1)


def _label_for_class(idx):
    return ["Excellent", "Good", "Partial", "Poor"][idx]


async def run(payload):
    evaluator_type = payload.get("evaluator_type", "omr")
    artifacts_dir = os.path.join(CIRCUIT_DIR, "artifacts_llm" if evaluator_type == "llm" else "artifacts")
    compiled_path = os.path.join(artifacts_dir, "model.compiled")
    srs_path = os.path.join(artifacts_dir, "kzg.srs")
    vk_path = os.path.join(artifacts_dir, "vk.key")
    pk_path = os.path.join(artifacts_dir, "pk.key")
    proofs_dir = os.path.join(artifacts_dir, "proofs")

    if evaluator_type == "llm":
        vec = _llm_input(payload["answer_text"])
    else:
        vec = _omr_input(payload["answers"])

    os.makedirs(proofs_dir, exist_ok=True)
    run_id = uuid.uuid4().hex[:12]
    input_path = os.path.join(proofs_dir, f"input_{run_id}.json")
    witness_path = os.path.join(proofs_dir, f"witness_{run_id}.json")
    proof_path = os.path.join(proofs_dir, f"proof_{run_id}.json")

    with open(input_path, "w") as f:
        json.dump({"input_data": [vec.tolist()]}, f)

    t0 = time.time()
    witness = await _maybe_await(
        ezkl.gen_witness(input_path, compiled_path, witness_path, vk_path, srs_path)
    )
    t1 = time.time()

    ok = await _maybe_await(ezkl.prove(witness_path, compiled_path, pk_path, proof_path, srs_path))
    t2 = time.time()
    if not ok:
        raise RuntimeError("ezkl.prove returned falsy")

    with open(proof_path) as f:
        proof_json = json.load(f)

    # public instances: [input_commitment_hash..., score]
    # ezkl encodes public instances as field elements; decode the score
    # (last public output) back to float using the circuit's output scale.
    with open(os.path.join(artifacts_dir, "settings.json")) as f:
        settings = json.load(f)
    output_scale = settings["model_output_scales"][0]

    pretty_public = proof_json.get("pretty_public_inputs", {})
    rescaled_outputs = pretty_public.get("rescaled_outputs", [[]])
    output_values = [float(v) for v in rescaled_outputs[0]] if rescaled_outputs and rescaled_outputs[0] else []
    score = output_values[0] if output_values else None

    input_commitment_felts = pretty_public.get("processed_inputs", [[]])
    input_commitment = input_commitment_felts[0][0] if input_commitment_felts and input_commitment_felts[0] else None

    proof_size = os.path.getsize(proof_path)

    result = {
        "run_id": run_id,
        "score": score,
        "input_commitment": input_commitment,
        "proof_path": proof_path,
        "witness_path": witness_path,
        "input_path": input_path,
        "timings_ms": {
            "witness_generation": round((t1 - t0) * 1000, 2),
            "proof_generation": round((t2 - t1) * 1000, 2),
        },
        "proof_size_bytes": proof_size,
    }
    if evaluator_type == "llm":
        grade_idx = int(np.argmax(np.array(output_values))) if output_values else None
        result["grade_logits"] = output_values
        result["claimed_grade"] = _label_for_class(grade_idx) if grade_idx is not None else None
    print(json.dumps(result))
    return result


if __name__ == "__main__":
    payload = json.loads(sys.argv[1])
    asyncio.run(run(payload))
