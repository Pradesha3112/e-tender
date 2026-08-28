# backend/test_usb.py
from usb_check import check_usb_connected

def test_usb():
    print("🔍 Testing USB detection...")
    print("=" * 40)
    
    is_connected, drives = check_usb_connected()
    
    if is_connected:
        print(f"✅ USB CONNECTED!")
        print(f"📁 Drive(s): {', '.join(drives)}")
    else:
        print("❌ NO USB DETECTED")
        print("Please insert a USB drive")
    
    print("=" * 40)
    return is_connected

if __name__ == '__main__':
    test_usb()