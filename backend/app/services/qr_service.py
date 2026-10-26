import os
import json
import qrcode
from typing import Dict, Any, Tuple, Optional
from backend.app.core.config import settings
from backend.app.core.crypto import sign_payload, verify_signature, canonical_json

def generate_bank_signed_qr(
    bank_private_key_hex: str,
    bank_ifsc: str,
    fdr_number: str,
    amount: float,
    issue_date: str,
    maturity_date: str,
    holder_name: str,
    output_filename: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates a cryptographically signed QR code embedding essential FDR credentials
    signed with the bank's Ed25519 private key.
    """
    payload = {
        "ifsc": bank_ifsc,
        "fdr": fdr_number,
        "amt": float(amount),
        "iss": issue_date,
        "mat": maturity_date,
        "holder": holder_name
    }
    
    signature = sign_payload(bank_private_key_hex, payload)
    
    envelope = {
        "v": 1,
        "payload": payload,
        "sig": signature
    }
    
    envelope_json = json.dumps(envelope, separators=(',', ':'))
    
    if not output_filename:
        output_filename = f"qr_{fdr_number.replace('/', '_')}.png"
        
    qr_dir = os.path.join(settings.STORAGE_DIR, "qrs")
    os.makedirs(qr_dir, exist_ok=True)
    out_path = os.path.join(qr_dir, output_filename)
    
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
    )
    qr.add_data(envelope_json)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(out_path)
    
    return {
        "envelope": envelope,
        "envelope_json": envelope_json,
        "qr_path": out_path,
        "signature": signature
    }

def verify_bank_signed_qr_payload(
    bank_public_key_hex: str,
    qr_content: str
) -> Dict[str, Any]:
    """
    Verifies an Ed25519 signature from a scanned QR payload against the bank's public key.
    """
    try:
        if isinstance(qr_content, str):
            envelope = json.loads(qr_content)
        else:
            envelope = qr_content
            
        payload = envelope.get("payload")
        signature = envelope.get("sig")
        
        if not payload or not signature:
            return {
                "valid": False,
                "reason": "Malformed QR data: missing payload or signature envelope.",
                "payload": None
            }
            
        is_valid = verify_signature(bank_public_key_hex, payload, signature)
        
        return {
            "valid": is_valid,
            "reason": "Ed25519 cryptographic signature authentic." if is_valid else "INVALID SIGNATURE! Cryptographic tampering detected.",
            "payload": payload,
            "signature": signature
        }
    except Exception as e:
        return {
            "valid": False,
            "reason": f"Failed to parse or verify QR envelope: {str(e)}",
            "payload": None
        }
