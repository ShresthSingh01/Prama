from typing import Dict, Any, List, Set
from collections import defaultdict
from sqlalchemy.orm import Session, joinedload, selectinload
from backend.app.models.entities import Instrument, Institution, Bank, Document

def build_syndicate_graph(db: Session) -> Dict[str, Any]:
    """
    Constructs an interactive force-directed relationship graph of
    Institutions, Banks, FDR Serials, and Document Hashes.
    Detects syndicated collusion clusters where multiple institutions share
    the same FDR or identical binary document hashes.
    """
    nodes = []
    links = []
    node_set = set()
    
    # 1. Fetch instruments with relationships eager-loaded (avoids 1800+ N+1 queries)
    instruments = db.query(Instrument).options(
        joinedload(Instrument.institution),
        joinedload(Instrument.bank),
        selectinload(Instrument.documents)
    ).all()
    
    # Map institutions and banks
    fdr_to_insts = defaultdict(list)
    hash_to_insts = defaultdict(list)
    
    for inst in instruments:
        inst_node_id = f"inst_{inst.institution_id}"
        bank_node_id = f"bank_{inst.bank_id}"
        fdr_node_id = f"fdr_{inst.fdr_number}"
        
        # Add Institution Node
        if inst_node_id not in node_set:
            institution = inst.institution
            nodes.append({
                "id": inst_node_id,
                "label": institution.name if institution else f"Institute #{inst.institution_id}",
                "type": "institution",
                "state": institution.state if institution else "Unknown",
                "risk": inst.risk_band,
                "size": 18
            })
            node_set.add(inst_node_id)
            
        # Add Bank Node
        if bank_node_id not in node_set:
            bank = inst.bank
            nodes.append({
                "id": bank_node_id,
                "label": bank.name if bank else f"Bank #{inst.bank_id}",
                "type": "bank",
                "ifsc": bank.ifsc_prefix if bank else "N/A",
                "size": 22
            })
            node_set.add(bank_node_id)
            
        # Add FDR Serial Node
        if fdr_node_id not in node_set:
            nodes.append({
                "id": fdr_node_id,
                "label": f"FDR: {inst.fdr_number}",
                "type": "fdr",
                "amount": inst.amount,
                "status": inst.status,
                "size": 14
            })
            node_set.add(fdr_node_id)
            
        # Links
        links.append({
            "source": inst_node_id,
            "target": fdr_node_id,
            "relation": "PLEDGED"
        })
        links.append({
            "source": fdr_node_id,
            "target": bank_node_id,
            "relation": "ISSUED_AT"
        })
        
        fdr_to_insts[inst.fdr_number].append({
            "institution_id": inst.institution_id,
            "name": inst.institution.name if inst.institution else f"Inst {inst.institution_id}",
            "instrument_id": inst.id
        })
        
        # Document hash links
        for doc in inst.documents:
            doc_node_id = f"doc_{doc.sha256[:10]}"
            if doc_node_id not in node_set:
                nodes.append({
                    "id": doc_node_id,
                    "label": f"Doc {doc.sha256[:8]}",
                    "type": "document",
                    "sha256": doc.sha256,
                    "size": 12
                })
                node_set.add(doc_node_id)
                
            links.append({
                "source": fdr_node_id,
                "target": doc_node_id,
                "relation": "HASH_MATCH"
            })
            hash_to_insts[doc.sha256].append({
                "institution_id": inst.institution_id,
                "name": inst.institution.name if inst.institution else f"Inst {inst.institution_id}"
            })

    # Detect rings / syndicates (any FDR or Hash linked to >= 2 institutions)
    collusion_rings = []
    
    # 1. FDR Serial reuse across distinct institutions
    for fdr_num, inst_list in fdr_to_insts.items():
        unique_insts = {item["institution_id"]: item["name"] for item in inst_list}
        if len(unique_insts) > 1:
            collusion_rings.append({
                "type": "DUPLICATE_FDR_SERIAL",
                "fdr_number": fdr_num,
                "involved_institutions": list(unique_insts.values()),
                "severity": "CRITICAL",
                "explanation": f"FDR serial '{fdr_num}' was simultaneously pledged by {len(unique_insts)} distinct technical colleges!"
            })
            
    # 2. Binary document hash reuse across distinct institutions
    for sha, inst_list in hash_to_insts.items():
        unique_insts = {item["institution_id"]: item["name"] for item in inst_list}
        if len(unique_insts) > 1:
            collusion_rings.append({
                "type": "IDENTICAL_FILE_REUSE",
                "sha256": sha,
                "involved_institutions": list(unique_insts.values()),
                "severity": "CRITICAL",
                "explanation": f"The exact same binary PDF document (SHA-256: {sha[:10]}...) was uploaded by {len(unique_insts)} different institutions."
            })

    return {
        "nodes": nodes,
        "links": links,
        "collusion_rings": collusion_rings,
        "total_nodes": len(nodes),
        "total_links": len(links)
    }
