import json
import os
import numpy as np
import torch
import torch.nn as nn
from config import VOCAB_SIZE, MAX_SEQ_LEN, EMBED_DIM, NUM_CLASSES, MODEL_VERSION
from tokenizer import tokenize_text, encode_one_hot

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
torch.manual_seed(42)

def generate_synthetic_data(n_samples: int):
    # We will generate raw text, tokenize it, and assign a grade based on keyword presence.
    excellent_phrases = ["zero knowledge proof", "cryptography", "prover and verifier", "completeness soundness zero knowledge"]
    good_phrases = ["proves truth without revealing", "secure authentication", "crypto concept"]
    partial_phrases = ["hiding data", "secret password", "math stuff"]
    poor_phrases = ["i don't know", "it is a proof", "random guess", "blockchain"]
    
    xs_onehot = []
    ys = []
    
    rng = np.random.default_rng(42)
    for _ in range(n_samples):
        grade = rng.integers(0, 4)
        if grade == 0:
            text = rng.choice(excellent_phrases) + " " + rng.choice(good_phrases)
        elif grade == 1:
            text = rng.choice(good_phrases) + " " + rng.choice(partial_phrases)
        elif grade == 2:
            text = rng.choice(partial_phrases) + " " + rng.choice(poor_phrases)
        else:
            text = rng.choice(poor_phrases)
            
        filler = ["the", "a", "is", "of", "and", "in", "to", "it"]
        words = text.split() + rng.choice(filler, size=rng.integers(0, 10)).tolist()
        rng.shuffle(words)
        final_text = " ".join(words)
        
        tokens = tokenize_text(final_text)
        one_hot = encode_one_hot(tokens)
        
        xs_onehot.append(np.array(one_hot).reshape(-1))
        ys.append(grade)
        
    return np.stack(xs_onehot).astype(np.float32), np.array(ys, dtype=np.int64)

class TextScorer(nn.Module):
    def __init__(self):
        super().__init__()
        self.embedding = nn.Linear(VOCAB_SIZE, EMBED_DIM, bias=False)
        self.fc1 = nn.Linear(EMBED_DIM, 16)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(16, NUM_CLASSES)
        
        with torch.no_grad():
            self.embedding.weight[:, 0] = 0.0

    def forward(self, x):
        x = x.view(-1, MAX_SEQ_LEN, VOCAB_SIZE)
        embedded = self.embedding(x)
        pooled = torch.sum(embedded, dim=1) * (1.0 / MAX_SEQ_LEN)
        out = self.fc2(self.relu(self.fc1(pooled)))
        return out

def train():
    print("Generating synthetic data...")
    x_train, y_train = generate_synthetic_data(4000)
    x_val, y_val = generate_synthetic_data(400)
    
    x_train_t = torch.from_numpy(x_train)
    y_train_t = torch.from_numpy(y_train)
    x_val_t = torch.from_numpy(x_val)
    y_val_t = torch.from_numpy(y_val)

    model = TextScorer()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn = nn.CrossEntropyLoss()

    print("Training model...")
    for epoch in range(100):
        model.train()
        optimizer.zero_grad()
        pred = model(x_train_t)
        loss = loss_fn(pred, y_train_t)
        loss.backward()
        
        model.embedding.weight.grad[:, 0] = 0.0
        
        optimizer.step()
        
        if epoch % 10 == 0 or epoch == 99:
            model.eval()
            with torch.no_grad():
                val_pred = model(x_val_t)
                val_loss = loss_fn(val_pred, y_val_t).item()
                val_acc = (torch.argmax(val_pred, dim=1) == y_val_t).float().mean().item()
            print(f"epoch {epoch:3d}  train_loss={loss.item():7.3f}  val_loss={val_loss:7.3f}  val_acc={val_acc:6.3f}")

    model.eval()
    torch.save(model.state_dict(), os.path.join(OUT_DIR, "llm_scorer.pt"))

    with open(os.path.join(OUT_DIR, "model_metadata.json"), "w") as f:
        json.dump(
            {
                "model_version": MODEL_VERSION,
                "architecture": f"OneHot({VOCAB_SIZE}) -> MatMul({EMBED_DIM}) -> SumPool(/{MAX_SEQ_LEN}) -> Linear(16) -> ReLU -> Linear(4)",
                "input_format": f"Flattened 1D array of shape {MAX_SEQ_LEN * VOCAB_SIZE} (one-hot)",
                "output_format": "4 float logits",
                "vocab_size": VOCAB_SIZE,
                "max_seq_len": MAX_SEQ_LEN,
                "training_samples": 4000,
                "validation_samples": 400,
            },
            f,
            indent=2,
        )

    print(f"\nSaved model weights -> {os.path.join(OUT_DIR, 'llm_scorer.pt')}")

if __name__ == "__main__":
    train()
