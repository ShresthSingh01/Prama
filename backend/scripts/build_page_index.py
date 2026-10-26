import os
from pathlib import Path
from backend.app.services.document_index import get_document_index
from backend.app.core.config import settings

def build_all_indices():
    sources_dir = Path(settings.KNOWLEDGE_SOURCES_DIR)
    if not sources_dir.exists():
        print(f"Sources directory '{sources_dir}' does not exist.")
        return

    indexer = get_document_index()
    pdf_files = list(sources_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"No PDFs found in '{sources_dir}'.")
        return

    for pdf in pdf_files:
        print(f"Indexing PDF: {pdf.name}...")
        doc_id = indexer.build(str(pdf))
        print(f"Successfully built and cached PageIndex tree for '{doc_id}' in doc_index_cache.")

if __name__ == "__main__":
    build_all_indices()
