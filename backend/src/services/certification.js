const fs = require("fs");
const path = require("path");
const { ARTIFACTS_DIR, LLM_ARTIFACTS_DIR } = require("./paths");
const { runPythonScript } = require("./pythonBridge");

function artifactsDirFor(evaluatorType = "omr") {
  return evaluatorType === "llm" ? LLM_ARTIFACTS_DIR : ARTIFACTS_DIR;
}

/** The one fixed, previously-certified commitment. Never recomputed on the fly. */
function loadCertification(evaluatorType = "omr") {
  const certificationPath = path.join(artifactsDirFor(evaluatorType), "certification.json");
  if (!fs.existsSync(certificationPath)) {
    const command =
      evaluatorType === "llm"
        ? "python3 ml/circuit/model_commitment.py certify llm-scorer-v1 --llm"
        : "python3 ml/circuit/model_commitment.py certify omr-scorer-v1";
    throw new Error(`${evaluatorType.toUpperCase()} model has not been certified yet. Run ${command}.`);
  }
  return JSON.parse(fs.readFileSync(certificationPath, "utf8"));
}

/** Recomputes the commitment from whatever artifacts are on disk right now. */
async function currentCommitment(evaluatorType = "omr") {
  const args = evaluatorType === "llm" ? ["--llm"] : {};
  return runPythonScript("model_commitment.py", args);
}

module.exports = { artifactsDirFor, loadCertification, currentCommitment };
