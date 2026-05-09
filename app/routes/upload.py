from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.ingest import IngestService
from app.services.embedding import embed_texts, build_faiss_index, save_index
from app.repositories.chunk_repo import ChunkRepository
from app.db import get_db

router = APIRouter()

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    db = get_db()
    file_bytes = await file.read()

    # Step 1 - ingest (chunk + save to mongo)
    ingest_service = IngestService(db)
    result = ingest_service.ingest(file.filename, file_bytes)

    # Step 2 - load all chunks for this document
    chunk_repo = ChunkRepository(db)
    chunks = chunk_repo.get_by_document_id(result["document_id"])

    # Step 3 - embed + build FAISS index
    texts = [c["text"] for c in chunks]
    chunk_ids = [str(c["_id"]) for c in chunks]
    embeddings = embed_texts(texts)
    index = build_faiss_index(embeddings)
    save_index(index, chunk_ids)

    return {
        "document_id": result["document_id"],
        "chunk_count": result["chunk_count"],
        "status": "ready"
    }