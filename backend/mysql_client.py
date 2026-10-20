# ============================================================
# FILE: mysql_client.py
# PURPOSE: MySQL data layer (thread-safe via connection pool)
#          bills + users + RBAC + soft delete + user activity
# ============================================================

import mysql.connector
from mysql.connector import Error, pooling
from datetime import datetime
import json
import os
import uuid
from dotenv import load_dotenv

from permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK
from categories import get_group_for_category

# Load environment variables
load_dotenv()


class MySQLClient:
    def __init__(self):
        """Initialize a MySQL connection pool (thread-safe)."""
        self.pool = None

        try:
            db_config = {
                'host':     os.getenv('DB_HOST', 'localhost'),
                'database': os.getenv('DB_NAME', 'bill_scanner'),
                'user':     os.getenv('DB_USER', 'root'),
                'password': os.getenv('DB_PASSWORD', ''),
                'autocommit': False,
                'connection_timeout': 10,
            }

            self.pool = pooling.MySQLConnectionPool(
                pool_name="rly_pool",
                pool_size=10,
                pool_reset_session=True,
                **db_config
            )

            # Quick sanity check
            conn = self.pool.get_connection()
            if conn.is_connected():
                cur = conn.cursor()
                try:
                    cur.execute("SET time_zone = '+05:30'")   # IST
                except Exception:
                    pass
                finally:
                    cur.close()
                conn.close()
                print("✅ MySQL connection pool ready (size=10)")

            self.create_tables()

        except Error as e:
            print(f"❌ MySQL pool creation failed: {e}")
            print("⚠️ Please check your MySQL credentials in .env file")
            self.pool = None

    # ============================================================
    # ⭐ CONNECTION HELPERS (fresh per call)
    # ============================================================
    def _get_conn(self):
        return self.pool.get_connection()

    def _fetch_one(self, query, params=None):
        conn = self._get_conn()
        try:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(query, params or ())
                return cursor.fetchone()
            finally:
                cursor.close()
        finally:
            conn.close()

    def _fetch_all(self, query, params=None):
        conn = self._get_conn()
        try:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(query, params or ())
                return cursor.fetchall()
            finally:
                cursor.close()
        finally:
            conn.close()

    def _execute(self, query, params=None):
        conn = self._get_conn()
        try:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(query, params or ())
                conn.commit() # Force commit
                affected = cursor.rowcount
                return affected # Return affected rows
            finally:
                cursor.close()
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            print(f"❌ SQL Execute Error: {e}")
            raise e
        finally:
            conn.close()

    # ============================================================
    # TABLE CREATION & AUTO-MIGRATION
    # ============================================================
    def create_tables(self):
        """Create bills + users + user_activity tables if missing and run safe migrations."""
        try:
            conn = self._get_conn()
            cursor = conn.cursor()
            try:
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS bills (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    bill_number VARCHAR(100),
                    vendor VARCHAR(200),
                    date VARCHAR(20),
                    subtotal DECIMAL(10,2) DEFAULT 0.00,
                    tax DECIMAL(10,2) DEFAULT 0.00,
                    total DECIMAL(10,2) DEFAULT 0.00,
                    gstin VARCHAR(20),
                    items JSON,
                    image_url VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    category VARCHAR(150) DEFAULT NULL,
                    created_by VARCHAR(50) DEFAULT 'admin',
                    created_by_role VARCHAR(20) DEFAULT 'admin',
                    category_group VARCHAR(20) DEFAULT 'all',
                    is_deleted TINYINT(1) DEFAULT 0,
                    deleted_at TIMESTAMP NULL DEFAULT NULL,
                    deleted_by VARCHAR(50) DEFAULT NULL,
                    deleted_by_role VARCHAR(20) DEFAULT NULL,
                    deletion_reason VARCHAR(500) DEFAULT NULL
                )
                """)

                cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    full_name VARCHAR(100) NOT NULL,
                    role ENUM('admin','super_admin','clerk') NOT NULL,
                    category_group ENUM('all','adfm_1','adfm_2') DEFAULT 'all',
                    created_by VARCHAR(50) DEFAULT NULL,
                    is_active TINYINT(1) DEFAULT 1,
                    designation VARCHAR(100) DEFAULT NULL,
                    phone VARCHAR(20) DEFAULT NULL,
                    email VARCHAR(100) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP NULL DEFAULT NULL
                )
                """)

                # 1. Ensure the table exists (without the unique constraint initially so we can add it safely)
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_activity (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    full_name VARCHAR(100) DEFAULT NULL,
                    role VARCHAR(20) NOT NULL,
                    category_group VARCHAR(20) NOT NULL,
                    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    logout_at TIMESTAMP NULL DEFAULT NULL,
                    is_active TINYINT(1) DEFAULT 1,
                    INDEX idx_activity_username (username),
                    INDEX idx_activity_login_at (login_at),
                    INDEX idx_activity_active   (is_active)
                )
                """)

                # 2. Safe Auto-Migration for session_id
                cursor.execute("SHOW COLUMNS FROM user_activity LIKE 'session_id'")
                result = cursor.fetchone()
                
                if not result:
                    print("⚙️ Migrating user_activity table: Adding 'session_id' column...")
                    # Add column as nullable first
                    cursor.execute("ALTER TABLE user_activity ADD COLUMN session_id VARCHAR(100) NULL AFTER id")
                    
                    # Generate unique UUIDs for any existing rows so we don't violate constraints
                    cursor.execute("SELECT id FROM user_activity")
                    existing_rows = cursor.fetchall()
                    for row in existing_rows:
                        cursor.execute(
                            "UPDATE user_activity SET session_id = %s WHERE id = %s",
                            (str(uuid.uuid4()), row[0])
                        )
                    
                    # Apply UNIQUE constraint to enforce uniqueness going forward
                    cursor.execute("ALTER TABLE user_activity MODIFY COLUMN session_id VARCHAR(100) NOT NULL UNIQUE")
                    print("✅ Migration successful: 'session_id' is now active.")

                conn.commit()
            finally:
                cursor.close()
                conn.close()

            print("✅ Tables ready (bills + users + user_activity)")
        except Error as e:
            print(f"❌ Table creation/migration error: {e}")

    # ============================================================
    # USER ACTIVITY
    # ============================================================
    def log_user_login(self, session_id, username, role, category_group, full_name=None):
        """Record a new unique login event."""
        try:
            if not self.pool:
                return None

            new_id = self._execute("""
                INSERT INTO user_activity
                    (session_id, username, full_name, role, category_group, login_at, is_active)
                VALUES
                    (%s, %s, %s, %s, %s, NOW(), 1)
            """, (session_id, username, full_name, role, category_group))

            print(f"📝 Activity logged: {username} logged in (session={session_id})")
            return new_id
        except Exception as e:
            print(f"❌ Error logging login: {e}")
            return None

    def log_user_logout(self, session_id):
        """Mark a specific session as logged out."""
        try:
            if not self.pool:
                return False
            
            affected = self._execute("""
                UPDATE user_activity
                   SET is_active = 0,
                       logout_at = NOW()
                 WHERE session_id = %s AND is_active = 1
            """, (session_id,))
            
            print(f"📝 DB Logout -> Session: {session_id[:8]}... | Rows Affected: {affected}")
            return affected > 0
        except Exception as e:
            print(f"❌ Error logging logout: {e}")
            return False

    def get_user_activity(self, user=None, limit=10):
        """
        Return recent login/logout events.
        """
        try:
            if not self.pool:
                return []

            role = user.get("role") if user else None

            if role in (ROLE_ADMIN, ROLE_SUPER_ADMIN) or not user:
                rows = self._fetch_all("""
                    SELECT session_id, username, full_name, role, category_group,
                           login_at, logout_at, is_active
                    FROM user_activity
                    ORDER BY login_at DESC
                    LIMIT %s
                """, (limit,))
            elif role == ROLE_CLERK:
                rows = self._fetch_all("""
                    SELECT session_id, username, full_name, role, category_group,
                           login_at, logout_at, is_active
                    FROM user_activity
                    WHERE username = %s
                    ORDER BY login_at DESC
                    LIMIT %s
                """, (user.get("username"), limit))
            else:
                return []

            for r in rows:
                for key in ('login_at', 'logout_at'):
                    val = r.get(key)
                    if val is None:
                        continue
                    if hasattr(val, 'strftime'):
                        r[key] = val.strftime('%Y-%m-%dT%H:%M:%S')
                    else:
                        r[key] = str(val).strip()

            return rows
        except Error as e:
            print(f"❌ Error getting activity: {e}")
            return []

    # ============================================================
    # USER METHODS
    # ============================================================
    def get_user_by_username(self, username):
        try:
            if not self.pool:
                return None
            return self._fetch_one(
                "SELECT * FROM users WHERE username = %s", (username,)
            )
        except Error as e:
            print(f"❌ Error fetching user: {e}")
            return None

    def get_user_by_id(self, user_id):
        try:
            if not self.pool:
                return None
            return self._fetch_one(
                "SELECT * FROM users WHERE id = %s", (user_id,)
            )
        except Error as e:
            print(f"❌ Error fetching user: {e}")
            return None

    def get_all_users(self, exclude_admin=True):
        try:
            if not self.pool:
                return []
            if exclude_admin:
                users = self._fetch_all(
                    "SELECT * FROM users WHERE role != 'admin' ORDER BY created_at DESC"
                )
            else:
                users = self._fetch_all(
                    "SELECT * FROM users ORDER BY created_at DESC"
                )
            for u in users:
                u.pop("password_hash", None)
            return users
        except Error as e:
            print(f"❌ Error listing users: {e}")
            return []

    def create_user(self, data):
        try:
            if not self.pool:
                return None
            query = """
            INSERT INTO users
            (username, password_hash, full_name, role, category_group,
             created_by, designation, phone, email)
            VALUES
            (%(username)s, %(password_hash)s, %(full_name)s, %(role)s,
             %(category_group)s, %(created_by)s, %(designation)s,
             %(phone)s, %(email)s)
            """
            new_id = self._execute(query, data)
            print(f"✅ User created: {data['username']} (id={new_id})")
            return self.get_user_by_id(new_id)
        except Error as e:
            print(f"❌ Error creating user: {e}")
            return None

    def update_user(self, user_id, fields):
        try:
            if not self.pool or not fields:
                return False
            set_clause = ", ".join(f"{k} = %({k})s" for k in fields.keys())
            query = f"UPDATE users SET {set_clause} WHERE id = %(id)s"
            fields["id"] = user_id
            self._execute(query, fields)
            return True
        except Error as e:
            print(f"❌ Error updating user: {e}")
            return False

    def set_user_active(self, user_id, is_active: bool):
        return self.update_user(user_id, {"is_active": 1 if is_active else 0})

    def delete_user(self, user_id):
        try:
            if not self.pool:
                return False
            self._execute("DELETE FROM users WHERE id = %s", (user_id,))
            return True
        except Error as e:
            print(f"❌ Error deleting user: {e}")
            return False

    def touch_last_login(self, username):
        try:
            if not self.pool:
                return
            self._execute(
                "UPDATE users SET last_login = NOW() WHERE username = %s",
                (username,)
            )
        except Error as e:
            print(f"⚠️ last_login update failed: {e}")

    # ============================================================
    # BILLS
    # ============================================================
    def _parse_items(self, bill):
        if bill and 'items' in bill and bill['items'] is not None:
            try:
                if isinstance(bill['items'], (list, dict)):
                    return bill
                if isinstance(bill['items'], (str, bytes, bytearray)):
                    bill['items'] = json.loads(bill['items'])
                else:
                    bill['items'] = []
            except Exception as e:
                print(f"⚠️ Error parsing items: {e}")
                bill['items'] = []
        return bill
    
    def save_bill(self, bill_data):
        try:
            if not self.pool:
                return None

            def safe_float(val):
                try: return float(val)
                except: return 0.0
            
            def safe_str(val, default=''):
                return str(val) if val is not None else default

            data = {
                'bill_number':     safe_str(bill_data.get('bill_number'))[:100],
                'vendor':          safe_str(bill_data.get('vendor'))[:200],
                'date':            safe_str(bill_data.get('date'))[:20],
                'subtotal':        safe_float(bill_data.get('subtotal')),
                'tax':             safe_float(bill_data.get('tax')),
                'total':           safe_float(bill_data.get('total')),
                'gstin':           safe_str(bill_data.get('gstin'))[:20],
                'items':           json.dumps(bill_data.get('items', [])), 
                'category':        safe_str(bill_data.get('category')),
                'created_by':      safe_str(bill_data.get('created_by', 'admin'))[:50],
                'created_by_role': safe_str(bill_data.get('created_by_role', 'admin'))[:20],
                'category_group':  safe_str(bill_data.get('category_group', 'all'))[:20],
                'is_deleted':      0,
            }

            query = """
            INSERT INTO bills
            (bill_number, vendor, date, subtotal, tax, total, gstin, items,
             category, created_by, created_by_role, category_group, is_deleted)
            VALUES
            (%(bill_number)s, %(vendor)s, %(date)s, %(subtotal)s, %(tax)s,
             %(total)s, %(gstin)s, %(items)s, %(category)s,
             %(created_by)s, %(created_by_role)s, %(category_group)s, %(is_deleted)s)
            """
            
            conn = self._get_conn()
            try:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(query, data)
                conn.commit()
                
                # THIS IS THE FIX FOR BILL ID = 0
                new_id = cursor.lastrowid 
                print(f"✅ Bill saved! ID: {new_id}")
                
                return {
                    'id': new_id,
                    'bill_number': data['bill_number'],
                    'vendor': data['vendor'],
                    'total': data['total']
                }
            finally:
                cursor.close()
                conn.close()
            
        except Exception as e:
            print(f"❌ CRITICAL ERROR SAVING BILL: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_all_bills(self, user=None):
        try:
            if not self.pool:
                return []

            if not user:
                result = self._fetch_all(
                    "SELECT * FROM bills WHERE is_deleted = 0 "
                    "ORDER BY created_at DESC"
                )
            else:
                role  = user.get("role")
                uname = user.get("username")
                group = user.get("category_group", "all")

                if role == ROLE_ADMIN:
                    result = self._fetch_all(
                        "SELECT * FROM bills WHERE is_deleted = 0 "
                        "ORDER BY created_at DESC"
                    )
                elif role == ROLE_SUPER_ADMIN:
                    result = self._fetch_all(
                        "SELECT * FROM bills "
                        "WHERE is_deleted = 0 AND category_group = %s "
                        "ORDER BY created_at DESC",
                        (group,)
                    )
                elif role == ROLE_CLERK:
                    result = self._fetch_all(
                        "SELECT * FROM bills "
                        "WHERE is_deleted = 0 AND created_by = %s "
                        "ORDER BY created_at DESC",
                        (uname,)
                    )
                else:
                    return []

            for b in result:
                self._parse_items(b)
            return result
        except Error as e:
            print(f"❌ Error getting bills: {e}")
            return []

    def get_deleted_bills(self, user=None):
        try:
            if not self.pool:
                return []

            if not user:
                result = self._fetch_all(
                    "SELECT * FROM bills WHERE is_deleted = 1 "
                    "ORDER BY deleted_at DESC"
                )
            else:
                role  = user.get("role")
                uname = user.get("username")
                group = user.get("category_group", "all")

                if role == ROLE_ADMIN:
                    result = self._fetch_all(
                        "SELECT * FROM bills WHERE is_deleted = 1 "
                        "ORDER BY deleted_at DESC"
                    )
                elif role == ROLE_SUPER_ADMIN:
                    result = self._fetch_all(
                        "SELECT * FROM bills "
                        "WHERE is_deleted = 1 AND category_group = %s "
                        "ORDER BY deleted_at DESC",
                        (group,)
                    )
                elif role == ROLE_CLERK:
                    result = self._fetch_all(
                        "SELECT * FROM bills "
                        "WHERE is_deleted = 1 AND created_by = %s "
                        "ORDER BY deleted_at DESC",
                        (uname,)
                    )
                else:
                    return []

            for b in result:
                self._parse_items(b)
            return result
        except Error as e:
            print(f"❌ Error getting deleted bills: {e}")
            return []

    def get_bill(self, bill_id):
        try:
            if not self.pool:
                return None
            result = self._fetch_one(
                "SELECT * FROM bills WHERE id = %s", (bill_id,)
            )
            return self._parse_items(result) if result else None
        except Error as e:
            print(f"❌ Error getting bill: {e}")
            return None

    def user_can_access_bill(self, user, bill_id):
        bill = self.get_bill(bill_id)
        if not bill or not user:
            return False
        role = user.get("role")
        if role == ROLE_ADMIN:
            return True
        if role == ROLE_SUPER_ADMIN:
            return bill.get("category_group") == user.get("category_group")
        if role == ROLE_CLERK:
            return bill.get("created_by") == user.get("username")
        return False

    def soft_delete_bill(self, bill_id, username, role, reason=None):
        try:
            if not self.pool:
                return False

            if reason:
                reason = str(reason).strip()[:500]
                if not reason:
                    reason = None
            else:
                reason = None

            affected = self._execute("""
                UPDATE bills
                   SET is_deleted = 1,
                       deleted_at = NOW(),
                       deleted_by = %s,
                       deleted_by_role = %s,
                       deletion_reason = %s
                 WHERE id = %s AND is_deleted = 0
            """, (username, role, reason, bill_id))

            print(f"🗑 Bill {bill_id} moved to recycle bin by {username}")
            if reason:
                print(f"   Reason: {reason}")

            return affected > 0
        except Error as e:
            print(f"❌ Error soft-deleting bill: {e}")
            return False

    def restore_bill(self, bill_id):
        try:
            if not self.pool:
                return False
            affected = self._execute("""
                UPDATE bills
                   SET is_deleted = 0,
                       deleted_at = NULL,
                       deleted_by = NULL,
                       deleted_by_role = NULL,
                       deletion_reason = NULL
                 WHERE id = %s AND is_deleted = 1
            """, (bill_id,))
            print(f"♻ Bill {bill_id} restored")
            return affected > 0
        except Error as e:
            print(f"❌ Error restoring bill: {e}")
            return False

    def hard_delete_bill(self, bill_id):
        try:
            if not self.pool:
                return False
            affected = self._execute(
                "DELETE FROM bills WHERE id = %s AND is_deleted = 1",
                (bill_id,)
            )
            print(f"🗑 Bill {bill_id} permanently deleted")
            return affected > 0
        except Error as e:
            print(f"❌ Error hard-deleting bill: {e}")
            return False

    def delete_bill(self, bill_id):
        return self.soft_delete_bill(bill_id, 'unknown', 'unknown')

    def get_stats(self, user=None):
        try:
            if not self.pool:
                return {'total_bills': 0, 'total_amount': 0}

            if not user or user.get("role") == ROLE_ADMIN:
                result = self._fetch_one("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills WHERE is_deleted = 0
                """)
            elif user.get("role") == ROLE_SUPER_ADMIN:
                result = self._fetch_one("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills
                    WHERE is_deleted = 0 AND category_group = %s
                """, (user.get("category_group", "all"),))
            elif user.get("role") == ROLE_CLERK:
                result = self._fetch_one("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills
                    WHERE is_deleted = 0 AND created_by = %s
                """, (user.get("username"),))
            else:
                return {'total_bills': 0, 'total_amount': 0}

            result = result or {}
            return {
                'total_bills':  result.get('total_bills', 0),
                'total_amount': float(result.get('total_amount', 0) or 0),
            }
        except Error as e:
            print(f"❌ Error getting stats: {e}")
            return {'total_bills': 0, 'total_amount': 0}

    def close(self):
        """Pool doesn't need explicit close."""
        print("✅ MySQL pool released")