"""
Standalone Non-Destructive MongoDB Connection Verifier for TripNest Backend.
Executes only a read-only admin ping without inserting, updating, dropping,
seeding, or modifying any data or collections.
All credentials and secrets are strictly redacted from any error outputs.
"""
import asyncio
import os
import re
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.env_loader import load_env_file


def redact_secrets(message: str) -> str:
    """Redacts passwords, tokens, and credentials from exception messages."""
    if not message:
        return ""
    # Redact :password@ in URIs
    message = re.sub(r":([^@/:\s]+)@", ":<REDACTED>@", str(message))
    message = re.sub(r"mongodb(\+srv)?://([^@]+)@", r"mongodb\1://<USER>:<REDACTED>@", message)
    return message


async def verify_connection():
    load_env_file()
    uri = os.getenv("MONGODB_URI", "").strip()
    db_name = os.getenv("MONGODB_DB_NAME", "travelIntelligence").strip()

    # Verify configuration completeness
    expected_user = "intoxicatedone26_db_user"
    expected_host = "tripnestmobile.tzvdb7f.mongodb.net"
    expected_db = "travelIntelligence"

    has_expected_user = f"://{expected_user}:" in uri
    has_target_host = expected_host in uri
    is_placeholder = any(p in uri for p in ["<ENTER_NEW_PASSWORD_HERE>", "ENTER_NEW_PASSWORD", "<PASSWORD>"])
    is_db_valid = (db_name == expected_db)
    config_complete = bool(uri and (not is_placeholder) and has_expected_user and has_target_host and is_db_valid)

    print(f"CONFIGURATION_COMPLETE: {'yes' if config_complete else 'no'}")

    if not config_complete:
        print("MONGODB_PING_SUCCESSFUL: no")
        if is_placeholder:
            print("ERROR: Password placeholder is still present in .env")
        elif not has_expected_user:
            print(f"ERROR: Expected username '{expected_user}' was not found in MONGODB_URI")
        elif not has_target_host:
            print(f"ERROR: Expected host '{expected_host}' was not found in MONGODB_URI")
        elif not is_db_valid:
            print(f"ERROR: Expected database name '{expected_db}', but found '{db_name}'")
        else:
            print("ERROR: Incomplete or missing MONGODB_URI")
        print("RECORDS_MODIFIED: 0 (No connection attempted)")
        return

    # Strictly read-only connection test
    from motor.motor_asyncio import AsyncIOMotorClient

    client = None
    try:
        # 5 second timeout for ping
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        await asyncio.wait_for(client.admin.command("ping"), timeout=6.0)
        print("MONGODB_PING_SUCCESSFUL: yes")
        print("ERROR: None")
        print("RECORDS_MODIFIED: 0 (Strictly read-only ping command executed)")
    except Exception as exc:
        redacted_err = redact_secrets(str(exc))
        print("MONGODB_PING_SUCCESSFUL: no")
        print(f"ERROR: {redacted_err}")
        print("RECORDS_MODIFIED: 0 (No data modified)")
    finally:
        if client:
            client.close()


if __name__ == "__main__":
    asyncio.run(verify_connection())
