"""
database.py
SQLite Database Module for FL-IDS.
Manages schemas, user sessions registry, threat logs audit trailing,
and training metrics storage.
"""
import sqlite3
import os
import hashlib

# Graceful fallback if bcrypt native binary is missing
try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

DB_FILE = 'database.db'

def hash_password(password_str: str) -> str:
    """Hashes a password using bcrypt if available, or sha256 as a safe fallback."""
    if HAS_BCRYPT:
        return bcrypt.hashpw(password_str.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    return "sha256$" + hashlib.sha256(password_str.encode('utf-8')).hexdigest()

def verify_password(password_str: str, stored_hash: str) -> bool:
    """Verifies a password against the stored hash."""
    if stored_hash.startswith("sha256$"):
        return stored_hash == "sha256$" + hashlib.sha256(password_str.encode('utf-8')).hexdigest()
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(password_str.encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            pass
    return False

def get_db_connection():
    """Establishes connection to the SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Returns query results as dictionaries
    return conn

def init_db():
    """Initializes tables and seeds a default administrator account."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Create Users Table (for Flask-Login Authentication)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')

    # 2. Create Threat Logs Table (for Banking simulation auditing)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS threat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            source_ip TEXT NOT NULL,
            target_node INTEGER NOT NULL,
            attack_type TEXT NOT NULL,
            status TEXT NOT NULL,
            confidence REAL NOT NULL
        )
    ''')

    # 3. Create Training Metrics Table (for Chart.js plots)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS training_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            round_number INTEGER UNIQUE NOT NULL,
            accuracy REAL NOT NULL,
            loss REAL NOT NULL,
            epsilon REAL NOT NULL
        )
    ''')

    conn.commit()

    # Seed Default User: admin / admin123 (Only if user table is empty)
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        username = 'admin'
        password_hash = hash_password('admin123')
        
        cursor.execute(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            (username, password_hash)
        )
        conn.commit()
        print("[*] Database seeded with default user: admin / admin123")

    conn.close()

# Helper Functions for Users
def get_user_by_id(user_id):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return user

def get_user_by_username(username):
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return user

# Helper Functions for Threat Logging
def insert_threat_log(source_ip, target_node, attack_type, status, confidence):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO threat_logs (source_ip, target_node, attack_type, status, confidence)
        VALUES (?, ?, ?, ?, ?)
    ''', (source_ip, target_node, attack_type, status, confidence))
    conn.commit()
    conn.close()

def get_recent_threat_logs(limit=20):
    conn = get_db_connection()
    logs = conn.execute('''
        SELECT id, strftime('%H:%M:%S', timestamp, 'localtime') as time_str, 
               source_ip, target_node, attack_type, status, confidence 
        FROM threat_logs 
        ORDER BY id DESC LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(log) for log in logs]

# Helper Functions for Training Metrics
def insert_training_metric(round_number, accuracy, loss, epsilon):
    conn = get_db_connection()
    try:
        conn.execute('''
            INSERT OR REPLACE INTO training_metrics (round_number, accuracy, loss, epsilon)
            VALUES (?, ?, ?, ?)
        ''', (round_number, accuracy, loss, epsilon))
        conn.commit()
    except sqlite3.Error as e:
        print(f"[!] SQLite Error in training metrics insertion: {e}")
    finally:
        conn.close()

def get_all_training_metrics():
    conn = get_db_connection()
    metrics = conn.execute('SELECT * FROM training_metrics ORDER BY round_number ASC').fetchall()
    conn.close()
    return [dict(m) for m in metrics]

if __name__ == '__main__':
    init_db()
    print("[*] SQLite database initialized successfully.")