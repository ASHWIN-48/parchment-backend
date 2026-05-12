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



def save_index(
    index: faiss.Index,
    chunk_ids: list[str],
    session_id: str
):
    import tempfile, os

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp:
        tmp_path = tmp.name

    faiss.write_index(index, tmp_path)

    with open(tmp_path, "rb") as f:
        index_bytes = f.read()

    os.unlink(tmp_path)

    chunk_ids_bytes = pickle.dumps(chunk_ids)

    db = get_db()

    db["faiss_store"].replace_one(
        {"_id": session_id},
        {
            "_id": session_id,
            "index_bytes": index_bytes,
            "chunk_ids_bytes": chunk_ids_bytes,
        },
        upsert=True
    )


def load_index(session_id: str) -> tuple[faiss.Index, list[str]]:
    import tempfile, os

    db = get_db()
    print("LOADING INDEX FOR:", session_id)

    doc = db["faiss_store"].find_one({"_id": session_id})

    if not doc:
        raise RuntimeError("No FAISS index found for this session.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp:
        tmp.write(doc["index_bytes"])
        tmp_path = tmp.name

    index = faiss.read_index(tmp_path)

    os.unlink(tmp_path)

    chunk_ids = pickle.loads(doc["chunk_ids_bytes"])

    return index, chunk_ids