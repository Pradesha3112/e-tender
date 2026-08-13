import pytesseract
from PIL import Image
import os

# Set Tesseract path
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def test_ocr():
    print("🧪 Testing Tesseract OCR...")
    
    # Check if tesseract is installed
    try:
        version = pytesseract.get_tesseract_version()
        print(f"✅ Tesseract version: {version}")
    except Exception as e:
        print(f"❌ Tesseract not found: {e}")
        return
    
    # Test with a sample text image
    test_image_path = "test_bill.jpg"
    
    if os.path.exists(test_image_path):
        print(f"📸 Testing with: {test_image_path}")
        try:
            image = Image.open(test_image_path)
            text = pytesseract.image_to_string(image)
            print(f"📄 Extracted Text:\n{text}")
            
            if len(text.strip()) > 10:
                print("✅ OCR is working correctly!")
            else:
                print("⚠️ Very little text extracted. Check image quality.")
        except Exception as e:
            print(f"❌ Error reading image: {e}")
    else:
        print(f"⚠️ Test image not found: {test_image_path}")
        print("Please place a bill image named 'test_bill.jpg' in the backend folder")
        print("Or run the app and upload a bill through the frontend")

if __name__ == "__main__":
    test_ocr()