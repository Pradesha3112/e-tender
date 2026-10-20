# backend/testcase.py
import os
import json
from ocr_simple import extract_text_from_image
from mysql_client import MySQLClient

def run_test():
    print("🚀 STARTING OCR & DATABASE TEST")
    print("=" * 60)

    # 1. Load a sample PDF to base64
    # Ensure you have a test PDF in your backend folder named 'test_bill.pdf'
    # Or, replace this path with an absolute path to your PDF.
    test_pdf_path = r'C:\Users\USER\Downloads\Sales_INA_016_26-27.pdf' 
    
    if not os.path.exists(test_pdf_path):
        print(f"❌ ERROR: Cannot find '{test_pdf_path}'. Please put a PDF in the backend folder to test.")
        print("Using a dummy empty base64 string instead (OCR will likely fail).")
        base64_pdf = ""
    else:
        import base64
        with open(test_pdf_path, "rb") as pdf_file:
            base64_pdf = base64.b64encode(pdf_file.read()).decode('utf-8')

    # 2. Test OCR
    print("\n--- TESTING OCR ---")
    try:
        extracted_data = extract_text_from_image(base64_pdf)
        print("✅ OCR Success! Extracted Data:")
        print(json.dumps(extracted_data, indent=2))
    except Exception as e:
        print(f"❌ OCR CRASHED: {e}")
        return

    # 3. Test Database Save
    print("\n--- TESTING DATABASE SAVE ---")
    db = MySQLClient()
    
    # Inject required fields for save
    extracted_data['category'] = 'Establishment Bills'
    extracted_data['created_by'] = 'admin'
    extracted_data['created_by_role'] = 'admin'
    extracted_data['category_group'] = 'all'

    try:
        print("Attempting to save to DB...")
        result = db.save_bill(extracted_data)
        
        if result:
            print("✅ DB SAVE SUCCESS! Bill ID:", result.get('id'))
        else:
            print("❌ DB SAVE FAILED! The MySQLClient returned None. Check above for SQL errors.")
    except Exception as e:
        print(f"❌ DB CRASHED: {e}")

if __name__ == '__main__':
    run_test()