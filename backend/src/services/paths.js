const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const VENV_PYTHON = path.join(PROJECT_ROOT, ".venv", "bin", "python3");
const ML_CIRCUIT_DIR = path.join(PROJECT_ROOT, "ml", "circuit");
const ML_MODEL_DIR = path.join(PROJECT_ROOT, "ml", "model");
const ML_DIR = path.join(PROJECT_ROOT, "ml");
const ARTIFACTS_DIR = path.join(ML_CIRCUIT_DIR, "artifacts");
const LLM_ARTIFACTS_DIR = path.join(ML_CIRCUIT_DIR, "artifacts_llm");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const EVALUATIONS_DIR = path.join(DATA_DIR, "evaluations");
const AUDIT_DIR = path.join(DATA_DIR, "audit");

module.exports = {
  PROJECT_ROOT,
  VENV_PYTHON,
  ML_CIRCUIT_DIR,
  ML_MODEL_DIR,
  ML_DIR,
  ARTIFACTS_DIR,
  LLM_ARTIFACTS_DIR,
  DATA_DIR,
  EVALUATIONS_DIR,
  AUDIT_DIR,
};
