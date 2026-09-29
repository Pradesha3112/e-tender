# ============================================================
# FILE: mysql_client.py
# PURPOSE: MySQL data layer — bills + users + role filtering
# ============================================================

import mysql.connector
from mysql.connector import Error
from datetime import datetime
import json
import os
from dotenv import load_dotenv

from permissions import ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_CLERK
from categories import get_group_for_category

# Load environment variables
load_dotenv()


class MySQLClient:
    def __init__(self):
        """Initialize MySQL connection"""
        try:
            self.connection = mysql.connector.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'bill_scanner'),
                user=os.getenv('DB_USER', 'root'),
                password=os.getenv('DB_PASSWORD', '')
            )

            if self.connection.is_connected():
                self.cursor = self.connection.cursor(dictionary=True)
                print("✅ Connected to MySQL database!")
                self.create_tables()

        except Error as e:
            print(f"❌ MySQL connection failed: {e}")
            print("⚠️ Please check your MySQL credentials in .env file")
            self.connection = None
            self.cursor = None

    # ============================================================
    # TABLE CREATION
    # ============================================================
    def create_tables(self):
        """Create bills + users tables if they don't exist"""
        try:
            # --- Bills table (existing) ---
            self.cursor.execute("""
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
                amount_words TEXT,
                image_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                category VARCHAR(150) DEFAULT NULL,
                created_by VARCHAR(50) DEFAULT 'admin',
                created_by_role VARCHAR(20) DEFAULT 'admin',
                category_group VARCHAR(20) DEFAULT 'all'
            )
            """)

            # --- Users table (new) ---
            self.cursor.execute("""
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

            self.connection.commit()
            print("✅ Tables ready (bills + users)")

        except Error as e:
            print(f"❌ Table creation error: {e}")

    # ============================================================
    # USER METHODS
    # ============================================================
    def get_user_by_username(self, username):
        """Fetch a user by username (returns None if not found)."""
        try:
            if not self.connection:
                return None
            self.cursor.execute(
                "SELECT * FROM users WHERE username = %s",
                (username,)
            )
            return self.cursor.fetchone()
        except Error as e:
            print(f"❌ Error fetching user: {e}")
            return None

    def get_user_by_id(self, user_id):
        """Fetch a user by id."""
        try:
            if not self.connection:
                return None
            self.cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return self.cursor.fetchone()
        except Error as e:
            print(f"❌ Error fetching user: {e}")
            return None

    def get_all_users(self, exclude_admin=True):
        """Return all users. Optionally hide the admin row."""
        try:
            if not self.connection:
                return []
            if exclude_admin:
                self.cursor.execute(
                    "SELECT * FROM users WHERE role != 'admin' ORDER BY created_at DESC"
                )
            else:
                self.cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
            users = self.cursor.fetchall()
            for u in users:
                u.pop("password_hash", None)
            return users
        except Error as e:
            print(f"❌ Error listing users: {e}")
            return []

    def get_users_by_creator(self, creator_username):
        """Return users created by a specific user."""
        try:
            if not self.connection:
                return []
            self.cursor.execute(
                "SELECT * FROM users WHERE created_by = %s ORDER BY created_at DESC",
                (creator_username,)
            )
            users = self.cursor.fetchall()
            for u in users:
                u.pop("password_hash", None)
            return users
        except Error as e:
            print(f"❌ Error listing users: {e}")
            return []

    def create_user(self, data):
        """Insert a new user. data must include password_hash."""
        try:
            if not self.connection:
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
            self.cursor.execute(query, data)
            self.connection.commit()
            new_id = self.cursor.lastrowid
            print(f"✅ User created: {data['username']} (id={new_id})")
            return self.get_user_by_id(new_id)
        except Error as e:
            print(f"❌ Error creating user: {e}")
            self.connection.rollback()
            return None

    def update_user(self, user_id, fields):
        """Update arbitrary fields on a user."""
        try:
            if not self.connection or not fields:
                return False
            set_clause = ", ".join(f"{k} = %({k})s" for k in fields.keys())
            query = f"UPDATE users SET {set_clause} WHERE id = %(id)s"
            fields["id"] = user_id
            self.cursor.execute(query, fields)
            self.connection.commit()
            print(f"✅ User {user_id} updated")
            return True
        except Error as e:
            print(f"❌ Error updating user: {e}")
            self.connection.rollback()
            return False

    def set_user_active(self, user_id, is_active: bool):
        """Activate / deactivate a user."""
        return self.update_user(user_id, {"is_active": 1 if is_active else 0})

    def delete_user(self, user_id):
        """Permanently delete a user (only clerks/super_admins)."""
        try:
            if not self.connection:
                return False
            self.cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
            self.connection.commit()
            print(f"✅ User {user_id} deleted")
            return True
        except Error as e:
            print(f"❌ Error deleting user: {e}")
            self.connection.rollback()
            return False

    def touch_last_login(self, username):
        """Update last_login timestamp."""
        try:
            if not self.connection:
                return
            self.cursor.execute(
                "UPDATE users SET last_login = NOW() WHERE username = %s",
                (username,)
            )
            self.connection.commit()
        except Error as e:
            print(f"⚠️ last_login update failed: {e}")

    # ============================================================
    # BILL METHODS
    # ============================================================
    def save_bill(self, bill_data):
        """Save bill to MySQL with RBAC columns."""
        try:
            if not self.connection:
                print("❌ No database connection")
                return None

            items_json = json.dumps(bill_data.get('items', []))

            category = bill_data.get('category')
            # Auto-derive category_group from category if not supplied
            category_group = bill_data.get('category_group')
            if not category_group:
                if category and category != 'all':
                    category_group = get_group_for_category(category) or 'all'
                else:
                    category_group = 'all'

            data = {
                'bill_number':     bill_data.get('bill_number', ''),
                'vendor':          bill_data.get('vendor', ''),
                'date':            bill_data.get('date', ''),
                'subtotal':        float(bill_data.get('subtotal', 0) or 0),
                'tax':             float(bill_data.get('tax', 0) or 0),
                'total':           float(bill_data.get('total', 0) or 0),
                'gstin':           bill_data.get('gstin', ''),
                'items':           items_json,
                'amount_words':    bill_data.get('amount_words', ''),
                'category':        category,
                'created_by':      bill_data.get('created_by', 'admin'),
                'created_by_role': bill_data.get('created_by_role', 'admin'),
                'category_group':  category_group,
                'created_at':      datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            }

            query = """
            INSERT INTO bills
            (bill_number, vendor, date, subtotal, tax, total, gstin, items,
             amount_words, category, created_by, created_by_role,
             category_group, created_at)
            VALUES
            (%(bill_number)s, %(vendor)s, %(date)s, %(subtotal)s, %(tax)s,
             %(total)s, %(gstin)s, %(items)s, %(amount_words)s, %(category)s,
             %(created_by)s, %(created_by_role)s, %(category_group)s,
             %(created_at)s)
            """
            self.cursor.execute(query, data)
            self.connection.commit()
            bill_id = self.cursor.lastrowid
            print(f"✅ Bill saved! ID: {bill_id}")
            return self.get_bill(bill_id)
        except Error as e:
            print(f"❌ Error saving bill: {e}")
            self.connection.rollback()
            return None

    def get_all_bills(self, user=None):
        """
        Return bills visible to `user`.
        - admin       → all
        - super_admin → own category_group
        - clerk       → own bills only
        - None        → all (legacy behavior)
        """
        try:
            if not self.connection:
                return []

            if not user:
                query = "SELECT * FROM bills ORDER BY created_at DESC"
                self.cursor.execute(query)
            else:
                role  = user.get("role")
                uname = user.get("username")
                group = user.get("category_group", "all")

                if role == ROLE_ADMIN:
                    self.cursor.execute(
                        "SELECT * FROM bills ORDER BY created_at DESC"
                    )
                elif role == ROLE_SUPER_ADMIN:
                    self.cursor.execute(
                        "SELECT * FROM bills WHERE category_group = %s "
                        "ORDER BY created_at DESC",
                        (group,)
                    )
                elif role == ROLE_CLERK:
                    self.cursor.execute(
                        "SELECT * FROM bills WHERE created_by = %s "
                        "ORDER BY created_at DESC",
                        (uname,)
                    )
                else:
                    return []

            result = self.cursor.fetchall()
            for bill in result:
                if bill.get('items'):
                    try:
                        bill['items'] = json.loads(bill['items'])
                    except Exception:
                        bill['items'] = []
            return result
        except Error as e:
            print(f"❌ Error getting bills: {e}")
            return []

    def get_bill(self, bill_id):
        """Get a bill by id."""
        try:
            if not self.connection:
                return None
            self.cursor.execute("SELECT * FROM bills WHERE id = %s", (bill_id,))
            result = self.cursor.fetchone()
            if result and result.get('items'):
                try:
                    result['items'] = json.loads(result['items'])
                except Exception:
                    result['items'] = []
            return result
        except Error as e:
            print(f"❌ Error getting bill: {e}")
            return None

    def user_can_access_bill(self, user, bill_id):
        """Check if `user` is allowed to see `bill_id`."""
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

    def delete_bill(self, bill_id):
        """Delete a bill."""
        try:
            if not self.connection:
                return False
            self.cursor.execute("DELETE FROM bills WHERE id = %s", (bill_id,))
            self.connection.commit()
            print(f"✅ Bill {bill_id} deleted!")
            return True
        except Error as e:
            print(f"❌ Error deleting bill: {e}")
            self.connection.rollback()
            return False

    def get_stats(self, user=None):
        """Get role-filtered bill statistics."""
        try:
            if not self.connection:
                return {'total_bills': 0, 'total_amount': 0}

            if not user or user.get("role") == ROLE_ADMIN:
                self.cursor.execute("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills
                """)
            elif user.get("role") == ROLE_SUPER_ADMIN:
                self.cursor.execute("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills WHERE category_group = %s
                """, (user.get("category_group", "all"),))
            elif user.get("role") == ROLE_CLERK:
                self.cursor.execute("""
                    SELECT COUNT(*) AS total_bills,
                           COALESCE(SUM(total), 0) AS total_amount
                    FROM bills WHERE created_by = %s
                """, (user.get("username"),))
            else:
                return {'total_bills': 0, 'total_amount': 0}

            result = self.cursor.fetchone() or {}
            return {
                'total_bills':  result.get('total_bills', 0),
                'total_amount': float(result.get('total_amount', 0) or 0),
            }
        except Error as e:
            print(f"❌ Error getting stats: {e}")
            return {'total_bills': 0, 'total_amount': 0}

    def close(self):
        """Close DB connection."""
        if self.connection and self.connection.is_connected():
            self.cursor.close()
            self.connection.close()
            print("✅ MySQL connection closed")