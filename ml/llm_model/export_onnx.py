import os
import torch
from config import VOCAB_SIZE, MAX_SEQ_LEN
from train import TextScorer

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

def export():
    model = TextScorer()
    
    # Load weights if available
    weights_path = os.path.join(OUT_DIR, "llm_scorer.pt")
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path))
        print("Loaded trained weights.")
    else:
        print("Warning: llm_scorer.pt not found. Exporting untrained model.")
        
    model.eval()

    dummy_input = torch.zeros(1, MAX_SEQ_LEN * VOCAB_SIZE, dtype=torch.float32)
    onnx_path = os.path.join(OUT_DIR, "llm_scorer.onnx")

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

    print(f"Exported model to {onnx_path}")

if __name__ == "__main__":
    export()
