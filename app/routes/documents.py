from fastapi import APIRouter, HTTPException
from app.repositories.document_repo import DocumentRepository
from app.repositories.chunk_repo import ChunkRepository
from app.db import get_db

router = APIRouter()

@router.get("/documents")
async def list_documents():
    db = get_db()
    doc_repo = DocumentRepository(db)
    docs = doc_repo.get_all()
    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs

@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    db = get_db()
    doc_repo = DocumentRepository(db)
    chunk_repo = ChunkRepository(db)

    deleted = doc_repo.delete_by_id(document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")

    chunk_repo.delete_by_document_id(document_id)

    return {"deleted": document_id}