import mysql.connector
from mysql.connector import Error
from datetime import datetime
import json
import os
from dotenv import load_dotenv

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
                
                # Create table if not exists
                self.create_tables()
                
        except Error as e:
            print(f"❌ MySQL connection failed: {e}")
            print("⚠️ Please check your MySQL credentials in .env file")
            self.connection = None
            self.cursor = None

    def create_tables(self):
        """Create bills table if not exists"""
        try:
            create_table_query = """
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
            self.cursor.execute(create_table_query)
            self.connection.commit()
            print("✅ Bills table ready")
            
        except Error as e:
            print(f"❌ Table creation error: {e}")

    def save_bill(self, bill_data):
        """Save bill to MySQL database"""
        try:
            if not self.connection:
                print("❌ No database connection")
                return None

            # Prepare items as JSON string
            items_json = json.dumps(bill_data.get('items', []))
            
            # Prepare data
            data = {
                'bill_number': bill_data.get('bill_number', ''),
                'vendor': bill_data.get('vendor', ''),
                'date': bill_data.get('date', ''),
                'subtotal': float(bill_data.get('subtotal', 0)),
                'tax': float(bill_data.get('tax', 0)),
                'total': float(bill_data.get('total', 0)),
                'gstin': bill_data.get('gstin', ''),
                'items': items_json,
                'amount_words': bill_data.get('amount_words', ''),
                'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }

            # Insert query
            insert_query = """
            INSERT INTO bills 
            (bill_number, vendor, date, subtotal, tax, total, gstin, items, amount_words, created_at)
            VALUES (%(bill_number)s, %(vendor)s, %(date)s, %(subtotal)s, %(tax)s, %(total)s, 
                    %(gstin)s, %(items)s, %(amount_words)s, %(created_at)s)
            """
            
            self.cursor.execute(insert_query, data)
            self.connection.commit()
            
            bill_id = self.cursor.lastrowid
            print(f"✅ Bill saved! ID: {bill_id}")
            
            # Return the saved bill
            return self.get_bill(bill_id)
            
        except Error as e:
            print(f"❌ Error saving bill: {e}")
            self.connection.rollback()
            return None

    def get_all_bills(self):
        """Get all bills"""
        try:
            if not self.connection:
                return []
            
            query = "SELECT * FROM bills ORDER BY created_at DESC"
            self.cursor.execute(query)
            result = self.cursor.fetchall()
            
            # Parse items JSON back to list
            for bill in result:
                if bill.get('items'):
                    try:
                        bill['items'] = json.loads(bill['items'])
                    except:
                        bill['items'] = []
            
            return result
            
        except Error as e:
            print(f"❌ Error getting bills: {e}")
            return []

    def get_bill(self, bill_id):
        """Get specific bill by ID"""
        try:
            if not self.connection:
                return None
            
            query = "SELECT * FROM bills WHERE id = %s"
            self.cursor.execute(query, (bill_id,))
            result = self.cursor.fetchone()
            
            if result and result.get('items'):
                try:
                    result['items'] = json.loads(result['items'])
                except:
                    result['items'] = []
            
            return result
            
        except Error as e:
            print(f"❌ Error getting bill: {e}")
            return None

    def delete_bill(self, bill_id):
        """Delete a bill"""
        try:
            if not self.connection:
                return False
            
            query = "DELETE FROM bills WHERE id = %s"
            self.cursor.execute(query, (bill_id,))
            self.connection.commit()
            
            print(f"✅ Bill {bill_id} deleted!")
            return True
            
        except Error as e:
            print(f"❌ Error deleting bill: {e}")
            self.connection.rollback()
            return False

    def get_stats(self):
        """Get bill statistics"""
        try:
            if not self.connection:
                return {'total_bills': 0, 'total_amount': 0}
            
            query = """
            SELECT 
                COUNT(*) as total_bills,
                COALESCE(SUM(total), 0) as total_amount
            FROM bills
            """
            self.cursor.execute(query)
            result = self.cursor.fetchone()
            
            return {
                'total_bills': result['total_bills'] if result else 0,
                'total_amount': result['total_amount'] if result else 0
            }
            
        except Error as e:
            print(f"❌ Error getting stats: {e}")
            return {'total_bills': 0, 'total_amount': 0}

    def close(self):
        """Close database connection"""
        if self.connection and self.connection.is_connected():
            self.cursor.close()
            self.connection.close()
            print("✅ MySQL connection closed")