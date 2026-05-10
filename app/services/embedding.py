from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle
from app.config import FAISS_INDEX_PATH, CHUNK_ID_MAP_PATH
import io
from app.db import get_db

_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def embed_texts(texts: list[str]):
    return get_model().encode(texts, convert_to_numpy=True)

def build_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index



def save_index(index: faiss.Index, chunk_ids: list[str]):
    # serialize to bytes
    buf = io.BytesIO()
    faiss.write_index(index, faiss.PyCallbackIOWriter(buf.write))
    index_bytes = buf.getvalue()
    chunk_ids_bytes = pickle.dumps(chunk_ids)
    
    db = get_db()
    db["faiss_store"].replace_one(
        {"_id": "main"},
        {
            "_id": "main",
            "index_bytes": index_bytes,
            "chunk_ids_bytes": chunk_ids_bytes
        },
        upsert=True
    )

def load_index() -> tuple[faiss.Index, list[str]]:
    db = get_db()
    doc = db["faiss_store"].find_one({"_id": "main"})
    
    if not doc:
        raise RuntimeError("No FAISS index found. Upload a document first.")
    
    buf = io.BytesIO(doc["index_bytes"])
    index = faiss.read_index(faiss.PyCallbackIOReader(buf.read))
    chunk_ids = pickle.loads(doc["chunk_ids_bytes"])
    
    return index, chunk_ids