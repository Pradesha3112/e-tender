# ============================================================
# FILE: app.py
# PURPOSE: Flask API with RBAC
# ============================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr_simple import extract_text_from_image
from mysql_client import MySQLClient

from auth import (
    authenticate, create_token, hash_password, verify_password,
    load_current_user, require_auth, require_roles,
    HARDCODED_ADMIN_USERNAME,
)
from permissions import (
    ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK,
    can_create_role, can_manage_user, can,
)
from categories import build_category_payload, get_group_for_category

import traceback
import json
import os

app = Flask(__name__)

# Enable CORS
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True
    }
})

# Initialize MySQL
db = MySQLClient()


# ============================================================
# AUTH MIDDLEWARE (runs before every request)
# ============================================================
@app.before_request
def _load_user():
    if request.method == "OPTIONS":
        return  # let CORS preflight pass
    load_current_user()


# ============================================================
# PUBLIC ROUTES
# ============================================================
@app.route('/')
def home():
    return "Bill Scanner API (RBAC enabled) is working! 🎉"


@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json or {}
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({
                'success': False,
                'error': 'Username and password required'
            }), 400

        user = authenticate(db, username, password)
        if not user:
            return jsonify({
                'success': False,
                'error': 'Invalid credentials or inactive account'
            }), 401

        # Update last_login (skip for hardcoded admin)
        if user.get('id', 0) != 0:
            db.touch_last_login(user['username'])

        token = create_token(user)

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': {
                'id':             user.get('id'),
                'username':       user.get('username'),
                'full_name':      user.get('full_name'),
                'role':           user.get('role'),
                'category_group': user.get('category_group', 'all'),
                'designation':    user.get('designation'),
            }
        })
    except Exception as e:
        print(f"❌ Login error: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/me', methods=['GET'])
@require_auth
def me():
    return jsonify({
        'success': True,
        'user': request.current_user
    })


@app.route('/categories', methods=['GET'])
@require_auth
def categories():
    """Return categories allowed for the current user."""
    user = request.current_user
    payload = build_category_payload(
        user_group=user.get('category_group', 'all'),
        user_role=user.get('role')
    )
    return jsonify({'success': True, 'data': payload})


# ============================================================
# BILLS ROUTES
# ============================================================
@app.route('/upload', methods=['POST'])
@require_auth
def upload_bill():
    try:
        data = request.json or {}
        image_data = data.get('image')
        if not image_data:
            return jsonify({'success': False, 'error': 'No image provided'}), 400

        extracted_data = extract_text_from_image(image_data)
        return jsonify({
            'success': True,
            'data': extracted_data,
            'message': 'Bill processed successfully!'
        })
    except Exception as e:
        print(f"❌ Upload error: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/save', methods=['POST'])
@require_auth
def save_bill():
    try:
        bill_data = request.json or {}
        user = request.current_user

        # ---- Auto-inject RBAC fields ----
        category = bill_data.get('category')

        # Validate category against user's allowed set
        allowed = build_category_payload(
            user_group=user.get('category_group', 'all'),
            user_role=user.get('role')
        )['categories']

        if category and category not in allowed:
            return jsonify({
                'success': False,
                'error': f"Category '{category}' not allowed for your role"
            }), 403

        # Default category if admin didn't pick one
        if not category:
            bill_data['category'] = allowed[0] if allowed else None
            category = bill_data['category']

        bill_data['created_by']      = user.get('username')
        bill_data['created_by_role'] = user.get('role')
        bill_data['category_group']  = (
            get_group_for_category(category) if category else 'all'
        )

        result = db.save_bill(bill_data)

        if result:
            return jsonify({
                'success': True,
                'message': 'Bill saved successfully!',
                'data': result,
                'id': result.get('id')
            })
        return jsonify({'success': False, 'error': 'Save failed'}), 500

    except Exception as e:
        print(f"❌ Save error: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/bills', methods=['GET'])
@require_auth
def get_bills():
    try:
        bills = db.get_all_bills(user=request.current_user)
        return jsonify({'success': True, 'data': bills})
    except Exception as e:
        print(f"❌ Get bills error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/bills/<int:bill_id>', methods=['GET'])
@require_auth
def get_bill(bill_id):
    try:
        # 1. Check existence FIRST
        bill = db.get_bill(bill_id)
        if not bill:
            return jsonify({'success': False, 'error': 'Bill not found'}), 404

        # 2. Then check permission
        if not db.user_can_access_bill(request.current_user, bill_id):
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        return jsonify({'success': True, 'data': bill})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/bills/<int:bill_id>', methods=['DELETE'])
@require_auth
def delete_bill(bill_id):
    try:
        user = request.current_user
        if not db.user_can_access_bill(user, bill_id):
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        # Clerks can only delete their own
        if user.get('role') == ROLE_CLERK:
            bill = db.get_bill(bill_id)
            if bill.get('created_by') != user.get('username'):
                return jsonify({'success': False, 'error': 'Access denied'}), 403

        ok = db.delete_bill(bill_id)
        if ok:
            return jsonify({'success': True, 'message': 'Bill deleted'})
        return jsonify({'success': False, 'error': 'Delete failed'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/stats', methods=['GET'])
@require_auth
def get_stats():
    try:
        stats = db.get_stats(user=request.current_user)
        return jsonify({'success': True, 'data': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================
# SELF-SERVICE PASSWORD CHANGE
# ============================================================
@app.route('/me/password', methods=['PUT'])
@require_auth
def change_own_password():
    """
    Any authenticated user can change their OWN password.
    Body: { current_password, new_password }
    """
    try:
        actor = request.current_user
        data = request.json or {}
        current = data.get('current_password', '')
        new     = data.get('new_password', '')

        if not current or not new:
            return jsonify({
                'success': False,
                'error': 'current_password and new_password required'
            }), 400

        if len(new) < 4:
            return jsonify({
                'success': False,
                'error': 'New password must be at least 4 characters'
            }), 400

        # --- Admin (hardcoded) case ---
        if actor.get('username') == HARDCODED_ADMIN_USERNAME:
            # Verify current password
            if not authenticate(db, HARDCODED_ADMIN_USERNAME, current):
                return jsonify({
                    'success': False,
                    'error': 'Current password is incorrect'
                }), 401

            row = db.get_user_by_username(HARDCODED_ADMIN_USERNAME)
            if not row:
                return jsonify({
                    'success': False,
                    'error': 'Admin row missing in DB'
                }), 500

            ok = db.update_user(row['id'], {
                'password_hash': hash_password(new)
            })
            if not ok:
                return jsonify({
                    'success': False,
                    'error': 'Update failed'
                }), 500

            return jsonify({
                'success': True,
                'message': 'Password updated — please login again'
            })

        # --- Normal DB user case ---
        user = db.get_user_by_username(actor.get('username'))
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404

        if not verify_password(current, user.get('password_hash')):
            return jsonify({
                'success': False,
                'error': 'Current password is incorrect'
            }), 401

        ok = db.update_user(user['id'], {
            'password_hash': hash_password(new)
        })
        if not ok:
            return jsonify({
                'success': False,
                'error': 'Update failed'
            }), 500

        return jsonify({
            'success': True,
            'message': 'Password updated — please login again'
        })

    except Exception as e:
        print(f"❌ change_own_password error: {e}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500
# ============================================================
# USER MANAGEMENT ROUTES
# ============================================================
@app.route('/users', methods=['GET'])
@require_auth
def list_users():
    """
    - admin       → all users (except admin itself)
    - super_admin → only clerks they created (or all clerks? we choose: only own-created)
    - clerk       → forbidden
    """
    try:
        user = request.current_user
        role = user.get('role')

        if role == ROLE_ADMIN:
            users = db.get_all_users(exclude_admin=True)
        elif role == ROLE_SUPER_ADMIN:
            # Super admin sees clerks they created + all clerks belonging to their group
            all_users = db.get_all_users(exclude_admin=True)
            users = [
                u for u in all_users
                if u.get('role') == ROLE_CLERK
                and (u.get('created_by') == user.get('username')
                     or u.get('category_group') == user.get('category_group'))
            ]
        else:
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        return jsonify({'success': True, 'data': users})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/users', methods=['POST'])
@require_auth
def create_user():
    try:
        actor = request.current_user
        actor_role = actor.get('role')
        data = request.json or {}

        target_role = data.get('role')
        if target_role not in (ROLE_SUPER_ADMIN, ROLE_CLERK):
            return jsonify({
                'success': False,
                'error': 'Role must be super_admin or clerk'
            }), 400

        if not can_create_role(actor_role, target_role):
            return jsonify({
                'success': False,
                'error': f"You ({actor_role}) cannot create a {target_role}"
            }), 403

        # Required fields
        username = (data.get('username') or '').strip().lower()
        password = data.get('password') or ''
        full_name = (data.get('full_name') or '').strip()

        if not username or not password or not full_name:
            return jsonify({
                'success': False,
                'error': 'username, password, full_name required'
            }), 400

        if username == HARDCODED_ADMIN_USERNAME:
            return jsonify({
                'success': False,
                'error': 'Reserved username'
            }), 400

        if db.get_user_by_username(username):
            return jsonify({
                'success': False,
                'error': 'Username already exists'
            }), 409

        # Category group rules
        category_group = data.get('category_group')
        if target_role == ROLE_SUPER_ADMIN:
            # Super admins must be in a specific group
            if category_group not in ('adfm_1', 'adfm_2'):
                return jsonify({
                    'success': False,
                    'error': 'super_admin must have category_group adfm_1 or adfm_2'
                }), 400
        else:
            # Clerk inherits from creator's group (if creator is S.A.)
            if actor_role == ROLE_SUPER_ADMIN:
                category_group = actor.get('category_group')
            elif not category_group:
                category_group = 'all'

        new_user = db.create_user({
            'username':       username,
            'password_hash':  hash_password(password),
            'full_name':      full_name,
            'role':           target_role,
            'category_group': category_group,
            'created_by':     actor.get('username'),
            'designation':    data.get('designation'),
            'phone':          data.get('phone'),
            'email':          data.get('email'),
        })

        if not new_user:
            return jsonify({'success': False, 'error': 'DB insert failed'}), 500

        new_user.pop('password_hash', None)
        return jsonify({'success': True, 'data': new_user}), 201

    except Exception as e:
        print(f"❌ create_user error: {e}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/users/<int:user_id>', methods=['PUT'])
@require_auth
def update_user(user_id):
    try:
        actor = request.current_user
        target = db.get_user_by_id(user_id)
        if not target:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        # ---- Special case: admin editing own record ----
        is_self_admin = (
            target.get('role') == ROLE_ADMIN
            and actor.get('username') == target.get('username') == HARDCODED_ADMIN_USERNAME
        )

        if not is_self_admin and not can_manage_user(actor.get('role'), target.get('role')):
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        data = request.json or {}
        fields = {}

        # ----- Self-admin: ONLY allow password -----
        if is_self_admin:
            if not data.get('password'):
                return jsonify({
                    'success': False,
                    'error': 'Admin can only change own password here'
                }), 400
            if len(data['password']) < 4:
                return jsonify({
                    'success': False,
                    'error': 'Password must be at least 4 characters'
                }), 400
            fields['password_hash'] = hash_password(data['password'])
            db.update_user(user_id, fields)
            return jsonify({'success': True, 'message': 'Password updated'})

        # ----- Normal update flow -----
        if 'full_name' in data:
            fields['full_name'] = data['full_name']
        if 'designation' in data:
            fields['designation'] = data['designation']
        if 'phone' in data:
            fields['phone'] = data['phone']
        if 'email' in data:
            fields['email'] = data['email']

        if 'category_group' in data and target['role'] == ROLE_SUPER_ADMIN:
            if actor.get('role') != ROLE_ADMIN:
                return jsonify({'success': False, 'error': 'Only admin can change group'}), 403
            if data['category_group'] not in ('adfm_1', 'adfm_2'):
                return jsonify({'success': False, 'error': 'Invalid group'}), 400
            fields['category_group'] = data['category_group']

        if data.get('password'):
            if len(data['password']) < 4:
                return jsonify({
                    'success': False,
                    'error': 'Password must be at least 4 characters'
                }), 400
            fields['password_hash'] = hash_password(data['password'])

        if not fields:
            return jsonify({'success': False, 'error': 'No fields to update'}), 400

        ok = db.update_user(user_id, fields)
        if ok:
            updated = db.get_user_by_id(user_id)
            if updated:
                updated.pop('password_hash', None)
            return jsonify({'success': True, 'data': updated})
        return jsonify({'success': False, 'error': 'Update failed'}), 500

    except Exception as e:
        print(f"❌ update_user error: {e}")
        import traceback; print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/users/<int:user_id>/toggle', methods=['POST'])
@require_auth
def toggle_user(user_id):
    """Activate / deactivate a user."""
    try:
        actor = request.current_user
        target = db.get_user_by_id(user_id)
        if not target:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        if not can_manage_user(actor.get('role'), target.get('role')):
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        new_state = 0 if target.get('is_active') else 1
        ok = db.set_user_active(user_id, bool(new_state))
        if ok:
            return jsonify({
                'success': True,
                'is_active': new_state,
                'message': 'Activated' if new_state else 'Deactivated'
            })
        return jsonify({'success': False, 'error': 'Toggle failed'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/users/<int:user_id>', methods=['DELETE'])
@require_auth
def delete_user(user_id):
    try:
        actor = request.current_user
        target = db.get_user_by_id(user_id)
        if not target:
            return jsonify({'success': False, 'error': 'User not found'}), 404

        if not can_manage_user(actor.get('role'), target.get('role')):
            return jsonify({'success': False, 'error': 'Access denied'}), 403

        # Rule: S.A. cannot delete another S.A. (only admin can)
        if target['role'] == ROLE_SUPER_ADMIN and actor.get('role') != ROLE_ADMIN:
            return jsonify({'success': False, 'error': 'Only admin can delete super_admin'}), 403

        ok = db.delete_user(user_id)
        if ok:
            return jsonify({'success': True, 'message': 'User deleted'})
        return jsonify({'success': False, 'error': 'Delete failed'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================================
# ERROR HANDLERS
# ============================================================
@app.errorhandler(404)
def _404(e):
    return jsonify({'success': False, 'error': 'Not found'}), 404


@app.errorhandler(500)
def _500(e):
    return jsonify({'success': False, 'error': 'Server error'}), 500

# ============================================================
# DASHBOARD DATA — Notices & Activity
# ============================================================
@app.route('/notices', methods=['GET'])
@require_auth
def get_notices():
    """
    Return active system notices.
    For now: static list. Later: read from notices table.
    """
    notices = [
        {
            "id": 1,
            "title": "OCR-Powered Bill Processing",
            "message": "Upload railway bills via camera or file. OCR extracts data automatically.",
            "type": "info",
            "priority": 1,
            "created_at": "2026-09-23T10:00:00",
        },
        {
            "id": 2,
            "title": "Role-Based Access Enabled",
            "message": "Each officer sees only their assigned category group bills.",
            "type": "success",
            "priority": 2,
            "created_at": "2026-09-22T09:00:00",
        },
        {
            "id": 3,
            "title": "System Maintenance Window",
            "message": "Scheduled maintenance every Sunday 02:00–04:00 IST.",
            "type": "warning",
            "priority": 3,
            "created_at": "2026-09-20T08:00:00",
        },
    ]
    return jsonify({'success': True, 'data': notices})


@app.route('/activity', methods=['GET'])
@require_auth
def get_activity():
    """
    Return recent activity derived from existing tables.
    Last 5 events = most recent bills + recently created users.
    """
    try:
        user = request.current_user
        events = []

        # ---- Last 3 visible bills ----
        bills = db.get_all_bills(user=user)
        for bill in bills[:3]:
            events.append({
                "type": "bill",
                "icon": "receipt-outline",
                "message": f"Bill #{bill.get('bill_number') or bill['id']} "
                           f"from {bill.get('vendor', 'Unknown')}",
                "amount": float(bill.get('total') or 0),
                "category": bill.get('category'),
                "created_at": bill.get('created_at'),
                "username": bill.get('created_by'),
            })

        # ---- Last 2 users (only for admin/S.A.) ----
        if user.get('role') in ('admin', 'super_admin'):
            all_users = db.get_all_users(exclude_admin=True)
            for u in all_users[:2]:
                events.append({
                    "type": "user",
                    "icon": "person-add-outline",
                    "message": f"User {u.get('full_name')} (@{u.get('username')}) created",
                    "role": u.get('role'),
                    "category_group": u.get('category_group'),
                    "created_at": u.get('created_at'),
                    "username": u.get('created_by'),
                })

        # Sort by created_at desc, take top 5
        events.sort(
            key=lambda e: e.get('created_at') or '',
            reverse=True
        )
        events = events[:5]

        return jsonify({'success': True, 'data': events})

    except Exception as e:
        print(f"❌ get_activity error: {e}")
        import traceback; print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

    
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)