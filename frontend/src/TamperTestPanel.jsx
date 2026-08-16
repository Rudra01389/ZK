import { useState } from "react";
import { api } from "./api";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Play, Loader2, CheckCircle2, ShieldAlert, XCircle, FileWarning } from "lucide-react";

const SCENARIOS = [
  { key: "valid", label: "Valid Evaluation", expect: "VALID", icon: CheckCircle2 },
  { key: "modified-model", label: "Modified Model", expect: "INVALID", icon: ShieldAlert },
  { key: "modified-input", label: "Modified Input", expect: "INVALID", icon: FileWarning },
  { key: "modified-score", label: "Modified Score", expect: "INVALID", icon: AlertTriangle },
  { key: "modified-proof", label: "Modified Proof", expect: "INVALID", icon: AlertTriangle },
  { key: "modified-audit-record", label: "Modified Audit Record", expect: "TAMPERED", icon: AlertTriangle },
  { key: "wrong-batch", label: "Wrong Batch", expect: "INVALID", icon: XCircle },
];

export default function TamperTestPanel({ evalType }) {
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});

  const runScenario = async (key) => {
    setRunning(key);
    try {
      const data = await api.tamper(key, { evaluatorType: evalType });
      setResults((prev) => ({ ...prev, [key]: data }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [key]: { error: e.message, valid: false } }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className="panel">
      <h2><AlertTriangle className="panel-icon" style={{ color: 'var(--warning)' }} /> 3. Adversarial / Tamper Tests</h2>
      <p className="muted">
        Run real evaluations followed by cryptographic/audit re-verification against a tampered artifact. 
        Witness the zero-knowledge and audit layers reject invalid claims.
      </p>

      <div className="scenario-list">
        {SCENARIOS.map((s, index) => {
          const r = results[s.key];
          // Determine if the test "passed" based on matching expected outcome
          const pass = r && (s.expect === "VALID" ? r.valid === true : r.valid === false);
          
          return (
            <motion.div 
              className="scenario-row" 
              key={s.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="scenario-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-start' }}>
                  <s.icon size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{s.label}</strong>
                  <span className="expect" style={{ marginLeft: '4px' }}>Expects: {s.expect}</span>
                </div>
                
                <button 
                  onClick={() => runScenario(s.key)} 
                  disabled={running === s.key}
                  style={{ minWidth: '120px', flexShrink: 0, marginLeft: 'auto' }}
                >
                  {running === s.key ? (
                    <><Loader2 className="loader" size={16} /> Running</>
                  ) : (
                    <><Play size={16} /> Run Test</>
                  )}
                </button>
              </div>

              <AnimatePresence>
                {r && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--panel-border)' }}>
                      <div className={`status ${pass ? "ok" : "fail"}`} style={{ margin: 0 }}>
                        {r.error
                          ? <><XCircle size={16} /> error: {r.error}</>
                          : pass
                          ? s.expect === "VALID"
                            ? <><CheckCircle2 size={16} /> VERIFIED</>
                            : s.expect === "TAMPERED"
                            ? <><ShieldAlert size={16} /> TAMPER DETECTED (Audit Failure)</>
                            : <><ShieldAlert size={16} /> REJECTED (ZK Proof Invalid)</>
                          : s.expect === "VALID"
                          ? <><XCircle size={16} /> VERIFICATION FAILED</>
                          : <><XCircle size={16} /> UNEXPECTEDLY VALID</>}
                      </div>
                      
                      {r?.reasons?.length > 0 && (
                        <div className="reasons small">
                          <strong>Reasons:</strong>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                            {r.reasons.map((rsn, i) => <li key={i}>{rsn}</li>)}
                          </ul>
                        </div>
                      )}
                      
                      {r?.afterTamper && (
                        <div className="reasons small" style={{ color: 'var(--text-secondary)', background: 'transparent', borderLeftColor: 'var(--text-muted)' }}>
                          Audit state after tamper: {String(r.afterTamper.intact).toUpperCase()} — {r.afterTamper.reason}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
