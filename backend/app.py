from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr_simple import extract_text_from_image
from mysql_client import MySQLClient
import traceback
import json
import os

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "supports_credentials": True
    }
})

# Initialize MySQL Database
db = MySQLClient()

@app.route('/')
def home():
    return "Bill Scanner API is working! 🎉"

@app.route('/upload', methods=['POST'])
def upload_bill():
    try:
        print("=" * 50)
        print("📸 Received upload request")
        
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'No image provided'
            }), 400
        
        print("🔍 Processing image with OCR...")
        extracted_data = extract_text_from_image(image_data)
        
        print(f"✅ Extracted data: {extracted_data}")
        print("=" * 50)
        
        return jsonify({
            'success': True,
            'data': extracted_data,
            'message': 'Bill processed successfully!'
        })
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/save', methods=['POST'])
def save_bill():
    try:
        bill_data = request.json
        print(f"💾 Saving bill to MySQL: {bill_data}")
        
        # Save to MySQL
        result = db.save_bill(bill_data)
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Bill saved to MySQL successfully!',
                'data': result,
                'id': result.get('id')
            })
        else:
            # Fallback: Save to local file
            print("⚠️ MySQL save failed, saving locally...")
            bills_file = 'bills.json'
            existing_bills = []
            if os.path.exists(bills_file):
                with open(bills_file, 'r') as f:
                    existing_bills = json.load(f)
            
            new_bill = bill_data.copy()
            new_bill['id'] = len(existing_bills) + 1
            existing_bills.append(new_bill)
            
            with open(bills_file, 'w') as f:
                json.dump(existing_bills, f, indent=2)
            
            return jsonify({
                'success': True,
                'message': 'Bill saved locally! (MySQL unavailable)',
                'data': new_bill,
                'id': new_bill['id']
            })
            
    except Exception as e:
        print(f"❌ Error saving: {e}")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/bills', methods=['GET'])
def get_bills():
    try:
        bills = db.get_all_bills()
        
        if not bills:
            # Fallback: Get from local file
            print("⚠️ No MySQL bills, checking local file...")
            bills_file = 'bills.json'
            if os.path.exists(bills_file):
                with open(bills_file, 'r') as f:
                    bills = json.load(f)
            else:
                bills = []
        
        return jsonify({
            'success': True,
            'data': bills
        })
    except Exception as e:
        print(f"❌ Error getting bills: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/bills/<int:bill_id>', methods=['GET'])
def get_bill(bill_id):
    try:
        bill = db.get_bill(bill_id)
        
        if not bill:
            # Fallback: Get from local file
            bills_file = 'bills.json'
            if os.path.exists(bills_file):
                with open(bills_file, 'r') as f:
                    bills = json.load(f)
                for b in bills:
                    if b.get('id') == bill_id:
                        bill = b
                        break
        
        if bill:
            return jsonify({
                'success': True,
                'data': bill
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Bill not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/bills/<int:bill_id>', methods=['DELETE'])
def delete_bill(bill_id):
    try:
        result = db.delete_bill(bill_id)
        
        if not result:
            # Fallback: Delete from local file
            bills_file = 'bills.json'
            if os.path.exists(bills_file):
                with open(bills_file, 'r') as f:
                    bills = json.load(f)
                bills = [b for b in bills if b.get('id') != bill_id]
                with open(bills_file, 'w') as f:
                    json.dump(bills, f, indent=2)
                result = True
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Bill deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete bill'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    try:
        stats = db.get_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)