import { useState } from "react";
import { api } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, RefreshCcw, Check, X, FileText, Loader2, Sparkles, Hash, Clock, FileBadge } from "lucide-react";

const NUM_QUESTIONS = 20;
const OPTIONS = ["A", "B", "C", "D"];
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
      <h2><Cpu className="panel-icon" /> 1. Evaluation</h2>
      <p className="muted">
        Runs the certified OMR/LLM scoring model on a candidate's submission, then generates a real
        zero-knowledge proof binding the pipeline, private input, and output.
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
          <span className={`status inline ${selectedStatus.ready ? "ok" : "fail"}`} style={{ margin: 0, marginTop: '22px' }}>
            {selectedStatus.ready ? <Check size={14} /> : <X size={14} />}
            {selectedStatus.ready ? "Ready" : `Missing: ${selectedStatus.missing.join(", ")}`}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {evalType === "omr" ? (
          <motion.div 
            key="omr"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="preset-row">
              <button type="button" onClick={() => setAnswers(DEMO_CORRECT_KEY)}>
                <Check size={16} /> Fill Correct
              </button>
              <button type="button" onClick={() => setAnswers(randomAnswers())}>
                <RefreshCcw size={16} /> Random
              </button>
              <button type="button" onClick={() => setAnswers(DEMO_CORRECT_KEY.map((a) => (a + 1) % 4))}>
                <X size={16} /> All Wrong
              </button>
            </div>

            <div className="answer-grid">
              {answers.map((a, i) => (
                <div key={i} className="answer-cell">
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Q{i + 1}</div>
                  <select value={a} onChange={(e) => setAnswer(i, e.target.value)}>
                    {OPTIONS.map((opt, idx) => (
                      <option key={opt} value={idx}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="llm"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: '16px', overflow: 'hidden' }}
          >
            <label>
              Candidate Text Answer
              <textarea 
                rows="4" 
                style={{ width: '100%', marginTop: '8px', fontFamily: 'var(--font-mono, monospace)', resize: 'none' }}
                value={textAnswer} 
                onChange={(e) => setTextAnswer(e.target.value)} 
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="primary" onClick={runEvaluation} disabled={loading}>
        {loading ? (
          <><Loader2 className="loader" size={20} /> Generating Proof...</>
        ) : (
          <><Sparkles size={20} /> Evaluate & Prove</>
        )}
      </button>

      {error && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="status fail">
          <X size={18} /> {error}
        </motion.div>
      )}

      {result && (
        <motion.div 
          className="result-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="status ok" style={{ marginBottom: 16 }}>
            <FileBadge size={18} /> Evaluation & ZK Proof Generated
          </div>
          <dl>
            <dt><Hash size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> ID</dt>
            <dd className="mono">{result.evaluation.evaluationId}</dd>
            
            <dt>{result.evaluation.gradeLogits ? "Claimed Grade" : "Claimed Score"}</dt>
            <dd>
              <strong style={{ color: 'var(--accent-primary)', fontSize: '1.2em' }}>
                {typeof result.evaluation.claimedScore === "number" 
                  ? `${result.evaluation.claimedScore.toFixed(2)} / 100` 
                  : result.evaluation.claimedScore}
              </strong>
              {result.evaluation.gradeLogits && 
                <div className="small muted">Logits: {JSON.stringify(result.evaluation.gradeLogits)}</div>
              }
            </dd>
            
            <dt>Model Version</dt>
            <dd>{result.evaluation.modelVersion}</dd>
            
            <dt>Model Commit</dt>
            <dd className="mono small">{result.evaluation.modelCommitment}</dd>
            
            <dt>Input Commit</dt>
            <dd className="mono small">{result.evaluation.inputCommitment}</dd>
            
            <dt><FileText size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Proof Size</dt>
            <dd>{result.evaluation.proofSizeBytes} bytes</dd>
            
            <dt><Clock size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Witness Gen</dt>
            <dd>{result.evaluation.timings_ms.witness_generation} ms</dd>
            
            <dt><Clock size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Proof Gen</dt>
            <dd>{result.evaluation.timings_ms.proof_generation} ms</dd>
            
            <dt>Audit Index</dt>
            <dd>#{result.audit.index} in batch "{batchId}"</dd>
          </dl>
        </motion.div>
      )}
    </section>
  );
}
