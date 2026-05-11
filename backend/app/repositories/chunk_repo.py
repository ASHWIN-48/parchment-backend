from bson import ObjectId

class ChunkRepository:
    def __init__(self, db):
        self.collection = db["chunks"]

    def insert_many(self, chunks: list[dict]) -> list[str]:
        result = self.collection.insert_many(chunks)
        return [str(id) for id in result.inserted_ids]

    def get_by_ids(self, ids: list[str]) -> list[dict]:
        object_ids = [ObjectId(id) for id in ids]
        return list(self.collection.find({"_id": {"$in": object_ids}}))

    def get_by_document_id(self, document_id: str) -> list[dict]:
        return list(self.collection.find({"document_id": document_id}))

    def delete_by_document_id(self, document_id: str) -> int:
        result = self.collection.delete_many({"document_id": document_id})
        return result.deleted_count