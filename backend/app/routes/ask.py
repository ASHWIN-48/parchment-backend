from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.retrieval import RetrievalService
from app.db import get_db

router = APIRouter()

class QueryRequest(BaseModel):
    question: str

@router.post("/ask")
async def ask_question(body: QueryRequest):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    db = get_db()
    retrieval_service = RetrievalService(db)
    result = retrieval_service.get_answer(body.question)

    return result


@router.get("/debug")
async def debug():
    from app.services.embedding import load_index, embed_texts
    from app.repositories.chunk_repo import ChunkRepository
    db = get_db()
    
    # check index exists
    index, chunk_ids = load_index()
    
    # check chunks in mongo
    chunk_repo = ChunkRepository(db)
    test_query = embed_texts(["what is java"])
    distances, indices = index.search(test_query, 3)
    
    retrieved_ids = [chunk_ids[i] for i in indices[0] if i < len(chunk_ids)]
    chunks = chunk_repo.get_by_ids(retrieved_ids)
    
    return {
        "index_size": index.ntotal,
        "chunk_ids_count": len(chunk_ids),
        "retrieved": [c["text"][:100] for c in chunks],
        "distances": distances[0].tolist()
    }