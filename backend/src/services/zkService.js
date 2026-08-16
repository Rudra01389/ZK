const { runPythonScript } = require("./pythonBridge");
const fs = require("fs");
const path = require("path");
const { ARTIFACTS_DIR, LLM_ARTIFACTS_DIR } = require("./paths");

const DEFAULT_EVALUATOR_TYPE = process.env.EVALUATOR_TYPE === "llm" ? "llm" : "omr";
const EVALUATOR_TYPES = ["omr", "llm"];

function normalizeEvaluatorType(evaluatorType = DEFAULT_EVALUATOR_TYPE) {
  if (!EVALUATOR_TYPES.includes(evaluatorType)) {
    throw new Error(`evaluatorType must be one of: ${EVALUATOR_TYPES.join(", ")}`);
  }
  return evaluatorType;
}

function artifactsDirFor(evaluatorType) {
  return normalizeEvaluatorType(evaluatorType) === "llm" ? LLM_ARTIFACTS_DIR : ARTIFACTS_DIR;
}

function artifactStatus(evaluatorType) {
  const type = normalizeEvaluatorType(evaluatorType);
  const dir = artifactsDirFor(type);
  const required =
    type === "llm"
      ? ["settings.json", "model.compiled", "kzg.srs", "vk.key", "pk.key", "certification.json"]
      : ["settings.json", "model.compiled", "kzg.srs", "vk.key", "pk.key", "certification.json"];
  const missing = required.filter((name) => !fs.existsSync(path.join(dir, name)));

  return {
    evaluatorType: type,
    artifactsDir: dir,
    ready: missing.length === 0,
    missing,
  };
}

function assertReady(evaluatorType) {
  const status = artifactStatus(evaluatorType);
  if (!status.ready) {
    throw new Error(
      `${status.evaluatorType.toUpperCase()} pipeline setup is incomplete. Missing ${status.missing.join(", ")} in ${status.artifactsDir}.`
    );
  }
}

/** Generates a proof. Payload depends on evaluatorType. */
function generateProof(payload, evaluatorType = DEFAULT_EVALUATOR_TYPE) {
  const type = normalizeEvaluatorType(evaluatorType);
  assertReady(type);
  if (type === "llm") {
    return runPythonScript(
      "prove_eval.py",
      { evaluator_type: "llm", question: payload.question, answer_text: payload.answerText },
      { timeoutMs: 300000 }
    );
  }
  return runPythonScript("prove_eval.py", { answers: payload.answers }, { timeoutMs: 60000 });
}

/** Independently verifies a proof using only public artifacts. */
function verifyProof(payload, evaluatorType = DEFAULT_EVALUATOR_TYPE) {
  const type = normalizeEvaluatorType(evaluatorType);
  assertReady(type);
  return runPythonScript(
    "verify_eval.py",
    {
      evaluator_type: type,
      proof_path: payload.proofPath,
      claimed_score: payload.claimedScore,
      claimed_grade: payload.claimedGrade,
      expected_input_commitment: payload.expectedInputCommitment,
    },
    { timeoutMs: type === "llm" ? 300000 : 30000 }
  );
}

/** Computes what the input commitment WOULD be. */
function computeInputCommitment(payload, evaluatorType = DEFAULT_EVALUATOR_TYPE) {
  const type = normalizeEvaluatorType(evaluatorType);
  if (type === "llm") {
    return runPythonScript(
      "input_commitment.py",
      { evaluator_type: "llm", answer_text: payload.answerText },
      { timeoutMs: 30000 }
    );
  }
  return runPythonScript("input_commitment.py", { answers: payload.answers }, { timeoutMs: 30000 });
}

module.exports = {
  artifactStatus,
  computeInputCommitment,
  DEFAULT_EVALUATOR_TYPE,
  EVALUATOR_TYPES,
  generateProof,
  normalizeEvaluatorType,
  verifyProof,
};
