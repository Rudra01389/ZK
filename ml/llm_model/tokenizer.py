import sys
import json
import hashlib
import re
from config import VOCAB_SIZE, MAX_SEQ_LEN, PAD_TOKEN_ID, HASH_SEED

def tokenize_text(text: str) -> list[int]:
    # Simple deterministic tokenization:
    # 1. Lowercase and strip non-alphanumeric (keep spaces)
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    words = text.split()
    
    tokens = []
    for word in words:
        # Use SHA-256 for deterministic hashing, mixed with seed
        h = hashlib.sha256(f"{HASH_SEED}:{word}".encode('utf-8')).hexdigest()
        # Convert hex to int, map to [1, VOCAB_SIZE - 1] (0 is reserved for PAD)
        token_id = (int(h, 16) % (VOCAB_SIZE - 1)) + 1
        tokens.append(token_id)
        
    # Truncate
    tokens = tokens[:MAX_SEQ_LEN]
    # Pad
    while len(tokens) < MAX_SEQ_LEN:
        tokens.append(PAD_TOKEN_ID)
        
    return tokens

def encode_one_hot(tokens: list[int]) -> list[list[float]]:
    # Returns [MAX_SEQ_LEN, VOCAB_SIZE] one-hot
    matrix = []
    for t in tokens:
        row = [0.0] * VOCAB_SIZE
        row[t] = 1.0
        matrix.append(row)
    return matrix

if __name__ == "__main__":
    # If run via CLI, parse argv[1] as raw text, output JSON one-hot array.
    if len(sys.argv) > 1:
        text = sys.argv[1]
        tokens = tokenize_text(text)
        one_hot = encode_one_hot(tokens)
        print(json.dumps(one_hot))
