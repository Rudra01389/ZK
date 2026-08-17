"""Lightweight helper: computes the Poseidon input commitment EZKL would
embed as a public instance for a given candidate answer vector, WITHOUT
running the expensive proving step (only gen_witness, ~tens of ms).

Used by the audit/tamper-test layer to check "if the candidate's answers
were actually X, would that match the commitment baked into this specific
proof?" — this is how Test 3 (Modified Candidate Input) is verified for
real, using the same cryptographic hash EZKL uses internally, not a
reimplementation.

Usage:
    python3 input_commitment.py '{"answers": [0,2,1,...]}'
Prints: {"input_commitment": "0x..."}
"""
import asyncio
import inspect
import json
import os
import sys
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


async def run(payload):
    evaluator_type = payload.get("evaluator_type", "omr")
    artifacts_dir = os.path.join(CIRCUIT_DIR, "artifacts_llm" if evaluator_type == "llm" else "artifacts")
    compiled_path = os.path.join(artifacts_dir, "model.compiled")
    srs_path = os.path.join(artifacts_dir, "kzg.srs")
    vk_path = os.path.join(artifacts_dir, "vk.key")
    tmp_dir = os.path.join(artifacts_dir, "tmp")

    if evaluator_type == "llm":
        vec = _llm_input(payload["answer_text"])
    else:
        vec = _omr_input(payload["answers"])

    os.makedirs(tmp_dir, exist_ok=True)
    tag = uuid.uuid4().hex[:12]
    input_path = os.path.join(tmp_dir, f"input_{tag}.json")
    witness_path = os.path.join(tmp_dir, f"witness_{tag}.json")

    with open(input_path, "w") as f:
        json.dump({"input_data": [vec.tolist()]}, f)

    witness = await _maybe_await(
        ezkl.gen_witness(input_path, compiled_path, witness_path, vk_path, srs_path)
    )

    with open(witness_path) as f:
        witness_json = json.load(f)
    commitment = witness_json["pretty_elements"]["processed_inputs"][0][0]
    score = float(witness_json["pretty_elements"]["rescaled_outputs"][0][0])

    for p in (input_path, witness_path):
        try:
            os.remove(p)
        except OSError:
            pass

    result = {"input_commitment": commitment, "score": score}
    print(json.dumps(result))
    return result


if __name__ == "__main__":
    payload = json.loads(sys.argv[1])
    asyncio.run(run(payload))
