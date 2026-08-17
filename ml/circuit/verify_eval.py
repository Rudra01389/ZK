"""Independent proof verifier. Uses ONLY public verification artifacts:
settings.json, vk.key, kzg.srs, and the proof.json being checked. Never
touches the proving key, model weights, or any candidate answer data.

Usage:
    python3 verify_eval.py '{"proof_path": "...", "claimed_score": 85.0}'

Prints JSON:
{
  "proof_valid": true/false,
  "score_matches_proof": true/false,
  "public_score": 85.0,
  "input_commitment": "0x...",
  "timings_ms": {"verify": ..}
}
"""
import asyncio
import inspect
import json
import os
import sys
import time

import ezkl

CIRCUIT_DIR = os.path.dirname(os.path.abspath(__file__))


def _label_for_class(idx):
    return ["Excellent", "Good", "Partial", "Poor"][idx]


async def _maybe_await(result):
    if inspect.isawaitable(result):
        return await result
    return result


async def run(proof_path, claimed_score=None, expected_input_commitment=None, evaluator_type="omr", claimed_grade=None):
    artifacts_dir = os.path.join(CIRCUIT_DIR, "artifacts_llm" if evaluator_type == "llm" else "artifacts")
    settings_path = os.path.join(artifacts_dir, "settings.json")
    vk_path = os.path.join(artifacts_dir, "vk.key")
    srs_path = os.path.join(artifacts_dir, "kzg.srs")

    result = {
        "proof_valid": False,
        "score_matches_proof": None,
        "input_commitment_matches": None,
        "public_score": None,
        "public_grade": None,
        "grade_logits": None,
        "input_commitment": None,
        "timings_ms": {},
        "error": None,
    }

    if not os.path.exists(proof_path):
        result["error"] = "proof file not found"
        print(json.dumps(result))
        return result

    try:
        with open(proof_path) as f:
            proof_json = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        result["error"] = f"proof file unreadable/corrupted: {e}"
        print(json.dumps(result))
        return result

    pretty = proof_json.get("pretty_public_inputs", {})
    rescaled_outputs = pretty.get("rescaled_outputs", [[]])
    output_values = [float(v) for v in rescaled_outputs[0]] if rescaled_outputs and rescaled_outputs[0] else []
    public_score = output_values[0] if output_values else None
    public_grade = None
    if evaluator_type == "llm" and output_values:
        grade_idx = max(range(len(output_values)), key=lambda i: output_values[i])
        public_grade = _label_for_class(grade_idx)
    processed_inputs = pretty.get("processed_inputs", [[]])
    input_commitment = processed_inputs[0][0] if processed_inputs and processed_inputs[0] else None

    result["public_score"] = public_score
    result["public_grade"] = public_grade
    result["grade_logits"] = output_values if evaluator_type == "llm" else None
    result["input_commitment"] = input_commitment

    t0 = time.time()
    try:
        proof_valid = await _maybe_await(
            ezkl.verify(proof_path, settings_path, vk_path, srs_path)
        )
    except Exception as e:  # noqa: BLE001 - surface any ezkl-side failure as invalid proof
        proof_valid = False
        result["error"] = f"verification raised: {e}"
    t1 = time.time()

    result["proof_valid"] = bool(proof_valid)
    result["timings_ms"]["verify"] = round((t1 - t0) * 1000, 2)

    if evaluator_type == "llm" and claimed_grade is not None and public_grade is not None:
        result["score_matches_proof"] = claimed_grade == public_grade
    elif claimed_score is not None and public_score is not None:
        result["score_matches_proof"] = abs(float(claimed_score) - public_score) < 1e-6

    if expected_input_commitment is not None and input_commitment is not None:
        result["input_commitment_matches"] = expected_input_commitment == input_commitment

    print(json.dumps(result))
    return result


if __name__ == "__main__":
    payload = json.loads(sys.argv[1])
    asyncio.run(
        run(
            payload["proof_path"],
            payload.get("claimed_score"),
            payload.get("expected_input_commitment"),
            payload.get("evaluator_type", "omr"),
            payload.get("claimed_grade"),
        )
    )
