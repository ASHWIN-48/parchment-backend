import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import upload, ask, documents
from contextlib import asynccontextmanager
from app.services.embedding import get_model

@asynccontextmanager
async def lifespan(app):
    # pre-load model in background on startup
    import threading
    threading.Thread(target=get_model, daemon=True).start()
    yield

app = FastAPI(title="RAG Document QA", lifespan=lifespan)

app = FastAPI(title="RAG Document QA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(documents.router)