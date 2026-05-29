"""
User Authentication Database
Stores user credentials and session information
"""

import sqlite3
import os
from datetime import datetime, timedelta
import hashlib
import secrets

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "users.db")

def init_db():
    """Initialize user database with tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    )
    """)
    
    # Sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # Saved trips table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        trip_name TEXT NOT NULL,
        province TEXT,
        start_lat REAL,
        start_lon REAL,
        itinerary_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")

def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${pwd_hash.hex()}"

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    try:
        salt, pwd_hash = password_hash.split('$')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return new_hash.hex() == pwd_hash
    except:
        return False

def create_user(username: str, email: str, password: str) -> dict:
    """Create new user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        password_hash = hash_password(password)
        cursor.execute("""
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
        """, (username, email, password_hash))
        
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        
        return {"success": True, "user_id": user_id, "username": username}
    except sqlite3.IntegrityError as e:
        return {"success": False, "error": "Username or email already exists"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def authenticate_user(username: str, password: str) -> dict:
    """Authenticate user and return user data"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, username, email, password_hash FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return {"success": False, "error": "User not found"}
        
        user_id, user_name, email, password_hash = user
        
        if not verify_password(password, password_hash):
            conn.close()
            return {"success": False, "error": "Invalid password"}
        
        # Update last login
        cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "user_id": user_id,
            "username": user_name,
            "email": email
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def create_session(user_id: int) -> dict:
    """Create session token for user"""
    try:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=7)
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
        INSERT INTO sessions (user_id, token, expires_at)
        VALUES (?, ?, ?)
        """, (user_id, token, expires_at))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "token": token, "expires_at": expires_at.isoformat()}
    except Exception as e:
        return {"success": False, "error": str(e)}

def verify_session(token: str) -> dict:
    """Verify session token"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
        SELECT user_id, expires_at FROM sessions WHERE token = ?
        """, (token,))
        
        session = cursor.fetchone()
        
        if not session:
            conn.close()
            return {"success": False, "error": "Invalid token"}
        
        user_id, expires_at_str = session
        expires_at = datetime.fromisoformat(expires_at_str)
        
        if datetime.now() > expires_at:
            conn.close()
            return {"success": False, "error": "Token expired"}
        
        cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return {"success": False, "error": "User not found"}
        
        return {
            "success": True,
            "user_id": user[0],
            "username": user[1],
            "email": user[2]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

def logout_session(token: str) -> dict:
    """Delete session token"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Initialize DB on import
if not os.path.exists(DB_PATH):
    init_db()
