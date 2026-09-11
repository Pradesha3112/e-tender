#!/usr/bin/env python
"""
Bill Scanner App - Server Launcher with Connection Check
Starts both Flask backend and Ionic frontend only when both are ready
"""

import os
import sys
import subprocess
import time
import platform
import threading
import webbrowser
import socket
import requests
import signal

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# ✅ Check BOTH possible frontend paths
FRONTEND_PATHS = [
    os.path.join(PROJECT_ROOT, 'frontend'),
    os.path.join(PROJECT_ROOT, 'mobile-app', 'bill-scanner-app')
]

# Find the correct frontend path
FRONTEND_PATH = None
for path in FRONTEND_PATHS:
    if os.path.exists(path):
        FRONTEND_PATH = path
        print(f"✅ Found frontend at: {path}")
        break

if FRONTEND_PATH is None:
    print("❌ Frontend folder not found!")
    print("   Looking in:")
    for path in FRONTEND_PATHS:
        print(f"   - {path}")
    sys.exit(1)

BACKEND_PATH = os.path.join(PROJECT_ROOT, 'backend')

BACKEND_URL = 'http://localhost:5000'
FRONTEND_URL = 'http://localhost:8100'

# Colors for console output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    CYAN = '\033[96m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

# Global process references
backend_process = None
frontend_process = None

def print_colored(text, color=Colors.RESET, bold=False):
    """Print colored text"""
    if bold:
        print(f"{Colors.BOLD}{color}{text}{Colors.RESET}")
    else:
        print(f"{color}{text}{Colors.RESET}")

def print_header():
    """Print application header"""
    print_colored("=" * 60, Colors.CYAN)
    print_colored("  🧾 BILL SCANNER APP - SMART LAUNCHER", Colors.YELLOW, bold=True)
    print_colored("=" * 60, Colors.CYAN)
    print()

def check_port(port, host='localhost'):
    """Check if a port is in use"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def check_url(url, timeout=3):
    """Check if a URL is responding"""
    try:
        response = requests.get(url, timeout=timeout)
        return response.status_code == 200
    except:
        return False

def wait_for_server(url, server_name, max_attempts=30, delay=2):
    """Wait for a server to become available"""
    print_colored(f"⏳ Waiting for {server_name}...", Colors.BLUE)
    
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                print_colored(f"✅ {server_name} is ready! (Attempt {attempt + 1})", Colors.GREEN)
                return True
        except:
            pass
        
        # Show progress
        sys.stdout.write(f'\r   Attempt {attempt + 1}/{max_attempts}...')
        sys.stdout.flush()
        time.sleep(delay)
    
    print()
    print_colored(f"❌ {server_name} failed to start after {max_attempts} attempts", Colors.RED)
    return False

def find_ionic_path():
    """Find Ionic CLI installation path"""
    try:
        # Try 'where' on Windows
        if platform.system() == 'Windows':
            result = subprocess.run(['where', 'ionic'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip().split('\n')[0]
        else:
            result = subprocess.run(['which', 'ionic'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
    except:
        pass
    
    # Check common npm global paths
    npm_global_paths = [
        'C:\\Users\\USER\\AppData\\Roaming\\npm\\ionic.cmd',
        'C:\\Users\\USER\\AppData\\Roaming\\npm\\ionic',
        'C:\\Program Files\\nodejs\\ionic.cmd',
        '/usr/local/bin/ionic',
        '/usr/bin/ionic'
    ]
    
    for path in npm_global_paths:
        if os.path.exists(path):
            return path
    
    return None

def start_backend():
    """Start Flask backend server"""
    global backend_process
    
    try:
        print_colored("🚀 Starting Backend Server...", Colors.GREEN)
        
        # Check if backend port is already in use
        if check_port(5000):
            print_colored("⚠️ Backend port 5000 is already in use!", Colors.YELLOW)
            print_colored("   Trying to connect to existing server...", Colors.BLUE)
            
            if check_url(BACKEND_URL):
                print_colored("✅ Existing backend server is running!", Colors.GREEN)
                return True
            else:
                print_colored("❌ Port 5000 is in use but server is not responding!", Colors.RED)
                return False
        
        # Check if backend folder exists
        if not os.path.exists(BACKEND_PATH):
            print_colored(f"❌ Backend path not found: {BACKEND_PATH}", Colors.RED)
            return False
        
        # Move to backend directory
        os.chdir(BACKEND_PATH)
        
        # ✅ Start backend in new window
        if platform.system() == 'Windows':
            cmd = f'start "Bill Scanner Backend" cmd /k "cd /d {BACKEND_PATH} && venv\\Scripts\\activate && python app.py"'
            backend_process = subprocess.Popen(cmd, shell=True)
        else:
            backend_process = subprocess.Popen(
                ['bash', '-c', f'cd {BACKEND_PATH} && source venv/bin/activate && python app.py']
            )
        
        print_colored("🔄 Backend process started, waiting for it to be ready...", Colors.BLUE)
        
        return wait_for_server(BACKEND_URL, 'Backend Server')
        
    except Exception as e:
        print_colored(f"❌ Error starting backend: {e}", Colors.RED)
        return False

def start_frontend():
    """Start Ionic frontend server"""
    global frontend_process
    
    try:
        print_colored("🚀 Starting Frontend Server...", Colors.GREEN)
        
        # Check if frontend port is already in use
        if check_port(8100):
            print_colored("⚠️ Frontend port 8100 is already in use!", Colors.YELLOW)
            print_colored("   Trying to connect to existing server...", Colors.BLUE)
            
            if check_url(FRONTEND_URL):
                print_colored("✅ Existing frontend server is running!", Colors.GREEN)
                return True
            else:
                print_colored("❌ Port 8100 is in use but server is not responding!", Colors.RED)
                return False
        
        # Check if frontend folder exists
        if not os.path.exists(FRONTEND_PATH):
            print_colored(f"❌ Frontend path not found: {FRONTEND_PATH}", Colors.RED)
            return False
        
        # ✅ Find Ionic path
        ionic_path = find_ionic_path()
        if ionic_path:
            print_colored(f"✅ Found Ionic at: {ionic_path}", Colors.GREEN)
        else:
            print_colored("❌ Ionic CLI not found!", Colors.RED)
            print_colored("   Please install it: npm install -g @ionic/cli", Colors.YELLOW)
            return False
        
        # Move to frontend directory
        os.chdir(FRONTEND_PATH)
        
        # ✅ Start frontend in new window
        if platform.system() == 'Windows':
            cmd = f'start "Bill Scanner Frontend" cmd /k "cd /d {FRONTEND_PATH} && {ionic_path} serve"'
            frontend_process = subprocess.Popen(cmd, shell=True)
        else:
            frontend_process = subprocess.Popen(
                ['bash', '-c', f'cd {FRONTEND_PATH} && ionic serve']
            )
        
        print_colored("🔄 Frontend process started, waiting for it to be ready...", Colors.BLUE)
        
        return wait_for_server(FRONTEND_URL, 'Frontend Server')
        
    except Exception as e:
        print_colored(f"❌ Error starting frontend: {e}", Colors.RED)
        return False

def open_browser():
    """Open browser after both servers are ready"""
    print_colored("\n🌐 Opening browser...", Colors.MAGENTA)
    time.sleep(2)
    webbrowser.open(FRONTEND_URL)
    print_colored(f"📱 App opened at: {FRONTEND_URL}", Colors.CYAN)

def signal_handler(sig, frame):
    """Handle Ctrl+C to kill both processes"""
    print_colored("\n\n🛑 Stopping all servers...", Colors.RED)
    sys.exit(0)

def main():
    """Main function"""
    global backend_process, frontend_process
    
    signal.signal(signal.SIGINT, signal_handler)
    
    print_header()
    
    # ============================================================
    # STEP 1: Start Backend
    # ============================================================
    backend_ready = start_backend()
    
    if not backend_ready:
        print_colored("\n❌ Backend failed to start. Exiting...", Colors.RED)
        print_colored("\n💡 Troubleshooting tips:", Colors.YELLOW)
        print_colored("   1. Check if virtual environment exists: backend/venv", Colors.BLUE)
        print_colored("   2. Check if app.py exists in backend folder", Colors.BLUE)
        print_colored("   3. Try manually: cd backend && venv\\Scripts\\activate && python app.py", Colors.BLUE)
        sys.exit(1)
    
    print_colored("✅ Backend is running!", Colors.GREEN)
    print()
    
    # ============================================================
    # STEP 2: Start Frontend
    # ============================================================
    frontend_ready = start_frontend()
    
    if not frontend_ready:
        print_colored("\n❌ Frontend failed to start. Exiting...", Colors.RED)
        print_colored("\n💡 Troubleshooting tips:", Colors.YELLOW)
        print_colored("   1. Make sure Ionic CLI is installed: npm install -g @ionic/cli", Colors.BLUE)
        print_colored("   2. Check if node_modules exists in frontend folder", Colors.BLUE)
        print_colored("   3. Try manually: cd frontend && ionic serve", Colors.BLUE)
        sys.exit(1)
    
    print_colored("✅ Frontend is running!", Colors.GREEN)
    print()
    
    # ============================================================
    # STEP 3: Both servers are ready!
    # ============================================================
    print_colored("=" * 60, Colors.CYAN)
    print_colored("  ✅ BOTH SERVERS ARE READY!", Colors.GREEN, bold=True)
    print_colored("=" * 60, Colors.CYAN)
    print()
    
    print_colored("📱 Frontend URL:", Colors.CYAN)
    print_colored(f"   {FRONTEND_URL}", Colors.CYAN, bold=True)
    print()
    
    print_colored("🖥️  Backend URL:", Colors.CYAN)
    print_colored(f"   {BACKEND_URL}", Colors.CYAN, bold=True)
    print()
    
    print_colored("📋 Servers running:", Colors.GREEN)
    print_colored("   ✅ Flask Backend  : http://localhost:5000", Colors.GREEN)
    print_colored("   ✅ Ionic Frontend : http://localhost:8100", Colors.GREEN)
    print()
    
    print_colored("⏹️  Press Ctrl+C to stop all servers", Colors.YELLOW)
    print_colored("=" * 60, Colors.CYAN)
    
    # Open browser
    open_browser()
    
    # Keep script running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        signal_handler(signal.SIGINT, None)

if __name__ == '__main__':
    # Check for required packages
    try:
        import requests
    except ImportError:
        print_colored("❌ 'requests' module not found. Installing...", Colors.YELLOW)
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
        print_colored("✅ 'requests' installed successfully!", Colors.GREEN)
        print()
    
    main()