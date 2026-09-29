# ============================================================
# FILE: auth.py
# PURPOSE: Authentication — login, hashing, JWT, middleware
# ============================================================

import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from permissions import ROLE_ADMIN


# ------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------
JWT_SECRET       = os.getenv("JWT_SECRET", "railway-ebilling-secret-change-me")
JWT_ALGORITHM    = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "12"))

# Hardcoded admin (bootstrap)
HARDCODED_ADMIN_USERNAME = "admin"
HARDCODED_ADMIN_PASSWORD = "admin"
ADMIN_BOOTSTRAP_HASH     = "ADMIN_HARDCODED_NO_HASH"


# ------------------------------------------------------------
# PASSWORD HELPERS
# ------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Generate a secure password hash."""
    return generate_password_hash(plain, method="pbkdf2:sha256")


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain password against a stored hash."""
    if not hashed or hashed == ADMIN_BOOTSTRAP_HASH:
        return False
    try:
        return check_password_hash(hashed, plain)
    except Exception:
        return False


# ------------------------------------------------------------
# JWT HELPERS
# ------------------------------------------------------------
def create_token(user: dict) -> str:
    """Create a JWT for a user dict."""
    payload = {
        "sub":            user.get("username"),
        "role":           user.get("role"),
        "full_name":      user.get("full_name"),
        "category_group": user.get("category_group", "all"),
        "iat":            datetime.utcnow(),
        "exp":            datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode a JWT and return its payload, or None if invalid/expired."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_token_from_request() -> str | None:
    """Read the token from the Authorization header."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


# ------------------------------------------------------------
# LOGIN LOGIC
# ------------------------------------------------------------
def is_hardcoded_admin(username: str, password: str) -> bool:
    """Check if credentials match the hardcoded admin."""
    return (
        username.strip().lower() == HARDCODED_ADMIN_USERNAME
        and password == HARDCODED_ADMIN_PASSWORD
    )


def build_admin_user(db=None) -> dict:
    """
    Return the hardcoded admin as a user dict.
    If a DB row exists for 'admin', use its real id so password updates work.
    """
    real_id = 0
    if db is not None and db.connection:
        row = db.get_user_by_username(HARDCODED_ADMIN_USERNAME)
        if row and row.get("id"):
            real_id = row["id"]

    return {
        "id":             real_id,
        "username":       HARDCODED_ADMIN_USERNAME,
        "full_name":      "System Administrator",
        "role":           ROLE_ADMIN,
        "category_group": "all",
        "designation":    "System Administrator",
        "is_active":      1,
    }


def authenticate(db, username: str, password: str) -> dict | None:
    """
    Authenticate a user.

    Admin flow:
      1. If DB has a real password_hash for admin → verify against it.
      2. If DB has ADMIN_BOOTSTRAP_HASH → fall back to hardcoded admin/admin.
      3. If no DB row for admin → allow hardcoded admin/admin (bootstrap).

    Other users: DB-only.
    """
    username = (username or "").strip()

    # ----- ADMIN path -----
    if username.lower() == HARDCODED_ADMIN_USERNAME:
        admin_row = db.get_user_by_username(HARDCODED_ADMIN_USERNAME) if db else None

        # Case 1: DB has a real hash → use it (custom password set)
        if (admin_row
                and admin_row.get("password_hash")
                and admin_row["password_hash"] != ADMIN_BOOTSTRAP_HASH):
            if verify_password(password, admin_row["password_hash"]):
                admin_row.pop("password_hash", None)
                admin_row["role"] = ROLE_ADMIN
                return admin_row
            return None  # custom password set → admin/admin no longer valid

        # Case 2: bootstrap hash OR no DB row → allow hardcoded
        if is_hardcoded_admin(username, password):
            if admin_row:
                admin_row.pop("password_hash", None)
                admin_row["role"] = ROLE_ADMIN
                return admin_row
            return build_admin_user(db)   # ← pass db so it picks real id
        return None

    # ----- OTHER USERS path -----
    if not db or not db.connection:
        return None

    user = db.get_user_by_username(username)
    if not user:
        return None
    if not user.get("is_active"):
        return None
    if not verify_password(password, user.get("password_hash")):
        return None

    user.pop("password_hash", None)
    return user


# ------------------------------------------------------------
# FLASK MIDDLEWARE: attach user to request
# ------------------------------------------------------------
def load_current_user():
    """
    Read the JWT from the request and attach the decoded user to
    request.current_user. Called before each request.
    """
    request.current_user = None

    token = extract_token_from_request()
    if not token:
        return

    payload = decode_token(token)
    if not payload:
        return

    request.current_user = {
        "username":       payload.get("sub"),
        "role":           payload.get("role"),
        "full_name":      payload.get("full_name"),
        "category_group": payload.get("category_group", "all"),
    }


# ------------------------------------------------------------
# FLASK DECORATOR: require_auth
# ------------------------------------------------------------
def require_auth(fn):
    """Decorator — ensures request.current_user is set."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not getattr(request, "current_user", None):
            return jsonify({"success": False, "error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper


# ------------------------------------------------------------
# FLASK DECORATOR: require_roles('admin','super_admin')
# ------------------------------------------------------------
def require_roles(*allowed_roles):
    """Decorator — ensures request.current_user.role is in allowed_roles."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(request, "current_user", None)
            if not user:
                return jsonify({"success": False, "error": "Not authenticated"}), 401
            if user.get("role") not in allowed_roles:
                return jsonify({
                    "success": False,
                    "error": f"Role '{user.get('role')}' not allowed"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator