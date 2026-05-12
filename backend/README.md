# Parchment — Document Intelligence

Upload a PDF. Ask questions in natural language. Get grounded answers using semantic retrieval + LLM inference.

**Live Demo:**  
https://parchment-gamma.vercel.app/

---

## Features

- Semantic PDF retrieval
- FAISS vector search
- Cross-encoder reranking
- Confidence-based answer rejection
- Source attribution
- Session-isolated document storage
- React + FastAPI full-stack architecture
- Railway + Vercel deployment

---

## Architecture

### Ingestion Pipeline

```text
PDF Upload
→ Text Extraction (PyMuPDF)
→ Chunking (500 chars, 50 overlap)
→ Embedding (SentenceTransformers: all-MiniLM-L6-v2)
→ FAISS IndexFlatL2
→ MongoDB persistence
```

### Query Pipeline

```text
User Query
→ Query embedding
→ FAISS similarity retrieval (top-k)
→ Cross-encoder reranking
→ Confidence thresholding
→ Groq LLM inference
→ Answer + sources + confidence
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, FastAPI |
| Frontend | React, Vite |
| Embeddings | SentenceTransformers (`all-MiniLM-L6-v2`) |
| Vector Search | FAISS (`IndexFlatL2`) |
| Reranking | CrossEncoder (`ms-marco-MiniLM-L-6-v2`) |
| LLM | Groq API (`llama-3.1-8b-instant`) |
| Database | MongoDB Atlas |
| Deployment | Railway + Vercel |

---

## Project Structure

```text
backend/
├── app/
│   ├── routes/          # upload, ask, documents
│   ├── services/        # retrieval + ingestion logic
│   ├── repositories/    # MongoDB data layer
│   ├── config.py
│   ├── db.py
│   └── main.py

frontend/
├── src/
│   ├── api/
│   └── App.jsx
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Upload and index PDF |
| POST | `/ask` | Query indexed document |
| GET | `/documents` | Fetch uploaded documents |
| DELETE | `/documents/{id}` | Delete document |

---

## Setup

### Backend

```bash
cd backend

python -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

Create `.env`

```env
MONGO_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_api_key
```

Run backend:

```bash
uvicorn app.main:app --reload --port 8000
```

---

### Frontend

```bash
cd frontend

npm install
npm run dev
```

Create `.env`

```env
VITE_API_URL=http://localhost:8000
```

---

## Design Decisions

### Why two-stage retrieval?

FAISS retrieval is fast but approximate.  
Cross-encoder reranking improves precision by scoring query-passage pairs directly.

This provides:
- fast retrieval
- better semantic accuracy
- scalable inference

---

### Why confidence thresholding?

If retrieved context is weak, the system avoids hallucination and returns:

```text
"I don't have enough information in the document."
```

Grounded failure is preferred over fabricated answers.

---

### Why MongoDB-backed vector persistence?

Cloud deployments use ephemeral filesystems.  
MongoDB persistence prevents vector/index loss across redeploys and restarts.

---

## Current Limitations

- No authentication yet
- Free-tier cold starts (~20–30s)
- Cross-encoder reranking adds latency
- Large PDFs increase embedding time

---

## Future Improvements

- Multi-document retrieval
- Streaming responses
- OCR support for scanned PDFs
- Redis caching
- Hybrid BM25 + vector retrieval
- Dockerized deployment

---

## Author

Ashwin Sharma  
B.Tech CSE — VIT Bhopal  
AI Backend Engineering · Retrieval Systems · Full Stack AI Applications
