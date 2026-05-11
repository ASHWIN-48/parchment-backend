import fitz  # PyMuPDF
from app.repositories.chunk_repo import ChunkRepository
from app.repositories.document_repo import DocumentRepository
from datetime import datetime, timezone

def extract_text(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    return " ".join(page.get_text() for page in doc)

def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

class IngestService:
    def __init__(self, db):
        self.chunk_repo = ChunkRepository(db)
        self.doc_repo = DocumentRepository(db)

    def ingest(self, filename: str, file_bytes: bytes,session_id: str = "default", chunk_size: int = 500, overlap: int = 50) -> dict:
        # Step 1 - save document as processing
        doc_id = self.doc_repo.insert_one({
            "filename": filename,
            "status": "processing",
            "chunk_count": 0,
            "session_id": session_id or "default",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        })

        # Step 2 - extract + chunk
        text = extract_text(file_bytes)
        chunks = chunk_text(text, chunk_size, overlap)

        # Step 3 - save chunks
        chunk_docs = [
            {
                "document_id": doc_id,
                "chunk_index": i,
                "text": chunk,
                "embedding": []
            }
            for i, chunk in enumerate(chunks)
        ]
        self.chunk_repo.insert_many(chunk_docs)

        # Step 4 - update document status to ready
        self.doc_repo.update_status(doc_id, "ready")
        self.doc_repo.collection.update_one(
            {"_id": __import__('bson').ObjectId(doc_id)},
            {"$set": {"chunk_count": len(chunks)}}
        )

        return {"document_id": doc_id, "chunk_count": len(chunks)}