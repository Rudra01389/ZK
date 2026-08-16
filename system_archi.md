# CertiProof: System Architecture

This document details the end-to-end architecture, technology stack, data flows, and cryptographic mechanisms underlying the **CertiProof** system—a cryptographically verifiable AI-based exam evaluation platform.

## 1. What and Why?

**What it is:** CertiProof is a system demonstrating how Zero-Knowledge Machine Learning (zkML) guarantees that a specific, certified AI model was used to grade a candidate's input. It supports a dual-evaluator architecture:
1. **OMR Evaluator (EZKL):** Evaluates multiple-choice bubble sheets using a small Multi-Layer Perceptron (MLP).
2. **LLM Evaluator (zkLLM):** Evaluates descriptive text answers using a zero-shot OPT-125M Language Model with a predefined rubric.

**Why it matters:** In traditional automated grading systems, candidates must blindly trust the centralized server. CertiProof solves this by using zk-SNARKs and an immutable hash-linked audit chain. It guarantees computational integrity: any tampering with the model, the candidate's input, the output score/grade, the proof itself, or the audit record will mathematically fail verification.

---

## 2. Technology Stack

The project is divided into three main components:

1. **Machine Learning & ZK Circuit (`ml/`)**
   - **Python 3:** The primary language for ML and ZK tooling.
   - **LLM Evaluator (zkLLM):** Uses HuggingFace `transformers` to load OPT-125M and calculate logits over a strict 4-tier grading rubric ("Excellent", "Good", "Partial", "Poor"). It interfaces with custom CUDA scripts from zkLLM (CCS 2024) to generate ZK proofs of the LLM's forward pass.
   - **OMR Evaluator (EZKL/Halo2):** Uses PyTorch and ONNX to compile a small MLP into a ZK circuit and generate proofs.
   - **Input Privacy:** Uses salted SHA-256 hashing for descriptive text answers to prevent raw inputs from appearing in public proofs.

2. **Backend Services (`backend/`)**
   - **Node.js & Express:** Provides the RESTful API for the frontend.
   - **Subprocess Execution & Routing:** Acts as an orchestrator. An `EVALUATOR_TYPE` environment variable dynamically routes incoming grading requests to either the zkLLM Python scripts or the EZKL Python scripts.
   - **Local File Storage:** Acts as a mock database, storing evaluation records, ZK proofs, public inputs/outputs, and the hash-linked audit chain (`backend/data/`).

3. **Frontend Dashboard (`frontend/`)**
   - **React & Vite:** A fast, modern SPA for the user interface.
   - **Dynamic UI:** Switches between a 20-question multiple-choice grid (for OMR) and a descriptive text area (for LLM) based on the active evaluator mode.
   - Provides panels for Evaluation, Verification, and interactive Tamper Tests to demonstrate cryptographic security.

---

## 3. System Architecture & Components

```text
+-------------------+       REST API       +--------------------+       Subprocess       +-----------------------+
|                   |  (Evaluate, Verify,  |                    |  (Generate Proof,      |                       |
|  React/Vite SPA   | -------------------> |   Node/Express API | ---------------------> | Python Scripts (ml/)  |
|   (frontend/)     | <------------------- |     (backend/)     | <--------------------- |  [zkLLM or EZKL mode] |
|                   |       JSON Res       |    EVALUATOR_TYPE  |    Proof/Verify Res    |                       |
+-------------------+                      +--------------------+                        +-----------------------+
                                                     |
                                                     | File I/O
                                                     v
                                           +--------------------+
                                           |                    |
                                           |    backend/data/   |
                                           | (Records & Audit)  |
                                           |                    |
                                           +--------------------+
```

### 3.1. The ML / ZK Layer (`ml/`)
- **LLM Evaluator (`zkllm_*.py` & `hash_input.py`):** Wraps the OPT-125M inference, creates salted input hashes, constructs grading prompts using `prompt_template.txt`, and interfaces with local zkLLM CUDA binaries for proving/verifying.
- **OMR Evaluator (`model/` & `circuit/`):** Retained as a functional fallback, handling synthetic OMR data generation, PyTorch training, and EZKL circuit compilation.

### 3.2. The Backend Layer (`backend/`)
- Manages the state of the system and dynamic routing.
- Maintains a **Hash-Linked Audit Chain**: Every evaluation is appended to a local chain where each record contains the hash of the previous record, ensuring chronological immutability.
- Separates public data (proofs, ZK commitments, grades/logits) from private data (raw candidate answers, which are stored in `.private.json` files and never exposed to the public API).

---

## 4. End-to-End Data Flows

### Flow A: One-Time Setup & Certification
1. **LLM Certificaton:** `certify_model.py` generates a commitment representing the OPT-125M weights, the strict prompt template, and the grade tokens.
2. **OMR Certification:** EZKL compiles the ONNX file into a verifiable circuit and generates a commitment hash.

### Flow B: Evaluation (Grading & Proof Generation)
1. **Submission:** Frontend sends raw answers (text or OMR array) to the Backend.
2. **Execution:** Backend saves the raw answers privately. If `EVALUATOR_TYPE=llm`, it generates a salted SHA-256 hash of the text and calls `zkllm_prove.py`. If `EVALUATOR_TYPE=omr`, it calls the EZKL prover.
3. **Proving:** The respective ZK system runs the input through the model, generating the predicted grade/score and a zk-SNARK proof demonstrating computational integrity.
4. **Storage & Audit:** Backend stores the proof, public outputs, and input hashes, and appends them to the immutable Audit Chain.
5. **Response:** Backend returns the evaluation ID, score/grade, and proof to the Frontend.

### Flow C: Verification
1. **Request:** Frontend requests verification for an evaluation ID.
2. **Audit Check:** Backend reads the audit chain, recomputes the hashes, and ensures the record has not been altered on disk.
3. **Cryptographic Check:** Backend calls the relevant verifier (`zkllm_verify.py` or EZKL verifier), passing the stored Proof, Public Instances, and Verification Keys.
4. **Result:** If the proof mathematically aligns with the verification key and public instances, the verifier returns true.

---

## 5. Security and Tamper Mechanisms

The system is designed to fail cryptographically if any component is tampered with:

| Component Tampered | What Happens Internally | Detection Mechanism |
| :--- | :--- | :--- |
| **Model Weights** | The ONNX file or OPT model is altered. | The newly generated model commitment will not match the certified commitment stored during Setup. Verification fails. |
| **Candidate Input** | The raw answers are changed after the fact. | The recomputed input hash (Poseidon or SHA-256) will not match the commitment embedded in the public record. Verification fails. |
| **Claimed Score/Grade** | The score is artificially inflated. | The claimed score will not match the output embedded in the ZK Proof's public instances. Verification fails. |
| **ZK Proof** | The byte-array of the proof is altered. | The verifier performs elliptic curve checks. Modified bytes result in an invalid curve point. Verification fails immediately. |
| **Audit Record** | Data on disk is altered directly. | The hash of the modified record will not match the hash stored in the subsequent record in the chain. Audit chain self-check fails. |

## 6. Privacy Design

The architecture enforces a strict boundary between public verifiable data and private sensitive data.

- **Private (Never exposed publicly):** 
  - Raw candidate answers (stored in `.private.json`). 
  - The actual model weights.
  - The secret salt used to hash descriptive text answers.
- **Public (Verifiable by anyone):** 
  - Model commitment hash.
  - Candidate input commitments (Salted SHA-256 for LLM, Poseidon hash for OMR).
  - The final claimed score or grading logits.
  - The zk-SNARK proof.
  - The Audit chain records.

This ensures that third parties can verify the integrity and fairness of the grading process without ever seeing the candidate's actual test answers or stealing the proprietary AI models.
