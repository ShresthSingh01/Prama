import os
import re
import yaml
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.services.audit_service import log_audit_entry

logger = logging.getLogger(__name__)

class KnowledgeBundle:
    """In-memory cache and graph index of the OKF knowledge bundle."""
    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.concepts: Dict[str, Dict[str, Any]] = {}
        self.rule_params: Dict[str, Dict[str, Any]] = {}
        self.validation_errors: List[str] = []
        self.broken_links: List[str] = []
        self.type_counts: Dict[str, int] = {}
        self.graph_nodes: List[Dict[str, Any]] = []
        self.graph_links: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        self.concepts.clear()
        self.rule_params.clear()
        self.validation_errors.clear()
        self.broken_links.clear()
        self.type_counts.clear()
        self.graph_nodes.clear()
        self.graph_links.clear()

        if not self.root_dir.exists():
            self.validation_errors.append(f"Knowledge directory '{self.root_dir}' does not exist.")
            logger.warning(self.validation_errors[-1])
            return

        # 1. Parse all Markdown files
        for md_path in self.root_dir.rglob("*.md"):
            rel_path = md_path.relative_to(self.root_dir).as_posix()
            try:
                with open(md_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception as e:
                self.validation_errors.append(f"Failed to read '{rel_path}': {e}")
                continue

            # Parse frontmatter
            frontmatter = {}
            body = content
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    try:
                        frontmatter = yaml.safe_load(parts[1]) or {}
                        body = parts[2].strip()
                    except Exception as e:
                        self.validation_errors.append(f"YAML syntax error in '{rel_path}': {e}")
                        continue

            # Frontmatter validation
            ctype = frontmatter.get("type")
            if not ctype:
                self.validation_errors.append(f"Missing required 'type' field in frontmatter of '{rel_path}'")
                continue

            cid = frontmatter.get("id", rel_path.replace(".md", ""))
            title = frontmatter.get("title", cid)

            if ctype == "rule":
                if not frontmatter.get("id"):
                    self.validation_errors.append(f"Rule in '{rel_path}' is missing required 'id'")
                if not frontmatter.get("severity"):
                    self.validation_errors.append(f"Rule in '{rel_path}' is missing required 'severity'")
                # Store parameters
                params = frontmatter.get("parameters", {})
                self.rule_params[cid] = params

            self.type_counts[ctype] = self.type_counts.get(ctype, 0) + 1

            concept_data = {
                "id": cid,
                "path": rel_path,
                "type": ctype,
                "title": title,
                "frontmatter": frontmatter,
                "parameters": frontmatter.get("parameters", {}),
                "related": frontmatter.get("related", []),
                "source": frontmatter.get("source"),
                "body": body
            }
            self.concepts[rel_path] = concept_data
            self.concepts[cid] = concept_data  # index by id as well

        # 2. Build graph and check link validity
        for rel_path, concept in self.concepts.items():
            if not rel_path.endswith(".md"):
                continue  # skip ID aliases

            self.graph_nodes.append({
                "id": concept["id"],
                "path": rel_path,
                "label": concept["title"],
                "type": concept["type"]
            })

            # Check related links in frontmatter
            for rel in concept.get("related", []):
                target_path = rel
                if target_path in self.concepts:
                    target_id = self.concepts[target_path]["id"]
                    self.graph_links.append({
                        "source": concept["id"],
                        "target": target_id,
                        "relation": "related"
                    })
                else:
                    self.broken_links.append(f"Broken link in '{rel_path}': target '{rel}' not found.")

            # Check markdown links [text](path)
            md_links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", concept["body"])
            for text, link in md_links:
                if link.startswith("http") or link.startswith("#"):
                    continue
                # Resolve relative path
                resolved = (Path(rel_path).parent / link).as_posix()
                clean_resolved = resolved.split("#")[0]
                if clean_resolved in self.concepts:
                    target_id = self.concepts[clean_resolved]["id"]
                    self.graph_links.append({
                        "source": concept["id"],
                        "target": target_id,
                        "relation": "markdown_link"
                    })

        logger.info(
            f"Loaded OKF bundle: {len(self.graph_nodes)} concepts, {len(self.graph_links)} links, "
            f"{len(self.validation_errors)} errors, {len(self.broken_links)} broken links."
        )

# Global singleton
_okf_bundle: Optional[KnowledgeBundle] = None

def get_knowledge_bundle() -> KnowledgeBundle:
    global _okf_bundle
    if _okf_bundle is None:
        _okf_bundle = KnowledgeBundle(settings.KNOWLEDGE_DIR)
    return _okf_bundle

def get_rule_parameter(rule_id: str, param_name: str, default: Any = None) -> Any:
    """
    Dynamic Parameter Binding:
    Reads non-critical thresholds from the OKF bundle.
    If bundle is missing or invalid, falls back to code defaults and logs a warning.
    """
    bundle = get_knowledge_bundle()
    params = bundle.rule_params.get(rule_id)
    if params and param_name in params:
        return params[param_name]
    return default

def reload_knowledge_bundle(db: Session, actor_id: Optional[int] = None) -> Dict[str, Any]:
    """Hot-reloads the knowledge bundle from disk and writes parameter diff to audit chain."""
    bundle = get_knowledge_bundle()
    old_params = dict(bundle.rule_params)
    
    bundle.load()
    new_params = bundle.rule_params

    # Compute parameter diff
    diff = {}
    all_rules = set(old_params.keys()).union(new_params.keys())
    for r in all_rules:
        old_r = old_params.get(r, {})
        new_r = new_params.get(r, {})
        if old_r != new_r:
            diff[r] = {"before": old_r, "after": new_r}

    # Append to audit chain
    log_audit_entry(
        db,
        action="OKF_BUNDLE_RELOADED",
        entity_type="knowledge_bundle",
        entity_id=1,
        payload={
            "concepts_count": len(bundle.graph_nodes),
            "links_count": len(bundle.graph_links),
            "parameter_diff": diff,
            "validation_errors": bundle.validation_errors,
            "broken_links": bundle.broken_links
        },
        actor_id=actor_id,
        actor_role="admin"
    )

    return {
        "status": "reloaded",
        "concepts_count": len(bundle.graph_nodes),
        "links_count": len(bundle.graph_links),
        "type_counts": bundle.type_counts,
        "parameter_diff": diff,
        "validation_errors": bundle.validation_errors,
        "broken_links": bundle.broken_links
    }
