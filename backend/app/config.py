import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# MongoDB
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "doc_intelligence"

# Models
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

# Retrieval
TOP_K = 5
RERANK_TOP_K = 3
MIN_SIMILARITY = 0.45
MIN_CONFIDENCE = 0.10

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent  # points to backend/
UPLOAD_DIR = BASE_DIR / "uploads"
INDEX_DIR = BASE_DIR / "indices"
FAISS_INDEX_PATH = INDEX_DIR / "faiss_index.bin"
CHUNK_ID_MAP_PATH = INDEX_DIR / "chunk_id_map.pkl"

UPLOAD_DIR.mkdir(exist_ok=True)
INDEX_DIR.mkdir(exist_ok=True)