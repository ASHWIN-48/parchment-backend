from bson import ObjectId
from datetime import datetime, timezone

class DocumentRepository:
    def __init__(self, db):
        self.collection = db["documents"]

    def insert_one(self, document: dict) -> str:
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def get_by_id(self, document_id: str) -> dict | None:
        return self.collection.find_one({"_id": ObjectId(document_id)})

    def get_all(self) -> list[dict]:
        return list(self.collection.find())

    def update_status(self, document_id: str, status: str) -> bool:
        result = self.collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
        )
        return result.modified_count > 0

    def delete_by_id(self, document_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(document_id)})
        return result.deleted_count > 0
    
    def get_by_session(self, session_id: str) -> list[dict]:
        return list(self.collection.find({"session_id": session_id}))