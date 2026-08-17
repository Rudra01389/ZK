import json
import os

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tokenizer_config.json")
with open(CONFIG_PATH, "r") as f:
    cfg = json.load(f)

VOCAB_SIZE = cfg["vocab_size"]
MAX_SEQ_LEN = cfg["max_seq_len"]
PAD_TOKEN_ID = cfg["pad_token_id"]
HASH_SEED = cfg["hash_seed"]

EMBED_DIM = 16
NUM_CLASSES = 4
MODEL_VERSION = "2.0.0-text"
