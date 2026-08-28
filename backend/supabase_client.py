import os
from supabase import create_client, Client
from datetime import datetime
import json

class SupabaseClient:
    def __init__(self):
        # 🔴 REPLACE WITH YOUR ACTUAL SUPABASE KEYS
        self.url = "https://yqnysqrwmkjdsbcnfnfq.supabase.co"  # ← YOUR URL
        self.key = "sb_secret_bLMAumZP_a0bkVtE7MbFcg_s5hAe3kL"             # ← YOUR ANON KEY
        self.client: Client = create_client(self.url, self.key)
        print("✅ Connected to Supabase!")

    def save_bill(self, bill_data):
        """Save bill to Supabase"""
        try:
            # Prepare data
            data = {
                'bill_number': bill_data.get('bill_number', ''),
                'vendor': bill_data.get('vendor', ''),
                'date': bill_data.get('date', ''),
                'subtotal': float(bill_data.get('subtotal', 0)),
                'tax': float(bill_data.get('tax', 0)),
                'total': float(bill_data.get('total', 0)),
                'gstin': bill_data.get('gstin', ''),
                'items': json.dumps(bill_data.get('items', [])),
                'amount_words': bill_data.get('amount_words', ''),
                'created_at': datetime.now().isoformat()
            }
            
            print(f"📤 Saving to Supabase: {data}")
            
            # Insert into database
            response = self.client.table('bills').insert(data).execute()
            
            print(f"✅ Bill saved! ID: {response.data[0]['id']}")
            return response.data[0]
            
        except Exception as e:
            print(f"❌ Error saving bill: {e}")
            print(f"❌ Full error: {e.__dict__ if hasattr(e, '__dict__') else e}")
            return None

    def get_all_bills(self):
        """Get all bills"""
        try:
            response = self.client.table('bills').select('*').order('created_at', desc=True).execute()
            return response.data
        except Exception as e:
            print(f"❌ Error getting bills: {e}")
            return []

    def get_bill(self, bill_id):
        """Get specific bill"""
        try:
            response = self.client.table('bills').select('*').eq('id', bill_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"❌ Error getting bill: {e}")
            return None

    def delete_bill(self, bill_id):
        """Delete a bill"""
        try:
            response = self.client.table('bills').delete().eq('id', bill_id).execute()
            print(f"✅ Bill {bill_id} deleted!")
            return True
        except Exception as e:
            print(f"❌ Error deleting bill: {e}")
            return False