import { useEffect, useState } from "react";
import { api } from "./api";
import EvaluationPanel from "./EvaluationPanel";
import VerificationPanel from "./VerificationPanel";
import TamperTestPanel from "./TamperTestPanel";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, XCircle, ShieldCheck, Box } from "lucide-react";
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <div className="app">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>CertiProof</h1>
        <p className="tagline">Cryptographically Verifiable AI-Based Exam Evaluation</p>
        <p className="muted" style={{ fontSize: '1.15rem', lineHeight: '1.6', opacity: 0.95, maxWidth: '750px', margin: '0 auto' }}>
          Zero-knowledge proof layer (EZKL / Halo2) proves the certified model produced the claimed score, without
          revealing model weights or the candidate's raw answers.
        </p>
        
        <div className="status-strip">
          <div className={apiUp ? "pill ok" : "pill fail"}>
            {apiUp ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {apiUp ? "Backend Online" : "Backend Offline"}
          </div>
          
          {commitment && (
            <div className="pill">
              <ShieldCheck size={16} className="panel-icon" />
              Certified Model: {commitment.model_version} 
              <span className="mono" style={{ opacity: 0.7, marginLeft: 4 }}>
                ({commitment.commitment.slice(0, 12)}...)
              </span>
            </div>
          )}
          
          <div className="pill">
            <Box size={16} className="panel-icon" />
            Pipelines: {evaluatorInfo?.evaluators?.map((item) => item.evaluatorType.toUpperCase()).join(" / ") || "OMR / LLM"}
          </div>
        </div>
      </motion.header>

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <EvaluationPanel evaluatorInfo={evaluatorInfo} evalType={evalType} setEvalType={setEvalType} onEvaluated={(evaluation) => setLastEvaluationId(evaluation.evaluationId)} />
        </motion.div>
        
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <VerificationPanel lastEvaluationId={lastEvaluationId} />
          <TamperTestPanel evalType={evalType} />
        </motion.div>
      </motion.main>
    </div>
  );
}

export default App;
