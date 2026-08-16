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
  const [evaluatorInfo, setEvaluatorInfo] = useState(null);
  const [evalType, setEvalType] = useState("omr");

  useEffect(() => {
    api.health().then(() => setApiUp(true)).catch(() => setApiUp(false));
    api.evaluator().then((info) => {
      setEvaluatorInfo(info);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.modelCommitment(evalType).then(setCommitment).catch(() => {});
  }, [evalType]);

  return (
    <div className="app">
      <header>
        <h1>CertiProof</h1>
        <p className="tagline">Cryptographically Verifiable AI-Based Exam Evaluation</p>
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
          <span className="pill">
            Pipelines: {evaluatorInfo?.evaluators?.map((item) => item.evaluatorType.toUpperCase()).join(" / ") || "OMR / LLM"}
          </span>
        </div>
      </header>

      <main>
        <EvaluationPanel evaluatorInfo={evaluatorInfo} evalType={evalType} setEvalType={setEvalType} onEvaluated={(evaluation) => setLastEvaluationId(evaluation.evaluationId)} />
        <VerificationPanel lastEvaluationId={lastEvaluationId} />
        <TamperTestPanel evalType={evalType} />
      </main>
    </div>
  );
}

export default App;
