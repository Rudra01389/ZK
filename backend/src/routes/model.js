const express = require("express");
const { loadCertification } = require("../services/certification");
const { listEvaluations } = require("../services/store");
const zkService = require("../services/zkService");

const router = express.Router();

router.get("/evaluator", (req, res) => {
  res.json({
    defaultEvaluatorType: zkService.DEFAULT_EVALUATOR_TYPE,
    evaluators: zkService.EVALUATOR_TYPES.map((type) => ({
      evaluatorType: type,
      answersSchema: type === "llm" ? "non-empty string" : "array of exactly 20 integers in [0, 3]",
      status: zkService.artifactStatus(type),
    })),
  });
});

// Public certification record: commitment + component hashes. This never
// exposes model weights or the proving key — only hashes of the artifacts.
router.get("/commitment", (req, res) => {
  try {
    const evaluatorType = zkService.normalizeEvaluatorType(req.query.evaluatorType || zkService.DEFAULT_EVALUATOR_TYPE);
    res.json({ evaluatorType, ...loadCertification(evaluatorType) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get("/evaluations", (req, res) => {
  const evals = listEvaluations().map(({ evaluationId, evaluatorType, candidateId, batchId, claimedScore, modelCommitment, timestamp }) => ({
    evaluationId,
    evaluatorType,
    candidateId,
    batchId,
    claimedScore,
    modelCommitment,
    timestamp,
  }));
  res.json({ evaluations: evals });
});

module.exports = router;
