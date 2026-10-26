import json
import hashlib
from typing import Dict, Any, Tuple
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.exceptions import InvalidSignature
from PIL import Image

def canonical_json(data: Dict[str, Any]) -> str:
    """Deterministic JSON string for cryptographic signing and audit hashing."""
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def generate_ed25519_keypair() -> Tuple[str, str]:
    """Generates an Ed25519 private/public keypair in hex format."""
    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    
    priv_bytes = private_key.private_bytes_raw()
    pub_bytes = public_key.public_bytes_raw()
    return priv_bytes.hex(), pub_bytes.hex()

def sign_payload(private_key_hex: str, payload: Dict[str, Any]) -> str:
    """Signs a canonical JSON payload with Ed25519 private key."""
    priv_bytes = bytes.fromhex(private_key_hex)
    private_key = ed25519.Ed25519PrivateKey.from_private_bytes(priv_bytes)
    data_bytes = canonical_json(payload).encode('utf-8')
    signature = private_key.sign(data_bytes)
    return signature.hex()

def verify_signature(public_key_hex: str, payload: Dict[str, Any], signature_hex: str) -> bool:
    """Verifies an Ed25519 signature against canonical JSON payload."""
    try:
        pub_bytes = bytes.fromhex(public_key_hex)
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(pub_bytes)
        sig_bytes = bytes.fromhex(signature_hex)
        data_bytes = canonical_json(payload).encode('utf-8')
        public_key.verify(sig_bytes, data_bytes)
        return True
    except (InvalidSignature, ValueError, Exception):
        return False

def compute_chain_hash(prev_hash: str, entry_payload: Dict[str, Any]) -> str:
    """
    Computes append-only SHA-256 hash chain:
    hash = SHA-256(prev_hash || canonical_json(payload))
    """
    hasher = hashlib.sha256()
    hasher.update((prev_hash or "").encode('utf-8'))
    hasher.update(canonical_json(entry_payload).encode('utf-8'))
    return hasher.hexdigest()

def compute_file_sha256(filepath: str) -> str:
    """Computes standard SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def compute_image_dhash(image_path: str, hash_size: int = 8) -> str:
    """
    Computes difference perceptual hash (dHash) for near-duplicate image/doc detection.
    # ponytail: difference hash (dHash) via Pillow standard library provides fast 64-bit fingerprinting without heavy imagehash dependencies.
    """
    try:
        with Image.open(image_path) as img:
            img = img.convert('L').resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
            pixels = list(img.getdata())
            
            diff = []
            for row in range(hash_size):
                for col in range(hash_size):
                    left = pixels[row * (hash_size + 1) + col]
                    right = pixels[row * (hash_size + 1) + col + 1]
                    diff.append('1' if left > right else '0')
                    
            decimal_value = int(''.join(diff), 2)
            return hex(decimal_value)[2:].rjust(hash_size * hash_size // 4, '0')
    except Exception:
        return "0" * (hash_size * hash_size // 4)

def hamming_distance(hex1: str, hex2: str) -> int:
    """Computes Hamming distance between two hex hashes (0-64). Distance <= 5 indicates duplicate."""
    try:
        val1 = int(hex1, 16)
        val2 = int(hex2, 16)
        xor_val = val1 ^ val2
        return bin(xor_val).count('1')
    except Exception:
        return 999
