import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import upload, ask, documents

app = FastAPI(title="RAG Document QA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://parchment-ashwin-sharma-s-projects.vercel.app"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(documents.router)