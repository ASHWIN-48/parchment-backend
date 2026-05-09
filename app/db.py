from app.config import MONGO_URI, DB_NAME
from pymongo import MongoClient

_client = None

def get_db():
    global _client
    if _client is None:
        if not MONGO_URI:
            raise ValueError("MONGO_URI not set in environment")
        _client = MongoClient(MONGO_URI)
    return _client[DB_NAME]