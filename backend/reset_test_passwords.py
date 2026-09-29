import requests

BASE = "http://localhost:5000"

# Login as admin
r = requests.post(f"{BASE}/login", json={"username": "admin", "password": "admin"})
token = r.json().get("token")
headers = {"Authorization": f"Bearer {token}"}

# Get all users
users = requests.get(f"{BASE}/users", headers=headers).json()["data"]

# Reset passwords
reset_map = {
    "rengasamy": "renga@123",
    "gopinath":  "gopi@123",
    "clerk1":    "clerk@123",
    "clerk2":    "clerk2@123",
}

for user in users:
    uname = user["username"]
    if uname in reset_map:
        r = requests.put(
            f"{BASE}/users/{user['id']}",
            headers=headers,
            json={"password": reset_map[uname]},
        )
        print(f"Reset {uname}: {r.status_code} → {r.json().get('success')}")

print("\nDone. Now all passwords are standard.")