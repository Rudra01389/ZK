import { useState } from "react";
import { api } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Search, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

const CHECK_LABELS = {
  modelCommitment: "Model Commitment Verified",
  proofFileIntact: "Proof File Integrity",
  proofValid: "Zero-Knowledge Proof Valid",
  scoreValid: "Claimed Score Matches",
  inputCommitmentValid: "Input Commitment Verified",
  auditIntact: "Audit Chain Cryptographically Intact",
  auditRecordPresent: "Record Present in Audit Hash",
};

export default function VerificationPanel({ lastEvaluationId }) {
  const [evaluationId, setEvaluationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runVerify = async (id) => {
    const targetId = id || evaluationId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.verify(targetId);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1, 
      x: 0,
      transition: { delay: i * 0.15, type: "spring", stiffness: 100 }
    })
  };

  return (
    <section className="panel">
      <h2><Shield className="panel-icon" /> 2. Verification</h2>
      <p className="muted">
        Verifies an evaluation using only public artifacts — never
        the model's private weights or the candidate's raw answers.
      </p>

      <div className="row">
        <label>
          Evaluation ID
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              style={{ flex: 1 }}
              value={evaluationId} 
              onChange={(e) => setEvaluationId(e.target.value)} 
              placeholder="e.g. eval_123456" 
            />
            {lastEvaluationId && (
              <button 
                type="button" 
                onClick={() => { setEvaluationId(lastEvaluationId); runVerify(lastEvaluationId); }}
                title="Use last generated evaluation"
                style={{ padding: '10px' }}
              >
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </label>
      </div>

      <button className="primary" onClick={() => runVerify()} disabled={loading || !evaluationId}>
        {loading ? (
          <><Loader2 className="loader" size={20} /> Verifying...</>
        ) : (
          <><Search size={20} /> Verify Evaluation</>
        )}
      </button>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="status fail">
            <XCircle size={18} /> {error}
          </motion.div>
        )}

        {result && (
          <motion.div 
            className="result-box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className={`status ${result.valid ? "ok" : "fail"}`}
              style={{ justifyContent: 'center', fontSize: '1.1rem', marginBottom: '24px' }}
            >
              {result.valid ? (
                <><CheckCircle2 size={24} /> CRYPTOGRAPHICALLY VERIFIED</>
              ) : (
                <><XCircle size={24} /> VERIFICATION FAILED</>
              )}
            </motion.div>

            <ul className="check-list">
              {Object.entries(result.checks).map(([key, ok], index) => (
                <motion.li 
                  key={key} 
                  custom={index}
                  variants={checkVariants}
                  initial="hidden"
                  animate="visible"
                  className={ok ? "ok" : "fail"}
                >
                  {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />} 
                  {CHECK_LABELS[key] || key}
                </motion.li>
              ))}
            </ul>

            {result.reasons?.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 1 }}
                className="reasons"
              >
                {result.reasons.map((r, i) => <div key={i}>Alert: {r}</div>)}
              </motion.div>
            )}

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <dt>Claimed Score</dt>
              <dd>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {result.claimedScore?.toFixed?.(2) ?? result.claimedScore}
                </strong>
              </dd>
              
              <dt>ZK Verify Time</dt>
              <dd>{result.zkTimingsMs?.verify ?? "n/a"} ms</dd>
              
              <dt>Audit Chain Length</dt>
              <dd>{result.auditValidationSummary?.length}</dd>
              
              <dt>Batch Root Hash</dt>
              <dd className="mono small">{result.auditValidationSummary?.batchRootHash}</dd>
            </motion.dl>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
