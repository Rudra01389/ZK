const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { loadCertification } = require("../services/certification");
const zkService = require("../services/zkService");
const { appendRecord } = require("../services/auditChain");
const { saveEvaluation, savePrivateEvaluation } = require("../services/store");
const { ARTIFACTS_DIR } = require("../services/paths");

const router = express.Router();

const NUM_QUESTIONS = 20;
const NUM_OPTIONS = 4;

function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== NUM_QUESTIONS) {
    return `answers must be an array of exactly ${NUM_QUESTIONS} integers`;
  }
  for (const a of answers) {
    if (!Number.isInteger(a) || a < 0 || a >= NUM_OPTIONS) {
      return `each answer must be an integer in [0, ${NUM_OPTIONS - 1}] (0=A,1=B,2=C,3=D)`;
    }
  }
  return null;
}

function sha256OfFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

router.post("/", async (req, res) => {
  try {
    const { candidateId, batchId, answers } = req.body || {};

    if (typeof candidateId !== "string" || !candidateId.trim()) {
      return res.status(400).json({ error: "candidateId (string) is required" });
    }
    if (typeof batchId !== "string" || !batchId.trim()) {
      return res.status(400).json({ error: "batchId (string) is required" });
    }
    const answerError = validateAnswers(answers);
    if (answerError) {
      return res.status(400).json({ error: answerError });
    }

    const certification = loadCertification();

    const proofResult = await zkService.generateProof(answers);
    if (proofResult.score === null || proofResult.score === undefined) {
      return res.status(500).json({ error: "proof generation did not produce a score" });
    }

    const proofHash = sha256OfFile(proofResult.proof_path);
    const evaluationId = proofResult.run_id;
    const timestamp = new Date().toISOString();

    const publicRecord = {
      evaluationId,
      candidateId,
      batchId,
      modelVersion: certification.model_version,
      modelCommitment: certification.commitment,
      inputCommitment: proofResult.input_commitment,
      claimedScore: proofResult.score,
      proofFile: path.relative(ARTIFACTS_DIR, proofResult.proof_path),
      proofHash,
      timings_ms: proofResult.timings_ms,
      proofSizeBytes: proofResult.proof_size_bytes,
      timestamp,
    };

    saveEvaluation(publicRecord);
    // Private companion record: raw candidate answers. Never served by any
    // public API endpoint — only used internally by the tamper-test suite
    // to demonstrate what happens if the candidate's real input diverges
    // from what the proof commits to.
    savePrivateEvaluation(evaluationId, { evaluationId, answers });

    const auditRecord = appendRecord(batchId, {
      evaluationId,
      candidateId,
      modelCommitment: certification.commitment,
      inputCommitment: proofResult.input_commitment,
      claimedScore: proofResult.score,
      proofHash,
      timestamp,
    });

    res.json({
      evaluation: publicRecord,
      audit: { index: auditRecord.index, recordHash: auditRecord.recordHash, prevHash: auditRecord.prevHash },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
