const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { artifactsDirFor, loadCertification } = require("../services/certification");
const zkService = require("../services/zkService");
const { appendRecord } = require("../services/auditChain");
const { saveEvaluation, savePrivateEvaluation } = require("../services/store");

const router = express.Router();

const NUM_QUESTIONS = 20;
const NUM_OPTIONS = 4;

function evaluatorSchema(evaluatorType) {
  if (evaluatorType === "llm") {
    return {
      evaluatorType: "llm",
      answers: "non-empty string",
      example: {
        candidateId: "SYN-CAND-1001",
        batchId: "batch-2026-demo",
        answers: "Zero-knowledge proofs let a prover show correctness without revealing private inputs.",
        question: "Describe the significance of zero-knowledge proofs.",
      },
    };
  }

  return {
    evaluatorType: "omr",
    answers: `array of exactly ${NUM_QUESTIONS} integers in [0, ${NUM_OPTIONS - 1}]`,
    example: {
      candidateId: "SYN-CAND-1001",
      batchId: "batch-2026-demo",
      answers: [0, 3, 2, 1, 1, 3, 0, 2, 0, 0, 2, 3, 2, 3, 2, 3, 2, 0, 3, 1],
    },
  };
}

function validateAnswers(answers, evaluatorType) {
  if (evaluatorType === "llm") {
    if (typeof answers !== "string" || !answers.trim()) {
      return "LLM evaluation requires answers to be a non-empty string.";
    }
    return null;
  }
  if (!Array.isArray(answers) || answers.length !== NUM_QUESTIONS) {
    return `OMR evaluation requires answers to be an array of exactly ${NUM_QUESTIONS} integers.`;
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

router.get("/", (req, res) => {
  res.json({
    message: "POST JSON to this endpoint to create an evaluation.",
    defaultEvaluatorType: zkService.DEFAULT_EVALUATOR_TYPE,
    evaluators: zkService.EVALUATOR_TYPES.map((type) => ({
      ...evaluatorSchema(type),
      status: zkService.artifactStatus(type),
    })),
  });
});

router.post("/", async (req, res) => {
  try {
    const {
      candidateId,
      batchId,
      answers,
      evaluatorType: rawEvaluatorType,
      question = "Describe the significance of zero-knowledge proofs.",
    } = req.body || {};
    const evaluatorType = zkService.normalizeEvaluatorType(rawEvaluatorType || zkService.DEFAULT_EVALUATOR_TYPE);

    if (typeof candidateId !== "string" || !candidateId.trim()) {
      return res.status(400).json({ error: "candidateId (string) is required" });
    }
    if (typeof batchId !== "string" || !batchId.trim()) {
      return res.status(400).json({ error: "batchId (string) is required" });
    }
    const answerError = validateAnswers(answers, evaluatorType);
    if (answerError) {
      return res.status(400).json({ error: answerError });
    }

    const certification = loadCertification(evaluatorType);

    let proofResult;
    let inputCommitment;
    let evaluationId = crypto.randomUUID();

    if (evaluatorType === "llm") {
      const commitRes = await zkService.computeInputCommitment({ answerText: answers }, evaluatorType);
      inputCommitment = commitRes.input_commitment;
      proofResult = await zkService.generateProof({ question, answerText: answers }, evaluatorType);
      if (!proofResult.claimed_grade) {
        return res.status(500).json({ error: "proof generation did not produce a grade" });
      }
    } else {
      proofResult = await zkService.generateProof({ answers }, evaluatorType);
      if (proofResult.score === null || proofResult.score === undefined) {
        return res.status(500).json({ error: "proof generation did not produce a score" });
      }
      inputCommitment = proofResult.input_commitment;
      evaluationId = proofResult.run_id;
    }

    const proofHash = sha256OfFile(proofResult.proof_path);
    const timestamp = new Date().toISOString();
    const artifactsDir = artifactsDirFor(evaluatorType);

    const publicRecord = {
      evaluationId,
      evaluatorType,
      candidateId,
      batchId,
      modelVersion: certification.model_version,
      modelCommitment: certification.commitment,
      inputCommitment: inputCommitment,
      claimedScore: evaluatorType === "llm" ? proofResult.claimed_grade : proofResult.score,
      gradeLogits: proofResult.grade_logits,
      proofFile: path.relative(artifactsDir, proofResult.proof_path),
      publicOutputsPath: proofResult.public_outputs_path ? path.relative(artifactsDir, proofResult.public_outputs_path) : undefined,
      proofHash,
      timings_ms: proofResult.timings_ms || 0,
      proofSizeBytes: proofResult.proof_size_bytes || 0,
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
      evaluatorType,
      candidateId,
      modelCommitment: certification.commitment,
      inputCommitment: inputCommitment,
      claimedScore: publicRecord.claimedScore,
      gradeLogits: publicRecord.gradeLogits,
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
