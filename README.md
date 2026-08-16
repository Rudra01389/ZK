# CertiProof

**Cryptographically Verifiable AI-Based Exam Evaluation**

CertiProof is a full-stack, zero-knowledge machine learning (zkML) pipeline that proves an AI model accurately graded an exam without revealing the model's proprietary weights or the candidate's raw answers. 

This project integrates a real zkML proof pipeline (EZKL / Halo2) supporting both **OMR (Optical Mark Recognition) Array evaluation** and **LLM-based text evaluation**. It pairs this with a hash-linked audit layer, all wired into a beautiful, dynamic React/Vite dashboard featuring a premium glassmorphism aesthetic.

**Nothing here is simulated.** Proof generation and verification use the real EZKL prover/verifier over real compiled circuits. Tampering with the model, score, proof, candidate input, or audit record causes real cryptographic and hash checks to fail.

---

## 🏗️ Architecture

```text
React/Vite (frontend/)  --REST-->  Express (backend/)  --spawns-->  Python/EZKL (ml/)
                                          |
                                          +--> backend/data/  (evaluation records + hash-linked audit chain)
```

- `ml/model/` & `ml/llm_model/` — Trains a tiny MLP on synthetic OMR data and a deterministic hashing-trick based LLM scorer, exporting them to ONNX format.
- `ml/circuit/` — EZKL circuit build (settings, compile, trusted-setup), model commitment, and per-evaluation proof generation/verification via CLI scripts.
- `backend/` — Node/Express API serving `evaluate`, `verify`, `audit`, and `tamper` endpoints.
- `frontend/` — A stunning "Deep Tech" dashboard built with React, Vanilla CSS (glassmorphism), Framer Motion, and Lucide React. It features an Evaluation panel, Verification panel, and adversarial tamper-test controls.

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Git

### One-Time Setup (Linux / macOS)

1. **Python / ML / ZK Environment**
   ```bash
   # Create and activate virtual environment
   python3 -m venv .venv
   source .venv/bin/activate
   
   # Install dependencies
   pip install ezkl onnx torch numpy
   
   # Train OMR Model & Export
   cd ml/model && python3 train.py && python3 export_onnx.py && cd ../..
   
   # Setup ZK Circuits (Takes ~1-2 minutes for trusted setup)
   # Generates settings, compiled circuits, SRS, and keys for OMR and LLM pipelines
   cd ml/circuit 
   python3 build_circuit.py 
   python3 model_commitment.py certify omr-scorer-v1 
   cd ../..
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### One-Time Setup (Windows)

*Note: It is highly recommended to run this project in **WSL2** (Windows Subsystem for Linux) due to EZKL dependencies. If using native Windows (PowerShell), follow these steps:*

1. **Python / ML / ZK Environment**
   ```powershell
   # Create and activate virtual environment
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   
   # Install dependencies
   pip install ezkl onnx torch numpy
   
   # Train OMR Model & Export
   cd ml\model
   python train.py
   python export_onnx.py
   cd ..\..
   
   # Setup ZK Circuits
   cd ml\circuit 
   python build_circuit.py 
   python model_commitment.py certify omr-scorer-v1 
   cd ..\..
   ```

2. **Backend Setup**
   ```powershell
   cd backend
   npm install
   cd ..
   ```

3. **Frontend Setup**
   ```powershell
   cd frontend
   npm install
   cd ..
   ```

> **Note on Artifacts**: `build_circuit.py` produces files in `ml/circuit/artifacts/`. Large files like `pk.key` (~300MB) are ignored by git. You must run the setup scripts to generate them locally.

---

## 🏃 Running the Application

You will need two terminal windows. Ensure your virtual environment is active if running ML commands manually, though the backend will spawn processes automatically.

**Terminal 1 (Backend)**
```bash
cd backend
npm start
# Server runs on http://localhost:4000
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm run dev
# Dashboard runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser. 
1. Under **Evaluation**, choose between the OMR or LLM pipeline, generate an evaluation, and watch the ZK Proof generate in real-time.
2. Click **"Verify Evaluation"** to run a zero-knowledge cryptographic check.
3. Use the **Adversarial / Tamper Tests** to intentionally corrupt data (model weights, proofs, audit records) and watch the system securely catch the tampering.

---

## 🛡️ What Each Tamper Test Does

| Test | Real Mechanism That Fails |
|---|---|
| **Valid Evaluation** | (Baseline — everything passes) |
| **Modified Model** | Forges the model commitment from a byte-perturbed copy of the ONNX weights; the commitment no longer matches the certified value. |
| **Modified Input** | Recomputes the Poseidon hash of a changed answer vector; fails to match the commitment embedded in the ZK proof. |
| **Modified Score** | Edits the recorded `claimedScore`; doesn't match the proof's public output. |
| **Modified Proof** | Flips a byte inside the proof's field-element array; EZKL's Halo2 verifier rejects it (`Invalid elliptic curve point encoding`). |
| **Modified Audit Record** | Edits a stored audit-chain record directly on disk without recomputing its hash; the chain's self-hash validation fails. |
| **Wrong Batch** | Re-associates a valid evaluation with a batch that doesn't contain it; the audit lookup fails. |

---

## 🔒 Privacy & Security Design

- **Private:** Raw candidate answers (these only touch the ZK witness and never leave the server; they are stored in a `.private.json` file that the public API never serves). The model weights and proving key are also private.
- **Public:** Model commitment (SHA-256 over ONNX + circuit settings + compiled circuit + verification key), candidate input commitment (Poseidon hash from the proof's public instances), claimed score, the ZK proof itself, the verification key, and the audit chain.

## ⚠️ Known Limitations (MVP Scope)
- The hash-linked audit chain detects tampering with individual records, but does not defend against an attacker who rewrites the *entire* subsequent chain (requires an external anchor).
- Models are intentionally tiny (deterministic MLPs) to ensure the full ONNX → circuit → proof pipeline remains fast for interactive demos.
- Single-machine prototype: lacks robust auth, a production database, and uses synthetic data.
