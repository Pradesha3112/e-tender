# ============================================================
# FILE: permissions.py
# PURPOSE: Central permission rules
# ============================================================

from functools import wraps
from flask import request, jsonify


# ------------------------------------------------------------
# ROLE CONSTANTS
# ------------------------------------------------------------
ROLE_ADMIN       = "admin"
ROLE_SUPER_ADMIN = "super_admin"
ROLE_CLERK       = "clerk"

ALL_ROLES = [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK]


# ------------------------------------------------------------
# PERMISSION MATRIX
# ------------------------------------------------------------
PERMISSIONS = {
    # Bill operations
    "bill.upload":          [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],
    "bill.view_all":        [ROLE_ADMIN],                                  # only admin sees everything
    "bill.view_group":      [ROLE_ADMIN, ROLE_SUPER_ADMIN],                # admin + S.A. see own group
    "bill.view_own":        [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],    # own bills
    "bill.edit_any":        [ROLE_ADMIN],
    "bill.edit_own":        [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],
    "bill.delete_any":      [ROLE_ADMIN],
    "bill.delete_own":      [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],
    "bill.export_all":      [ROLE_ADMIN],
    "bill.export_own":      [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],

    # User management
    "user.list_all":        [ROLE_ADMIN, ROLE_SUPER_ADMIN],
    "user.create_admin":    [ROLE_ADMIN],                                  # only admin can create admins... well actually admin creates super_admins
    "user.create_super":    [ROLE_ADMIN],                                  # only admin creates super_admin
    "user.create_clerk":    [ROLE_ADMIN, ROLE_SUPER_ADMIN],                # both can create clerks
    "user.edit_super":      [ROLE_ADMIN],                                  # only admin edits super_admin
    "user.edit_clerk":      [ROLE_ADMIN, ROLE_SUPER_ADMIN],
    "user.activate_super":  [ROLE_ADMIN],                                  # only admin toggles super_admin
    "user.activate_clerk":  [ROLE_ADMIN, ROLE_SUPER_ADMIN],
    "user.delete_super":    [ROLE_ADMIN],
    "user.delete_clerk":    [ROLE_ADMIN, ROLE_SUPER_ADMIN],
    "user.reset_password":  [ROLE_ADMIN, ROLE_SUPER_ADMIN],

    # Stats
    "stats.view_all":       [ROLE_ADMIN],
    "stats.view_group":     [ROLE_ADMIN, ROLE_SUPER_ADMIN],
    "stats.view_own":       [ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK],
}


# ------------------------------------------------------------
# CHECKERS
# ------------------------------------------------------------
def can(role: str, permission: str) -> bool:
    """Return True if the given role has the permission."""
    if not role or role not in ALL_ROLES:
        return False
    return role in PERMISSIONS.get(permission, [])


def is_admin(role: str) -> bool:
    return role == ROLE_ADMIN


def is_super_admin(role: str) -> bool:
    return role == ROLE_SUPER_ADMIN


def is_clerk(role: str) -> bool:
    return role == ROLE_CLERK


def can_create_role(creator_role: str, target_role: str) -> bool:
    """
    Can `creator_role` create a user with `target_role`?
    - admin       → can create super_admin, clerk (NOT another admin)
    - super_admin → can create clerk only
    - clerk       → cannot create anyone
    """
    if creator_role == ROLE_ADMIN and target_role in (ROLE_SUPER_ADMIN, ROLE_CLERK):
        return True
    if creator_role == ROLE_SUPER_ADMIN and target_role == ROLE_CLERK:
        return True
    return False


def can_manage_user(actor_role: str, target_role: str) -> bool:
    """
    Can `actor_role` edit/activate/delete a `target_role` user?
    - admin       → manages super_admin + clerk (NOT other admin)
    - super_admin → manages clerk only (NOT super_admin, NOT admin)
    - clerk       → manages nobody
    """
    if target_role == ROLE_ADMIN:
        return False  # admin is permanent — nobody edits admin
    if actor_role == ROLE_ADMIN and target_role in (ROLE_SUPER_ADMIN, ROLE_CLERK):
        return True
    if actor_role == ROLE_SUPER_ADMIN and target_role == ROLE_CLERK:
        return True
    return False


# ------------------------------------------------------------
# FLASK DECORATOR: require_permission('bill.upload')
# ------------------------------------------------------------
def require_permission(permission: str):
    """
    Flask decorator — requires request.user_role to have `permission`.
    Expects `request.current_user` to be set by an earlier auth middleware.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(request, "current_user", None)
            if not user:
                return jsonify({"success": False, "error": "Not authenticated"}), 401
            if not can(user.get("role"), permission):
                return jsonify({
                    "success": False,
                    "error": f"Permission denied: {permission}"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ------------------------------------------------------------
# VISIBILITY RULE (used by bills query)
# ------------------------------------------------------------
def build_bill_visibility_filter(user: dict) -> dict:
    """
    Returns filter dict describing which bills the user can see.
    """
    role  = user.get("role")
    uname = user.get("username")
    group = user.get("category_group", "all")

    if role == ROLE_ADMIN:
        return {"mode": "all"}                              # everything
    if role == ROLE_SUPER_ADMIN:
        return {"mode": "group", "category_group": group}   # own group
    if role == ROLE_CLERK:
        return {"mode": "own", "created_by": uname}         # own bills only
    return {"mode": "none"}