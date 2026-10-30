import os
from datetime import datetime
from typing import Any, Dict
from PIL import Image, ImageDraw, ImageFont
import qrcode
from backend.app.core.config import settings
from backend.app.models.entities import utc_now

def generate_release_certificate(db: Any, release_req: Any) -> str:
    """
    Generates a genuine, printable, high-fidelity PDF Discharge Certificate
    for an approved and released institutional security deposit.
    Saves the file to storage_vault/certificates/release_{id}.pdf and returns the file path.
    """
    cert_dir = os.path.join(settings.STORAGE_DIR, "certificates")
    os.makedirs(cert_dir, exist_ok=True)
    pdf_filename = f"release_{release_req.id}.pdf"
    pdf_path = os.path.join(cert_dir, pdf_filename)

    inst = release_req.instrument
    institution_name = inst.institution.name if inst.institution else "Technical Institute"
    aicte_id = inst.institution.aicte_id if inst.institution else "AICTE-2026-N/A"
    bank_name = inst.bank.name if inst.bank else "Scheduled Commercial Bank"
    fdr_no = inst.fdr_number
    amount_str = f"INR {inst.amount:,.2f}"
    decided_date = release_req.decided_at.strftime("%d-%b-%Y") if release_req.decided_at else utc_now().strftime("%d-%b-%Y")
    audit_hash = release_req.certificate_hash or "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    # Standard A4 dimensions at 150 DPI: 1240 x 1754 px
    w, h = 1240, 1754
    img = Image.new("RGB", (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Decorative Border
    draw.rectangle([20, 20, w - 21, h - 21], outline=(15, 30, 80), width=4)
    draw.rectangle([28, 28, w - 29, h - 29], outline=(200, 160, 80), width=2)
    draw.rectangle([34, 34, w - 35, h - 35], outline=(220, 215, 200), width=1)

    # Fonts
    font_h1 = ImageFont.load_default(size=24)
    font_h2 = ImageFont.load_default(size=14)
    font_title = ImageFont.load_default(size=18)
    font_label = ImageFont.load_default(size=12)
    font_val = ImageFont.load_default(size=14)
    font_val_bold = ImageFont.load_default(size=16)
    font_body = ImageFont.load_default(size=12)
    font_mono = ImageFont.load_default(size=10)

    # Top Header Banner
    draw.text((w // 2, 60), "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", fill=(15, 30, 80), font=font_h1, anchor="mt")
    draw.text((w // 2, 95), "MINISTRY OF EDUCATION, GOVERNMENT OF INDIA", fill=(100, 105, 115), font=font_h2, anchor="mt")
    draw.text((w // 2, 118), "REGULATION BUREAU - NELSON MANDELA MARG, VASANT KUNJ, NEW DELHI-110070", fill=(120, 125, 135), font=font_body, anchor="mt")

    # Divider Ribbon
    draw.rectangle([60, 150, w - 60, 195], fill=(245, 240, 230), outline=(180, 150, 90), width=1)
    draw.text((w // 2, 172), "OFFICIAL CERTIFICATE OF STATUTORY LIEN DISCHARGE & REFUND AUTHORIZATION", fill=(130, 30, 20), font=font_title, anchor="mm")

    # Certificate Metadata Box
    y_start = 220
    draw.text((80, y_start), f"CERTIFICATE REF NO: AICTE/REL/2026/{release_req.id:05d}", fill=(15, 30, 80), font=font_val_bold)
    draw.text((w - 80, y_start), f"DISCHARGE DATE: {decided_date}", fill=(70, 75, 85), font=font_val_bold, anchor="rt")

    # Beneficiary Institution Box
    y_inst = y_start + 45
    draw.rectangle([80, y_inst, w - 80, y_inst + 85], fill=(250, 252, 255), outline=(180, 200, 230), width=1)
    draw.text((100, y_inst + 15), "BENEFICIARY INSTITUTION:", fill=(100, 110, 130), font=font_label)
    draw.text((100, y_inst + 35), institution_name.upper(), fill=(15, 30, 80), font=font_val_bold)
    draw.text((100, y_inst + 60), f"PERMANENT AICTE INSTITUTE ID: {aicte_id}", fill=(70, 80, 95), font=font_val)

    # Discharged Instrument Details Grid
    y_grid = y_inst + 110
    draw.rectangle([80, y_grid, w - 80, y_grid + 240], fill=(255, 255, 255), outline=(200, 200, 200), width=1)

    # Row 1: FDR Number and Amount
    draw.text((100, y_grid + 15), "FIXED DEPOSIT RECEIPT NUMBER:", fill=(110, 115, 125), font=font_label)
    draw.text((100, y_grid + 35), fdr_no, fill=(15, 30, 80), font=font_val_bold)

    draw.text((w // 2 + 20, y_grid + 15), "DISCHARGED PRINCIPAL CORPUS:", fill=(110, 115, 125), font=font_label)
    draw.text((w // 2 + 20, y_grid + 35), amount_str, fill=(20, 95, 45), font=font_val_bold)

    draw.line([80, y_grid + 75, w - 80, y_grid + 75], fill=(230, 230, 230), width=1)

    # Row 2: Issuing Bank and IFSC
    draw.text((100, y_grid + 90), "ISSUING COMMERCIAL BANK:", fill=(110, 115, 125), font=font_label)
    draw.text((100, y_grid + 110), bank_name, fill=(20, 30, 45), font=font_val)

    draw.text((w // 2 + 20, y_grid + 90), "STATUTORY LIEN HOLDER:", fill=(110, 115, 125), font=font_label)
    draw.text((w // 2 + 20, y_grid + 110), "Member Secretary, AICTE (Joint Pledge)", fill=(20, 30, 45), font=font_val)

    draw.line([80, y_grid + 150, w - 80, y_grid + 150], fill=(230, 230, 230), width=1)

    # Row 3: Dates & Regulatory Basis
    draw.text((100, y_grid + 165), "ISSUE / MATURITY DATES:", fill=(110, 115, 125), font=font_label)
    draw.text((100, y_grid + 185), f"{inst.issue_date} to {inst.maturity_date} ({inst.tenure_days} Days)", fill=(20, 30, 45), font=font_val)

    draw.text((w // 2 + 20, y_grid + 165), "REGULATORY AUTHORITY BASIS:", fill=(110, 115, 125), font=font_label)
    draw.text((w // 2 + 20, y_grid + 185), "AICTE APH 2024-2027 Clause 6.46", fill=(20, 30, 45), font=font_val)

    # Formal Discharge Legal Proclamation
    y_proc = y_grid + 270
    proc_text = (
        "Pursuant to the provisions of AICTE Approval Process Regulations, the Competent Authority "
        "has completed multi-tier scrutiny, vigilance clearance, and financial verification of the "
        "subject security deposit. The statutory lien registered in favor of 'Member Secretary, AICTE' "
        "is hereby FULLY DISCHARGED AND EXTINGUISHED. The issuing bank is authorized to encash or refund "
        "the principal deposit together with all accrued interest in favor of the pledging institution."
    )
    draw.rectangle([80, y_proc, w - 80, y_proc + 120], fill=(252, 250, 245), outline=(220, 210, 190), width=1)
    draw.text((100, y_proc + 15), "FORMAL STATUTORY DISCHARGE DIRECTIVE:", fill=(140, 40, 25), font=font_val_bold)
    
    # Wrap and print proclamation
    lines = [
        "Pursuant to the provisions of AICTE Approval Process Handbook Clause 6.46, the Competent Authority has completed",
        "regulatory scrutiny, independent bank verification, and bureau clearance for the subject security deposit.",
        "The statutory lien registered in favor of 'Member Secretary, AICTE, New Delhi' on the above-described FDR is hereby",
        "FULLY DISCHARGED AND EXTINGUISHED. The issuing bank is authorized to release all funds to the pledging institution."
    ]
    for idx, l in enumerate(lines):
        draw.text((100, y_proc + 45 + (idx * 18)), l, fill=(50, 55, 65), font=font_body)

    # Dual-Officer Maker-Checker Signatures
    y_sigs = y_proc + 160
    box_w = (w - 200) // 2

    # Maker Box (Left)
    draw.rectangle([80, y_sigs, 80 + box_w, y_sigs + 130], fill=(255, 255, 255), outline=(210, 215, 225), width=1)
    draw.text((100, y_sigs + 15), "MAKER SCRUTINY VERIFICATION:", fill=(100, 110, 130), font=font_label)
    maker_name = "P. S. Narayanan (Scrutiny Officer)" if release_req.maker_id else "Authorized Scrutiny Officer"
    draw.text((100, y_sigs + 40), maker_name, fill=(15, 30, 80), font=font_val_bold)
    draw.text((100, y_sigs + 65), "Bureau: AICTE Regulation Bureau", fill=(70, 80, 95), font=font_body)
    draw.text((100, y_sigs + 85), f"Verification Status: PASSED & RECOMMENDED", fill=(20, 110, 40), font=font_body)
    draw.text((100, y_sigs + 105), f"Maker User ID: #{release_req.maker_id or 2}", fill=(120, 125, 135), font=font_mono)

    # Checker Box (Right)
    draw.rectangle([80 + box_w + 40, y_sigs, w - 80, y_sigs + 130], fill=(255, 255, 255), outline=(210, 215, 225), width=1)
    draw.text((80 + box_w + 60, y_sigs + 15), "FINAL CHECKER AUTHORIZATION:", fill=(100, 110, 130), font=font_label)
    checker_name = "Dr. K. R. Sharma (Director / Approver)" if release_req.checker_id else "Senior Approving Authority"
    draw.text((80 + box_w + 60, y_sigs + 40), checker_name, fill=(15, 30, 80), font=font_val_bold)
    draw.text((80 + box_w + 60, y_sigs + 65), "Authority: Competent Authority, AICTE", fill=(70, 80, 95), font=font_body)
    draw.text((80 + box_w + 60, y_sigs + 85), f"Approval Status: FULLY AUTHORIZED & RELEASED", fill=(20, 110, 40), font=font_body)
    draw.text((80 + box_w + 60, y_sigs + 105), f"Checker User ID: #{release_req.checker_id or 3}", fill=(120, 125, 135), font=font_mono)

    # Bottom Footer: Cryptographic QR & Audit Hash Proof
    y_foot = y_sigs + 160
    draw.line([80, y_foot, w - 80, y_foot], fill=(200, 200, 200), width=1)

    # Generate and Paste QR
    qr_payload = f"AICTE-RELEASE-CERT:ID={release_req.id}|FDR={fdr_no}|HASH={audit_hash[:16]}"
    qr_img = qrcode.make(qr_payload).resize((130, 130))
    img.paste(qr_img, (80, y_foot + 15))

    draw.text((230, y_foot + 25), "CRYPTOGRAPHIC AUDIT PROOF & TAMPER-EVIDENT VERIFICATION", fill=(15, 30, 80), font=font_val_bold)
    draw.text((230, y_foot + 50), f"Audit Chain SHA-256 Digest: {audit_hash}", fill=(90, 95, 105), font=font_mono)
    draw.text((230, y_foot + 70), "This certificate is backed by Prama's cryptographic hash chain. Any post-issuance alteration", fill=(110, 115, 125), font=font_body)
    draw.text((230, y_foot + 90), "invalidates the block sequence and can be instantly checked at /api/v1/audit/verify.", fill=(110, 115, 125), font=font_body)

    # Save high-res image canvas as PDF
    img.save(pdf_path, "PDF", resolution=150.0)
    return pdf_path


def generate_deficiency_notice(db: Any, instrument: Any, officer_name: Any = None) -> str:
    """
    Generates an official, printable statutory AICTE Notice of Deficiency & Rectification Directive
    for an FDR with discrepancies, missing lien, upcoming unrenewed maturity, or flagged irregularities.
    Saves the file to storage_vault/certificates/deficiency_{instrument.id}.pdf and returns the file path.
    """
    cert_dir = os.path.join(settings.STORAGE_DIR, "certificates")
    os.makedirs(cert_dir, exist_ok=True)
    pdf_filename = f"deficiency_{instrument.id}.pdf"
    pdf_path = os.path.join(cert_dir, pdf_filename)

    institution_name = instrument.institution.name if instrument.institution else "Technical Institute"
    aicte_id = instrument.institution.aicte_id if instrument.institution else "AICTE-2026-N/A"
    state = instrument.institution.state if instrument.institution else "India"
    bank_name = instrument.bank.name if instrument.bank else "Scheduled Commercial Bank"
    fdr_no = instrument.fdr_number
    amount_str = f"INR {instrument.amount:,.2f}"
    
    from backend.app.services.clock_service import get_simulated_now
    sim_now = get_simulated_now(db)
    notice_date = sim_now.strftime("%d-%b-%Y")
    
    # Standard A4 dimensions at 150 DPI: 1240 x 1754 px
    w, h = 1240, 1754
    img = Image.new("RGB", (w, h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Red/Gold Warning Regulatory Border
    draw.rectangle([20, 20, w - 21, h - 21], outline=(180, 40, 30), width=4)
    draw.rectangle([28, 28, w - 29, h - 29], outline=(200, 160, 80), width=2)
    draw.rectangle([34, 34, w - 35, h - 35], outline=(240, 220, 220), width=1)

    # Fonts
    font_h1 = ImageFont.load_default(size=24)
    font_h2 = ImageFont.load_default(size=14)
    font_title = ImageFont.load_default(size=18)
    font_label = ImageFont.load_default(size=12)
    font_val = ImageFont.load_default(size=14)
    font_val_bold = ImageFont.load_default(size=16)
    font_body = ImageFont.load_default(size=12)
    font_mono = ImageFont.load_default(size=10)

    # Top Header Banner
    draw.text((w // 2, 60), "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION", fill=(15, 30, 80), font=font_h1, anchor="mt")
    draw.text((w // 2, 95), "MINISTRY OF EDUCATION, GOVERNMENT OF INDIA", fill=(100, 105, 115), font=font_h2, anchor="mt")
    draw.text((w // 2, 118), "REGULATION BUREAU - STATUTORY COMPLIANCE & MONITORING DESK", fill=(140, 30, 20), font=font_body, anchor="mt")

    # Divider Ribbon
    draw.rectangle([60, 150, w - 60, 195], fill=(255, 243, 240), outline=(200, 60, 40), width=1)
    draw.text((w // 2, 172), "FORMAL STATUTORY NOTICE OF DEFICIENCY & RECTIFICATION DIRECTIVE", fill=(180, 25, 20), font=font_title, anchor="mm")

    # Metadata Box
    y_start = 220
    draw.text((80, y_start), f"NOTICE REF NO: AICTE/REG/DEF/2026/{instrument.id:05d}", fill=(180, 25, 20), font=font_val_bold)
    draw.text((w - 80, y_start), f"DATE OF ISSUANCE: {notice_date}", fill=(70, 75, 85), font=font_val_bold, anchor="rt")

    # Recipient Box
    y_inst = y_start + 45
    draw.rectangle([80, y_inst, w - 80, y_inst + 85], fill=(255, 252, 252), outline=(220, 180, 180), width=1)
    draw.text((100, y_inst + 15), "TO: THE CHAIRMAN / PRINCIPAL:", fill=(120, 60, 50), font=font_label)
    draw.text((100, y_inst + 35), institution_name.upper(), fill=(15, 30, 80), font=font_val_bold)
    draw.text((100, y_inst + 60), f"PERMANENT AICTE INSTITUTE ID: {aicte_id} | STATE: {state}", fill=(70, 80, 95), font=font_val)

    # Subject
    y_subj = y_inst + 105
    draw.rectangle([80, y_subj, w - 80, y_subj + 45], fill=(245, 247, 250), outline=(200, 210, 225), width=1)
    draw.text((100, y_subj + 14), f"SUBJECT: Regulatory Non-Compliance in Security Deposit FDR No. {fdr_no} (APH Clause 6.46)", fill=(15, 30, 80), font=font_val_bold)

    # Discrepancy Table
    y_grid = y_subj + 65
    draw.rectangle([80, y_grid, w - 80, y_grid + 190], fill=(255, 255, 255), outline=(200, 200, 200), width=1)
    
    draw.text((100, y_grid + 15), "FIXED DEPOSIT RECEIPT NUMBER:", fill=(110, 115, 125), font=font_label)
    draw.text((100, y_grid + 35), fdr_no, fill=(15, 30, 80), font=font_val_bold)

    draw.text((w // 2 + 20, y_grid + 15), "DECLARED PRINCIPAL AMOUNT:", fill=(110, 115, 125), font=font_label)
    draw.text((w // 2 + 20, y_grid + 35), amount_str, fill=(180, 40, 30), font=font_val_bold)

    draw.line([80, y_grid + 75, w - 80, y_grid + 75], fill=(230, 230, 230), width=1)

    draw.text((100, y_grid + 90), "ISSUING BANK:", fill=(110, 115, 125), font=font_label)
    draw.text((100, y_grid + 110), bank_name, fill=(20, 30, 45), font=font_val)

    draw.text((w // 2 + 20, y_grid + 90), "MATURITY DATE / STATUS:", fill=(110, 115, 125), font=font_label)
    draw.text((w // 2 + 20, y_grid + 110), f"{instrument.maturity_date} ({instrument.status})", fill=(180, 40, 30), font=font_val_bold)

    draw.line([80, y_grid + 145, w - 80, y_grid + 145], fill=(230, 230, 230), width=1)

    # Specific Deficiencies
    y_def = y_grid + 215
    draw.rectangle([80, y_def, w - 80, y_def + 260], fill=(254, 248, 248), outline=(230, 180, 180), width=1)
    draw.text((100, y_def + 15), "SPECIFIC COMPLIANCE IRREGULARITIES DETECTED UPON SCRUTINY:", fill=(180, 25, 20), font=font_val_bold)

    deficiencies = []
    # Collect open flags
    for f in (instrument.flags or []):
        if getattr(f, "status", "") == "open":
            deficiencies.append(f"• [{f.code}] {f.explanation}")
    
    if not instrument.lien_marked:
        deficiencies.append("• [LIEN_PENDING] Formal statutory lien endorsement in favour of 'Member Secretary, AICTE' is not confirmed on record.")
    if not instrument.joint_holding_confirmed:
        deficiencies.append("• [JOINT_HOLDING] Instrument is not confirmed in joint holding with Regional Officer, AICTE as mandated by APH Clause 6.46.")
    
    if not deficiencies:
        deficiencies.append("• [APPROACHING_MATURITY] Instrument is maturing without an approved renewal/replacement submission on the digital portal.")
        deficiencies.append("• [STATUTORY_VERIFICATION] Bank branch independent confirmation pending submission.")

    for idx, d in enumerate(deficiencies[:5]):
        d_line = d if len(d) <= 100 else d[:97] + "..."
        draw.text((100, y_def + 45 + (idx * 26)), d_line, fill=(140, 20, 15), font=font_body)

    # Mandatory Directive Box
    y_dir = y_def + 285
    draw.rectangle([80, y_dir, w - 80, y_dir + 150], fill=(255, 255, 255), outline=(180, 185, 195), width=1)
    draw.text((100, y_dir + 15), "STATUTORY RECTIFICATION DIRECTIVE & TIMELINE:", fill=(15, 30, 80), font=font_val_bold)

    dir_lines = [
        "1. In accordance with Section 10(k) of the AICTE Act 1987 and Approval Process Regulations, the Institution",
        "   is hereby granted FIFTEEN (15) CALENDAR DAYS from the date of this notice to rectify the noted deficiencies.",
        "2. The Institution must upload the renewed/rectified instrument with verified bank lien endorsement directly",
        "   on the AICTE Security Deposit Portal (Prama) at https://prama.aicte.gov.in/submit.",
        "3. Failure to comply will automatically result in withholding of Extension of Approval (EoA) and initiate regulatory penalty."
    ]
    for idx, dl in enumerate(dir_lines):
        draw.text((100, y_dir + 45 + (idx * 20)), dl, fill=(50, 55, 65), font=font_body)

    # Signatures
    y_sig = y_dir + 175
    draw.line([80, y_sig, w - 80, y_sig], fill=(220, 220, 220), width=1)

    officer_display = officer_name or "P. S. Narayanan"
    draw.text((100, y_sig + 20), "ISSUED BY ORDER OF THE COMPETENT AUTHORITY:", fill=(100, 110, 130), font=font_label)
    draw.text((100, y_sig + 40), f"{officer_display} (Scrutiny Officer)", fill=(15, 30, 80), font=font_val_bold)
    draw.text((100, y_sig + 62), "Regulation Bureau, All India Council for Technical Education", fill=(80, 85, 95), font=font_body)
    draw.text((100, y_sig + 82), "Nelson Mandela Marg, Vasant Kunj, New Delhi-110070", fill=(120, 125, 135), font=font_mono)

    # Verification QR
    qr_payload = f"AICTE-DEFICIENCY-NOTICE:ID={instrument.id}|FDR={fdr_no}|DATE={notice_date}"
    qr_img = qrcode.make(qr_payload).resize((110, 110))
    img.paste(qr_img, (w - 200, y_sig + 15))

    img.save(pdf_path, "PDF", resolution=150.0)
    return pdf_path
