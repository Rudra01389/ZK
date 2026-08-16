import os
import time
import json
import torch
import torch.nn as nn
import ezkl

# Parameters
VOCAB_SIZE = 512
MAX_SEQ_LEN = 128
EMBED_DIM = 16
NUM_CLASSES = 4

class DummyTextScorer(nn.Module):
    def __init__(self):
        super().__init__()
        # Expected input: [1, MAX_SEQ_LEN, VOCAB_SIZE] one-hot encoded
        self.embedding = nn.Linear(VOCAB_SIZE, EMBED_DIM, bias=False)
        self.fc1 = nn.Linear(EMBED_DIM, 16)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(16, NUM_CLASSES)

    def forward(self, x):
        # x is [batch, max_seq_len * vocab_size]
        x = x.view(-1, MAX_SEQ_LEN, VOCAB_SIZE)
        # Matmul embedding
        embedded = self.embedding(x) # [batch, seq_len, embed_dim]
        # Sum pooling
        pooled = torch.sum(embedded, dim=1) * (1.0 / MAX_SEQ_LEN) # [batch, embed_dim]
        # MLP
        out = self.fc2(self.relu(self.fc1(pooled))) # [batch, num_classes]
        return out

async def _maybe_await(result):
    import inspect
    if inspect.isawaitable(result):
        return await result
    return result

async def run_benchmark():
    model = DummyTextScorer()
    model.eval()

    dummy_input = torch.zeros(1, MAX_SEQ_LEN * VOCAB_SIZE, dtype=torch.float32)
    onnx_path = "dummy_model.onnx"

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["input"],
        output_names=["logits"],
        opset_version=13,
        dynamic_axes=None,
        dynamo=False,
    )

    print("Model exported to ONNX")

    # Generate dummy input json
    input_data = dummy_input.numpy().tolist()
    input_json_path = "dummy_input.json"
    with open(input_json_path, "w") as f:
        json.dump({"input_data": input_data}, f, indent=2)

    # Setup EZKL
    settings_path = "dummy_settings.json"
    await _maybe_await(ezkl.gen_settings(onnx_path, settings_path))
    
    print("Calibrating settings...")
    await _maybe_await(ezkl.calibrate_settings(input_json_path, onnx_path, settings_path, "resources"))

    compiled_model_path = "dummy.compiled"
    print("Compiling circuit...")
    t0 = time.time()
    await _maybe_await(ezkl.compile_circuit(onnx_path, compiled_model_path, settings_path))
    t1 = time.time()
    print(f"Compilation time: {t1 - t0:.2f} s")

    srs_path = "dummy.srs"
    print("Generating SRS...")
    await _maybe_await(ezkl.get_srs(settings_path, None, srs_path))

    vk_path = "dummy.vk"
    pk_path = "dummy.pk"
    print("Running setup...")
    t2 = time.time()
    await _maybe_await(ezkl.setup(compiled_model_path, vk_path, pk_path, srs_path))
    t3 = time.time()
    print(f"Setup time: {t3 - t2:.2f} s")

    witness_path = "dummy_witness.json"
    print("Generating witness...")
    t4 = time.time()
    await _maybe_await(ezkl.gen_witness(input_json_path, compiled_model_path, witness_path, vk_path, srs_path))
    t5 = time.time()
    print(f"Witness time: {t5 - t4:.2f} s")

    proof_path = "dummy_proof.json"
    print("Generating proof...")
    t6 = time.time()
    res = await _maybe_await(ezkl.prove(witness_path, compiled_model_path, pk_path, proof_path, srs_path))
    t7 = time.time()
    print(f"Proving time: {t7 - t6:.2f} s")
    print(f"Proof generated: {res}")
    
    proof_size = os.path.getsize(proof_path)
    print(f"Proof size: {proof_size / 1024:.2f} KB")

if __name__ == "__main__":
    import asyncio
    asyncio.run(run_benchmark())
