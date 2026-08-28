# backend/usb_check.py
import string
from ctypes import windll

def get_removable_drives():
    """Get all removable/USB drives on Windows"""
    devices = []
    record_deviceBit = windll.kernel32.GetLogicalDrives()
    
    for label in string.ascii_uppercase:
        if record_deviceBit & 1:
            drive_path = label + ":\\"
            try:
                # Get drive type: 2 = removable (USB)
                drive_type = windll.kernel32.GetDriveTypeW(drive_path)
                if drive_type == 2:  # DRIVE_REMOVABLE
                    devices.append(label)
            except:
                pass
        record_deviceBit >>= 1
    
    return devices

def check_usb_connected():
    """Check if any USB drive is connected"""
    drives = get_removable_drives()
    return len(drives) > 0, drives