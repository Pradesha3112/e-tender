from supabase_client import SupabaseClient

# Test connection
db = SupabaseClient()

# Test insert
test_data = {
    'bill_number': 'TEST-001',
    'vendor': 'Test Vendor',
    'date': '2024-01-01',
    'subtotal': 100.00,
    'tax': 18.00,
    'total': 118.00,
    'gstin': '33AABCT1234F1Z5',
    'items': '[{"name":"Test Item","qty":1,"price":100}]',
    'amount_words': 'Rupees One Hundred Eighteen Only'
}

print("📤 Testing Supabase insert...")
result = db.save_bill(test_data)
print(f"✅ Result: {result}")