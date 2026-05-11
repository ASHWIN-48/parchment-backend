from sentence_transformers import CrossEncoder
from app.services.embedding import embed_texts, load_index
from app.repositories.chunk_repo import ChunkRepository
from app.config import MIN_SIMILARITY, MIN_CONFIDENCE
from groq import Groq
import os
import torch
import numpy as np

_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder

    if _cross_encoder is None:
        from sentence_transformers import CrossEncoder

        _cross_encoder = CrossEncoder(
            "cross-encoder/ms-marco-MiniLM-L-6-v2"
        )

    return _cross_encoder
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class RetrievalService:
    def __init__(self, db):
        self.chunk_repo = ChunkRepository(db)

    def retrieve(self, query: str, top_k: int = 5) -> list[dict]:
    
        query_vec = embed_texts([query])
        index, chunk_ids = load_index()
        distances, indices = index.search(query_vec, top_k)
        retrieved_ids = [chunk_ids[i] for i in indices[0] if i < len(chunk_ids)]
        chunks = self.chunk_repo.get_by_ids(retrieved_ids)
        return chunks
    
    def rerank(self, query: str, chunks: list[dict]) -> list[dict]:
        pairs = [[query, chunk["text"]] for chunk in chunks]
        scores = get_cross_encoder().predict(pairs)
        scores = 1 / (1 + np.exp(-scores))
        ranked = sorted(zip(scores, chunks), key=lambda x: x[0], reverse=True)
        return [{"score": float(s), **c} for s, c in ranked]

    def get_answer(self, query: str) -> dict:
        try:
            chunks = self.retrieve(query)
        except RuntimeError as e:
            return {
                "answer": str(e),
                "sources": [],
                "confidence": 0.0,
                "tokens_used": 0
            }
        
        ranked_chunks = self.rerank(query, chunks)

        # Confidence check
        if not ranked_chunks or ranked_chunks[0]["score"] < MIN_CONFIDENCE:
            return {
                "answer": "I don't have enough information to answer this.",
                "sources": [],
                "confidence": 0.0,
                "tokens_used": 0
            }

        # Build context from top 3 chunks
        context = "\n\n".join([
            f"[Chunk {i+1}]\n{c['text']}"
            for i, c in enumerate(ranked_chunks[:3])
            ])

        # Groq call
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": """You are a precise document analysis assistant.

            Rules:
            - Answer directly and clearly — lead with the answer, not filler
            - Use bullet points or numbered lists when explaining multiple concepts
            - If the document defines something, give the definition first, then elaborate
            - Keep answers concise but complete — no padding
            - If context is insufficient, say exactly what's missing
            - Never say "based on the context" or "the document states" — just answer
            -- When explaining technical concepts, always give: definition → how it works → example"""
                },
                {   
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {query}"
                }
            ]
        )

        usage = response.usage
        answer = response.choices[0].message.content

        return {
            "answer": answer,
            "sources": [c["text"][:200] for c in ranked_chunks[:3]],
            "confidence": ranked_chunks[0]["score"],
            "tokens_used": {
                "prompt": usage.prompt_tokens,
                "completion": usage.completion_tokens,
                "total": usage.total_tokens
            }
        }