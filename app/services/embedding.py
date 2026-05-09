from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import pickle
from app.config import FAISS_INDEX_PATH, CHUNK_ID_MAP_PATH

model = SentenceTransformer("all-MiniLM-L6-v2")

def embed_texts(texts: list[str]) -> np.ndarray:
    return model.encode(texts, convert_to_numpy=True)

def build_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    return index

def save_index(index: faiss.Index, chunk_ids: list[str]):
    faiss.write_index(index, str(FAISS_INDEX_PATH))
    with open(CHUNK_ID_MAP_PATH, "wb") as f:
        pickle.dump(chunk_ids, f)

def load_index() -> tuple[faiss.Index, list[str]]:
    index = faiss.read_index(str(FAISS_INDEX_PATH))
    with open(CHUNK_ID_MAP_PATH, "rb") as f:
        chunk_ids = pickle.load(f)
    return index, chunk_ids