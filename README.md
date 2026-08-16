# Cryptographically Verifiable AI-Based Exam Evaluation

Hackathon MVP: a real zkML proof pipeline (EZKL / Halo2) for a small OMR
answer-scoring model, plus a hash-linked audit layer, wired into a
React/Vite dashboard through a Node/Express backend.

**Nothing here is simulated.** Proof generation and verification use the
real EZKL prover/verifier over a real compiled circuit; tampering with the
model, score, proof, candidate input, or audit record causes real
cryptographic/hash checks to fail.

## Architecture

```
React/Vite (frontend/)  --REST-->  Express (backend/)  --spawns-->  Python/EZKL (ml/)
                                          |
                                          +--> backend/data/  (evaluation records + hash-linked audit chain)
```

- `ml/model/` — trains a tiny MLP (80→16→1) on synthetic OMR data, exports to ONNX.
- `ml/circuit/` — EZKL circuit build (settings/compile/trusted-setup), model commitment, per-evaluation proof generation & verification, all as CLI scripts the backend shells out to.
- `backend/` — Express API: evaluate, verify, audit, tamper-test endpoints.
- `frontend/` — dashboard: Evaluation panel, Verification panel, 7 adversarial tamper-test buttons.

## One-time setup

```bash
# Python / ML / ZK
python3 -m venv .venv
source .venv/bin/activate
pip install ezkl onnx torch numpy

cd ml/model && python3 train.py && python3 export_onnx.py && cd ../..
cd ml/circuit && python3 build_circuit.py && python3 model_commitment.py certify omr-scorer-v1 && cd ../..
```

`build_circuit.py` takes a minute or two (trusted setup) and produces
`ml/circuit/artifacts/{settings.json, model.compiled, kzg.srs, vk.key, pk.key}`.
`pk.key` (~300MB) is gitignored — regenerate it by re-running `build_circuit.py`.

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

## Running

```bash
# Terminal 1
cd backend && npm start        # http://localhost:4000

# Terminal 2
cd frontend && npm run dev     # http://localhost:5173
```

Open http://localhost:5173. Click **"Fill all correct (demo)" → Evaluate**,
then **"Use last evaluation" → Verify Evaluation** — you should see
`✓ CRYPTOGRAPHICALLY VERIFIED`. Then run any of the 7 tamper-test buttons
(Section 3) to see real `✗ VERIFICATION FAILED` / `TAMPER DETECTED` results.

## What each tamper test actually does

| Test | Real mechanism that fails |
|---|---|
| Valid Evaluation | (baseline — everything passes) |
| Modified Model | forges the model commitment from a byte-perturbed copy of the real ONNX weights; commitment no longer matches the certified value |
| Modified Candidate Input | recomputes the Poseidon hash of a changed answer vector; doesn't match the commitment embedded in the existing proof |
| Modified Score | edits the recorded `claimedScore`; doesn't match the proof's public output |
| Modified Proof | flips a byte inside the real proof's field-element array; EZKL's Halo2 verifier rejects it (`Invalid elliptic curve point encoding`) |
| Modified Audit Record | edits a stored audit-chain record's field directly on disk without recomputing its hash; chain self-hash check fails |
| Wrong Batch | re-associates a genuinely valid evaluation with a batch that never actually contains it; audit lookup fails |

## Privacy design

- **Private:** raw candidate answers (only touch the ZK witness, never leave the server; stored server-side only in a `.private.json` companion file the public API never serves), model weights, proving key.
- **Public:** model commitment (SHA-256 over ONNX + circuit settings + compiled circuit + verification key), candidate input commitment (Poseidon hash, from the proof's public instances), claimed score (proof's public output), the proof itself, verification key, audit chain.

## Known limitations (MVP scope)

- The hash-linked audit chain detects tampering with individual stored records; it does not defend against an attacker who rewrites the *entire* subsequent chain (would need an external anchor — out of scope for this MVP).
- Model is intentionally tiny (deterministic MLP) so the full ONNX→circuit→proof pipeline stays fast enough for interactive demo use.
- Single-machine prototype: no auth, no real database, synthetic data only.
