import { useEffect, useState } from "react";
import { api } from "./api";
import EvaluationPanel from "./EvaluationPanel";
import VerificationPanel from "./VerificationPanel";
import TamperTestPanel from "./TamperTestPanel";
import "./App.css";

function App() {
  const [commitment, setCommitment] = useState(null);
  const [lastEvaluationId, setLastEvaluationId] = useState(null);
  const [apiUp, setApiUp] = useState(null);

  useEffect(() => {
    api.health().then(() => setApiUp(true)).catch(() => setApiUp(false));
    api.modelCommitment().then(setCommitment).catch(() => {});
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Cryptographically Verifiable AI-Based Exam Evaluation</h1>
        <p className="muted">
          Zero-knowledge proof layer (EZKL / Halo2) proves the certified model produced the claimed score, without
          revealing model weights or the candidate's raw answers. A separate hash-linked audit layer detects
          tampering with stored evaluation records. These are two distinct mechanisms — a valid audit hash is not a
          substitute for a valid ZK proof, and vice versa.
        </p>
        <div className="status-strip">
          <span className={apiUp ? "pill ok" : "pill fail"}>{apiUp ? "Backend online" : "Backend offline"}</span>
          {commitment && (
            <span className="pill">
              Certified model: {commitment.model_version} · <span className="mono">{commitment.commitment.slice(0, 20)}...</span>
            </span>
          )}
        </div>
      </header>

      <main>
        <EvaluationPanel onEvaluated={(evaluation) => setLastEvaluationId(evaluation.evaluationId)} />
        <VerificationPanel lastEvaluationId={lastEvaluationId} />
        <TamperTestPanel />
      </main>
    </div>
  );
}

export default App;
