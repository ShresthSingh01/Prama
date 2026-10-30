import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.models.database import engine, Base, SessionLocal
from backend.app.models.entities import (
    User, Institution, Bank, Instrument, FieldProvenance,
    Document, Flag, ReminderRule, SystemClock, 
    InstrumentStatusEnum, TrustTierEnum, ProvenanceSourceEnum,
    RoleEnum
)
from backend.app.core.security import hash_password
from backend.app.core.crypto import generate_ed25519_keypair, compute_chain_hash, canonical_json
from backend.app.services.audit_service import log_audit_entry, GENESIS_HASH
from backend.app.services.risk_service import compute_instrument_risk_score
from backend.app.services.rules_engine import evaluate_instrument_rules

INDIAN_BANKS = [
    {"name": "State Bank of India", "ifsc": "SBIN", "regex": r"^SBIN\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Punjab National Bank", "ifsc": "PUNB", "regex": r"^PUNB\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Canara Bank", "ifsc": "CNRB", "regex": r"^CNRB\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Bank of Baroda", "ifsc": "BARB", "regex": r"^BARB\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Union Bank of India", "ifsc": "UBIN", "regex": r"^UBIN\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "HDFC Bank", "ifsc": "HDFC", "regex": r"^HDFC\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "ICICI Bank", "ifsc": "ICIC", "regex": r"^ICIC\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Axis Bank", "ifsc": "UTIB", "regex": r"^UTIB\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Indian Bank", "ifsc": "IDIB", "regex": r"^IDIB\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Central Bank of India", "ifsc": "CBIN", "regex": r"^CBIN\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Kotak Mahindra Bank", "ifsc": "KKBK", "regex": r"^KKBK\/\d{4}\/[A-Z0-9-]{5,15}$"},
    {"name": "Bank of India", "ifsc": "BKID", "regex": r"^BKID\/\d{4}\/[A-Z0-9-]{5,15}$"},
]

STATES_DISTRICTS = [
    ("Maharashtra", ["Pune", "Mumbai", "Nagpur", "Nashik", "Aurangabad"]),
    ("Karnataka", ["Bengaluru Urban", "Mysuru", "Hubballi", "Mangaluru"]),
    ("Tamil Nadu", ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"]),
    ("Delhi", ["New Delhi", "North Delhi", "South Delhi"]),
    ("Uttar Pradesh", ["Noida", "Lucknow", "Kanpur", "Varanasi"]),
    ("Gujarat", ["Ahmedabad", "Surat", "Vadodara", "Rajkot"]),
    ("Telangana", ["Hyderabad", "Warangal", "Nizamabad"]),
    ("West Bengal", ["Kolkata", "Howrah", "Durgapur"]),
    ("Rajasthan", ["Jaipur", "Jodhpur", "Kota", "Udaipur"]),
    ("Kerala", ["Thiruvananthapuram", "Kochi", "Kozhikode"])
]

COLLEGE_PREFIXES = ["National", "Apex", "Bharati", "St. Xavier's", "Swami Vivekananda", "Rajiv Gandhi", "Dr. B.R. Ambedkar", "Indira Gandhi", "Shri Ram", "Vidyapeeth"]
COLLEGE_TYPES = ["Institute of Technology", "College of Engineering", "Polytechnic College", "Institute of Management & Tech", "School of Computer Applications"]

def seed_database(drop_existing: bool = False):
    print("[*] Initializing Database Schema...")
    if drop_existing:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        print("[*] Initializing System Clock...")
        clock = SystemClock(id=1, offset_days=0)
        db.add(clock)
        db.commit()

        print("[*] Creating 12 Commercial & Public Banks with Ed25519 Keypairs...")
        bank_objs = []
        for b_info in INDIAN_BANKS:
            priv_key, pub_key = generate_ed25519_keypair()
            bank = Bank(
                name=b_info["name"],
                ifsc_prefix=b_info["ifsc"],
                fdr_number_regex=b_info["regex"],
                public_key=pub_key,
                private_key=priv_key,
                layout_fingerprint={"header_font": "Helvetica-Bold", "seal_position": "bottom-right"}
            )
            db.add(bank)
            bank_objs.append(bank)
        db.commit()

        print("[*] Creating Reminder Rules & Escalation Ladders...")
        rules = [
            ReminderRule(name="T-90 Advance Notice", days_before=90, level=1, channel="EMAIL", recipient_role="institution_admin"),
            ReminderRule(name="T-60 Second Notice", days_before=60, level=1, channel="EMAIL", recipient_role="institution_admin"),
            ReminderRule(name="T-30 Urgent Notice", days_before=30, level=1, channel="EMAIL+SMS", recipient_role="institution_admin"),
            ReminderRule(name="T-7 Final Notice", days_before=7, level=1, channel="EMAIL+SMS", recipient_role="institution_admin"),
            ReminderRule(name="Overdue +1 Scrutiny Alert", days_before=-1, level=2, channel="DASHBOARD", recipient_role="scrutiny_officer"),
            ReminderRule(name="Overdue +7 Senior Officer Escalation", days_before=-7, level=3, channel="ESCALATION_EMAIL", recipient_role="senior_officer"),
            ReminderRule(name="Overdue +15 Bureau Director Vigilance", days_before=-15, level=3, channel="VIGILANCE_ACTION", recipient_role="senior_officer"),
        ]
        db.add_all(rules)
        db.commit()

        print("[*] Creating 150 Technical Institutions across India...")
        institutions = []
        inst_counter = 1
        for state, districts in STATES_DISTRICTS:
            for dist in districts:
                for i in range(3):
                    pfx = COLLEGE_PREFIXES[(inst_counter + i) % len(COLLEGE_PREFIXES)]
                    ctype = COLLEGE_TYPES[(inst_counter + i) % len(COLLEGE_TYPES)]
                    inst_name = f"{pfx} {ctype}, {dist}"
                    aicte_code = f"1-{100000000 + inst_counter}"
                    
                    comp_score = 100.0 if inst_counter > 20 else random.choice([75.0, 80.0, 88.0, 92.0])
                    inst = Institution(
                        aicte_id=aicte_code,
                        name=inst_name,
                        state=state,
                        district=dist,
                        email=f"registrar.inst{inst_counter}@edu.in",
                        phone=f"+91 98{random.randint(10000000, 99999999)}",
                        compliance_score=comp_score
                    )
                    db.add(inst)
                    institutions.append(inst)
                    inst_counter += 1
        db.commit()

        print("[*] Creating Standard Role-Based Users...")
        pwd_hash = hash_password("Password@123")
        users = [
            User(name="Dr. R.K. Sharma", email="admin@aicte.gov.in", password_hash=pwd_hash, role=RoleEnum.ADMIN.value),
            User(name="A.K. Verma", email="maker@aicte.gov.in", password_hash=pwd_hash, role=RoleEnum.SCRUTINY_OFFICER.value),
            User(name="Dr. Mamta Agarwal (Director)", email="checker@aicte.gov.in", password_hash=pwd_hash, role=RoleEnum.SENIOR_OFFICER.value),
            User(name="Registrar IIT", email="institute1@iit.ac.in", password_hash=pwd_hash, role=RoleEnum.INSTITUTION_ADMIN.value, institution_id=1),
            User(name="Registrar MIT", email="institute2@mit.edu", password_hash=pwd_hash, role=RoleEnum.INSTITUTION_ADMIN.value, institution_id=2),
            User(name="SBI Nodal Officer", email="banknodal@sbi.co.in", password_hash=pwd_hash, role=RoleEnum.BANK_OFFICER.value),
        ]
        db.add_all(users)
        db.commit()

        print("[*] Planting 4-Institution Collusion Syndicate (Fraud Ring Demo)...")
        # Collusion ring: Institutions 10, 11, 12, 13 share the same FDR serial and identical document
        collusion_insts = institutions[10:14]
        shared_fdr_num = "SBIN/2026/APEX-SYNDICATE-99214"
        shared_sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        
        for c_inst in collusion_insts:
            c_inst.name = f"Apex Allied Group - {c_inst.name}"
            inst_obj = Instrument(
                institution_id=c_inst.id,
                bank_id=bank_objs[0].id,  # SBI
                fdr_number=shared_fdr_num,
                amount=5000000.0,
                issue_date="2025-06-15",
                maturity_date="2027-06-15",
                tenure_days=730,
                interest_rate=7.1,
                purpose="AICTE Mandatory Security Deposit",
                status=InstrumentStatusEnum.FLAGGED.value,
                trust_tier=TrustTierEnum.SELF_DECLARED.value,
                risk_score=94.5,
                risk_band="CRITICAL"
            )
            db.add(inst_obj)
            db.commit()
            
            # Add shared document hash
            doc = Document(
                instrument_id=inst_obj.id,
                kind="FDR_RECEIPT",
                storage_key=f"syndicate_fdr_{c_inst.id}.pdf",
                sha256=shared_sha256,
                mime="application/pdf"
            )
            db.add(doc)
            db.commit()
            
            # Initial Provenance
            prov = FieldProvenance(instrument_id=inst_obj.id, field_name="fdr_number", value=shared_fdr_num, source=ProvenanceSourceEnum.SELF_DECLARED.value)
            db.add(prov)
            db.commit()
            
            evaluate_instrument_rules(db, inst_obj)
            log_audit_entry(db, "SUBMIT_FDR", "instrument", inst_obj.id, {"fdr": shared_fdr_num, "amount": 5000000.0})

        print("[*] Generating 600 Varied FDR Instruments Across 24 Months...")
        today = datetime.utcnow()
        for idx in range(600):
            institution = random.choice(institutions)
            bank = random.choice(bank_objs)
            
            # Stagger maturities: from -60 days past (overdue) to +720 days ahead
            days_offset = random.choice([
                random.randint(-45, -1),     # 10% Overdue
                random.randint(5, 30),       # 15% Expiring <30d
                random.randint(31, 90),      # 20% Expiring <90d
                random.randint(91, 365),     # 35% Active
                random.randint(366, 730)     # 20% Far Active
            ])
            
            mat_date = (today + timedelta(days=days_offset)).strftime("%Y-%m-%d")
            issue_date = (today + timedelta(days=days_offset - 730)).strftime("%Y-%m-%d")
            
            amount = random.choice([500000.0, 750000.0, 1000000.0, 1500000.0, 2500000.0, 5000000.0, 10000000.0])
            tenure = 730
            rate = round(random.uniform(6.5, 7.8), 2)
            
            status = InstrumentStatusEnum.ACTIVE.value
            trust = random.choice([TrustTierEnum.BANK_CONFIRMED.value, TrustTierEnum.CROSS_VALIDATED.value, TrustTierEnum.SELF_DECLARED.value])
            if days_offset < -15:
                status = InstrumentStatusEnum.OVERDUE.value
            elif days_offset <= 0:
                status = InstrumentStatusEnum.MATURED.value
            elif days_offset <= 90:
                status = InstrumentStatusEnum.EXPIRING.value
                
            fdr_num = f"{bank.ifsc_prefix}/2025/{random.randint(100000, 999999)}"
            
            # Plant intentional 5% invalid format or interest rate anomaly
            if idx % 20 == 0:
                fdr_num = f"INVALID-{random.randint(100, 999)}"
                status = InstrumentStatusEnum.FLAGGED.value
            elif idx % 25 == 0:
                rate = 14.5  # Implausible rate
                status = InstrumentStatusEnum.FLAGGED.value

            inst_item = Instrument(
                institution_id=institution.id,
                bank_id=bank.id,
                fdr_number=fdr_num,
                amount=amount,
                issue_date=issue_date,
                maturity_date=mat_date,
                tenure_days=tenure,
                interest_rate=rate,
                purpose="AICTE Mandatory Security Deposit",
                status=status,
                trust_tier=trust
            )
            db.add(inst_item)
            db.commit()
            
            # Add field provenance
            prov_src = ProvenanceSourceEnum.BANK_CONFIRMED.value if trust == TrustTierEnum.BANK_CONFIRMED.value else ProvenanceSourceEnum.SELF_DECLARED.value
            db.add(FieldProvenance(instrument_id=inst_item.id, field_name="fdr_number", value=fdr_num, source=prov_src))
            db.add(FieldProvenance(instrument_id=inst_item.id, field_name="amount", value=str(amount), source=prov_src))
            db.add(FieldProvenance(instrument_id=inst_item.id, field_name="maturity_date", value=mat_date, source=prov_src))
            db.commit()
            
            # Run rules & risk scoring
            evaluate_instrument_rules(db, inst_item)
            risk, band, _ = compute_instrument_risk_score(db, inst_item)
            inst_item.risk_score = risk
            inst_item.risk_band = band
            db.commit()
            
            if idx % 50 == 0:
                log_audit_entry(db, "SUBMIT_FDR", "instrument", inst_item.id, {"fdr": fdr_num, "amount": amount})
                print(f"   -> Seeded {idx}/600 instruments...")

        print("[+] SEEDING COMPLETE! 150 Institutions, 12 Banks, 604 Instruments generated with full audit trail.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
