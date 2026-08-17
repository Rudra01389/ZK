import hashlib
import json
import sys

# In a real production system, this salt would be loaded securely from an environment variable
# and kept strictly secret from the public.
SALT = "CertiProof_Secure_Salt_v1_9a8b7c6d5e4f3g2h"

def hash_answer(answer_text):
    """
    Computes a salted SHA-256 hash of the candidate's answer text.
    This acts as the public commitment to the private input, allowing tamper-evidence
    without revealing the raw input in the proof's public instances.
    """
    salted_input = SALT + answer_text
    sha256_hash = hashlib.sha256(salted_input.encode('utf-8')).hexdigest()
    return sha256_hash

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python hash_input.py <answer_text>"}))
        sys.exit(1)
        
    answer_text = sys.argv[1]
    result_hash = hash_answer(answer_text)
    print(json.dumps({"input_sha256": result_hash}))
