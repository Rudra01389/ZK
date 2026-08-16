import { useEffect, useState } from "react";
import { api } from "./api";

const NUM_QUESTIONS = 20;
const OPTIONS = ["A", "B", "C", "D"];
// Demo convenience only: the certified synthetic answer key, so a judge can
// one-click a perfect score. This is training-label data for a synthetic
// demo, not real candidate or exam data.
const DEMO_CORRECT_KEY = [0, 3, 2, 1, 1, 3, 0, 2, 0, 0, 2, 3, 2, 3, 2, 3, 2, 0, 3, 1];

function randomAnswers() {
  return Array.from({ length: NUM_QUESTIONS }, () => Math.floor(Math.random() * 4));
}

export default function EvaluationPanel({ evaluatorInfo, evalType, setEvalType, onEvaluated }) {
  const [candidateId, setCandidateId] = useState("SYN-CAND-" + Math.floor(1000 + Math.random() * 9000));
  const [batchId, setBatchId] = useState("batch-2026-demo");
  const [textAnswer, setTextAnswer] = useState("Zero-knowledge proofs allow a prover to convince a verifier that a statement is true without revealing any information beyond the validity of the statement itself.");
  const [answers, setAnswers] = useState(randomAnswers());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedStatus = evaluatorInfo?.evaluators?.find((item) => item.evaluatorType === evalType)?.status;

  const setAnswer = (i, val) => {
    const next = [...answers];
    next[i] = Number(val);
    setAnswers(next);
  };

  const runEvaluation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payloadAnswers = evalType === "llm" ? textAnswer : answers;
      const data = await api.evaluate({ candidateId, batchId, evaluatorType: evalType, answers: payloadAnswers });
      setResult(data);
      onEvaluated?.(data.evaluation);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <h2>1. Evaluation</h2>
      <p className="muted">
        Runs the certified OMR answer-scoring model on a synthetic candidate's bubble sheet, then generates a real
        zero-knowledge proof binding the selected pipeline, the (private) candidate input, and the claimed output.
      </p>

      <div className="row">
        <label>
          Candidate ID
          <input value={candidateId} onChange={(e) => setCandidateId(e.target.value)} />
        </label>
        <label>
          Batch ID
          <input value={batchId} onChange={(e) => setBatchId(e.target.value)} />
        </label>
      </div>

      <div className="row">
        <label>
          Evaluator Pipeline
          <select
            value={evalType}
            onChange={(e) => setEvalType(e.target.value)}
            disabled={loading}
          >
            <option value="llm">LLM (zkLLM text)</option>
            <option value="omr">OMR (EZKL array)</option>
          </select>
        </label>
        {selectedStatus && (
          <span className={selectedStatus.ready ? "pill ok" : "pill fail"}>
            {selectedStatus.ready ? "Ready" : `Missing: ${selectedStatus.missing.join(", ")}`}
          </span>
        )}
      </div>

      {evalType === "omr" ? (
        <>
          <div className="preset-row">
            <button type="button" onClick={() => setAnswers(DEMO_CORRECT_KEY)}>Fill all correct (demo)</button>
            <button type="button" onClick={() => setAnswers(randomAnswers())}>Fill random</button>
            <button type="button" onClick={() => setAnswers(DEMO_CORRECT_KEY.map((a) => (a + 1) % 4))}>Fill all wrong</button>
          </div>

          <div className="answer-grid">
            {answers.map((a, i) => (
              <label key={i} className="answer-cell">
                Q{i + 1}
                <select value={a} onChange={(e) => setAnswer(i, e.target.value)}>
                  {OPTIONS.map((opt, idx) => (
                    <option key={opt} value={idx}>{opt}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div className="row" style={{ marginTop: '1rem' }}>
          <label>
            Candidate Text Answer
            <textarea 
              rows="4" 
              style={{ width: '100%', marginTop: '0.5rem', fontFamily: 'monospace' }}
              value={textAnswer} 
              onChange={(e) => setTextAnswer(e.target.value)} 
            />
          </label>
        </div>
      )}

      <button className="primary" onClick={runEvaluation} disabled={loading}>
        {loading ? "Evaluating + generating ZK proof..." : "Evaluate"}
      </button>

      {error && <div className="status fail">✗ {error}</div>}

      {result && (
        <div className="result-box">
          <div className="status ok">✓ Evaluation + proof generated</div>
          <dl>
            <dt>Evaluation ID</dt><dd className="mono">{result.evaluation.evaluationId}</dd>
            <dt>{result.evaluation.gradeLogits ? "Claimed Grade" : "Claimed Score"}</dt>
            <dd>
              {typeof result.evaluation.claimedScore === "number" 
                ? `${result.evaluation.claimedScore.toFixed(2)} / 100` 
                : result.evaluation.claimedScore}
              {result.evaluation.gradeLogits && 
                <div className="small muted">Logits: {JSON.stringify(result.evaluation.gradeLogits)}</div>
              }
            </dd>
            <dt>Model Version</dt><dd>{result.evaluation.modelVersion}</dd>
            <dt>Model Commitment</dt><dd className="mono small">{result.evaluation.modelCommitment}</dd>
            <dt>Candidate Input Commitment</dt><dd className="mono small">{result.evaluation.inputCommitment}</dd>
            <dt>Proof Size</dt><dd>{result.evaluation.proofSizeBytes} bytes</dd>
            <dt>Witness Generation</dt><dd>{result.evaluation.timings_ms.witness_generation} ms</dd>
            <dt>Proof Generation</dt><dd>{result.evaluation.timings_ms.proof_generation} ms</dd>
            <dt>Audit Chain Index</dt><dd>#{result.audit.index} in batch "{batchId}"</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
