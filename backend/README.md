# Parchment — Document Intelligence

Upload a PDF. Ask questions in natural language. Get answers grounded in your document.

**Live Demo:** https://parchment-ashwin-sharma-s-projects.vercel.app

---

## Architecture
PDF Upload → Text Extraction (PyMuPDF)
→ Chunking with overlap (500 chars, 50 overlap)
→ Embedding (SentenceTransformers: all-MiniLM-L6-v2)
→ FAISS IndexFlatL2 (stored in MongoDB)
Query     → Embed query (same model)
→ FAISS similarity search (top 5)
→ Cross-encoder reranking (ms-marco-MiniLM-L-6-v2)
→ Confidence threshold check (MIN: 0.30)
→ Groq LLM inference (llama-3.1-8b-instant)
→ Answer + sources + confidence + token cost

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| Embeddings | SentenceTransformers (all-MiniLM-L6-v2) |
| Vector Search | FAISS (IndexFlatL2) |
| Reranking | CrossEncoder (ms-marco-MiniLM-L-6-v2) |
| LLM | Groq API (llama-3.1-8b-instant) |
| Database | MongoDB Atlas |
| Frontend | React, Vite |
| Deployment | Railway (backend), Vercel (frontend) |

## Project Structure
backend/
├── app/
│   ├── routes/          # HTTP layer — upload, ask, documents
│   ├── services/        # Business logic — ingest, embedding, retrieval
│   ├── repositories/    # MongoDB layer — chunk_repo, document_repo
│   ├── config.py        # Constants and env vars
│   ├── db.py            # MongoDB connection
│   └── main.py          # FastAPI app init

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /upload | Upload PDF, chunk, embed, index |
| POST | /ask | Query with natural language |
| GET | /documents | List all documents |
| DELETE | /documents/{id} | Delete document and chunks |

## Setup

```bash
# Clone and install
git clone https://github.com/ASHWIN-48/parchment-backend
cd parchment-backend
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Add MONGO_URI and GROQ_API_KEY

# Run
uvicorn app.main:app --reload --port 8000
```

## Design Decisions

**Why FAISS + Cross-encoder (two-stage retrieval)?**
FAISS bi-encoder is fast but approximate — it finds candidates in milliseconds. Cross-encoder then scores each candidate against the query precisely. Two-stage gives speed + accuracy.

**Why store FAISS index in MongoDB?**
Cloud deployments have ephemeral filesystems — files are wiped on redeploy. MongoDB persists across deploys.

**Why confidence scoring?**
Rather than hallucinating an answer when context is weak, the system returns "I don't have enough information." Honesty over completeness.

## Known Limitations

- Single document indexed at a time (multi-doc FAISS merge planned)
- Free tier cold starts (~30s after inactivity)
- Cross-encoder adds ~2s latency per query