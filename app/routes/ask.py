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