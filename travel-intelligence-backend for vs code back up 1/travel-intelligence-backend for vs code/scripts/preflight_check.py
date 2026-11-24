"""
Strictly Read-Only Preflight Check for MongoDB Atlas 'travelIntelligence' Database.
Performs only read-only queries to check user existence and potential unique-index conflicts.
DOES NOT insert, update, delete, seed, migrate, or create any indexes.
All credentials, emails, and sensitive user fields are strictly kept private.
"""
import asyncio
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.env_loader import load_env_file


def redact_secrets(message: str) -> str:
    if not message:
        return ""
    message = re.sub(r":([^@/:\s]+)@", ":<REDACTED>@", str(message))
    message = re.sub(r"mongodb(\+srv)?://([^@]+)@", r"mongodb\1://<USER>:<REDACTED>@", message)
    return message


async def run_preflight():
    load_env_file()
    uri = os.getenv("MONGODB_URI", "").strip()
    db_name = os.getenv("MONGODB_DB_NAME", "travelIntelligence").strip()

    from motor.motor_asyncio import AsyncIOMotorClient

    client = None
    try:
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        db = client[db_name]

        # 1. Check existing collections in the database
        existing_collections = await db.list_collection_names()

        # 2. Check existence of demo and admin users (read-only count query)
        demo_exists = False
        admin_exists = False
        if "users" in existing_collections:
            users_col = db["users"]
            demo_count = await users_col.count_documents({"username": "demo"}, limit=1)
            demo_exists = bool(demo_count > 0)
            admin_count = await users_col.count_documents({"username": "admin"}, limit=1)
            admin_exists = bool(admin_count > 0)

        # 3. Check for unique index conflicts in existing collections
        unique_checks = [
            ("users", "users.username", [{"$match": {"username": {"$exists": True, "$ne": None}}}, {"$group": {"_id": "$username", "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
            ("users", "users.email", [{"$match": {"email": {"$exists": True, "$ne": None}}}, {"$group": {"_id": "$email", "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
            ("sessions", "sessions.token", [{"$match": {"token": {"$exists": True, "$ne": None}}}, {"$group": {"_id": "$token", "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
            ("trips", "trips.(userId, tripId)", [{"$match": {"userId": {"$exists": True}, "tripId": {"$exists": True}}}, {"$group": {"_id": {"userId": "$userId", "tripId": "$tripId"}, "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
            ("follows", "follows.(followerId, followingId)", [{"$match": {"followerId": {"$exists": True}, "followingId": {"$exists": True}}}, {"$group": {"_id": {"followerId": "$followerId", "followingId": "$followingId"}, "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
            ("trip_members", "trip_members.(tripId, userId)", [{"$match": {"tripId": {"$exists": True}, "userId": {"$exists": True}}}, {"$group": {"_id": {"tripId": "$tripId", "userId": "$userId"}, "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": 1}}}, {"$limit": 1}]),
        ]

        conflicts = []
        for col_name, index_desc, pipeline in unique_checks:
            if col_name in existing_collections:
                cursor = db[col_name].aggregate(pipeline)
                dups = await cursor.to_list(length=1)
                if dups:
                    conflicts.append(index_desc)

        # Output results clearly
        print(f"DATABASE_CHECKED: {db_name}")
        print(f"DEMO_EXISTS: {'yes' if demo_exists else 'no'}")
        print(f"ADMIN_EXISTS: {'yes' if admin_exists else 'no'}")
        print(f"UNIQUE_CONFLICTS_DETECTED: {'yes' if conflicts else 'no'}")
        if conflicts:
            print(f"CONFLICT_DETAILS: {', '.join(conflicts)}")
        else:
            print("CONFLICT_DETAILS: None")
        print("RECORDS_OR_INDEXES_MODIFIED: 0 (Strictly read-only preflight queries)")

    except Exception as exc:
        redacted = redact_secrets(str(exc))
        print(f"PREFLIGHT_ERROR: {redacted}")
        print("RECORDS_OR_INDEXES_MODIFIED: 0 (No data altered)")
    finally:
        if client:
            client.close()


if __name__ == "__main__":
    asyncio.run(run_preflight())
