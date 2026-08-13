from flask import Flask, request, jsonify
from flask_cors import CORS
from ocr_simple import extract_text_from_image  # ← Use simple OCR

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "Bill Scanner API is working! 🎉"

@app.route('/upload', methods=['POST'])
def upload_bill():
    try:
        data = request.json
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({
                'success': False,
                'error': 'No image provided'
            }), 400
        
        print("📸 Processing image with OCR...")
        
        # Extract text from image
        extracted_data = extract_text_from_image(image_data)
        
        print(f"✅ Extracted: {extracted_data}")
        
        return jsonify({
            'success': True,
            'data': extracted_data,
            'message': 'Bill processed successfully!'
        })
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/save', methods=['POST'])
def save_bill():
    try:
        bill_data = request.json
        print(f"💾 Saving bill: {bill_data}")
        return jsonify({
            'success': True,
            'message': 'Bill saved successfully!',
            'id': 1
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/bills', methods=['GET'])
def get_bills():
    try:
        bills = [
            {
                'id': 1,
                'bill_number': 'SR/ENG/Works/2024-25/112',
                'vendor': 'M/s. ABC Infra Solutions Pvt. Ltd.',
                'date': '2024-05-25',
                'total': 3932400.00
            }
        ]
        return jsonify({
            'success': True,
            'data': bills
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)