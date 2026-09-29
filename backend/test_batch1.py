# ============================================================
# FILE: test_full_system.py
# PURPOSE: Complete end-to-end system test
#          Covers: auth, RBAC, bills, users, categories,
#                  password reset, isolation, edge cases
# RUN: python test_full_system.py
# ============================================================

import requests
import sys

BASE = "http://localhost:5000"

# ANSI colors
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# Test tracking
PASSED = 0
FAILED = 0
WARNINGS = 0
FAILURES = []
WARNING_MSGS = []

# ============================================================
# HELPERS
# ============================================================
def check(condition, label, detail=""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  {GREEN}✅ PASS{RESET}  {label}")
        return True
    FAILED += 1
    FAILURES.append(label)
    print(f"  {RED}❌ FAIL{RESET}  {label}")
    if detail:
        print(f"        {detail}")
    return False


def warn(label, detail=""):
    global WARNINGS
    WARNINGS += 1
    WARNING_MSGS.append(label)
    print(f"  {YELLOW}⚠️  WARN{RESET}  {label}")
    if detail:
        print(f"        {detail}")


def header(title):
    print()
    print(f"{BOLD}{CYAN}{'=' * 72}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 72}{RESET}")


def sub(title):
    print()
    print(f"{BOLD}▶ {title}{RESET}")


def api(method, path, token=None, json_data=None, timeout=15):
    """Make API call → return (status_code, response_json)."""
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.request(method, url, headers=headers, json=json_data, timeout=timeout)
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, {"raw": r.text}
    except requests.exceptions.ConnectionError:
        return 0, {"error": "Cannot connect to backend"}
    except Exception as e:
        return 0, {"error": str(e)}


def login(username, password):
    """Login → return (token, user_dict) or (None, None)."""
    status, body = api("POST", "/login", json_data={
        "username": username, "password": password
    })
    if status == 200 and body.get("success"):
        return body.get("token"), body.get("user")
    return None, None


# ============================================================
# SETUP — CLEAN STATE
# ============================================================
def cleanup_users():
    """Remove all non-admin users so tests start clean."""
    print(f"\n{BOLD}🧹 Cleanup — removing non-admin users...{RESET}")
    admin_token, _ = login("admin", "admin")
    if not admin_token:
        print(f"  {RED}Cannot login as admin — is Flask running?{RESET}")
        print(f"  Start it: cd backend && python app.py")
        sys.exit(1)

    _, body = api("GET", "/users", token=admin_token)
    users = body.get("data", [])
    deleted = 0
    for u in users:
        if u["username"] == "admin":
            continue
        api("DELETE", f"/users/{u['id']}", token=admin_token)
        deleted += 1
    print(f"  {GREEN}✅ Cleaned up {deleted} user(s){RESET}")


# ============================================================
# 1. HEALTH & PUBLIC ROUTES
# ============================================================
def test_health():
    header("1 — Health & Public Routes")

    sub("1.1 Backend reachable")
    status, body = api("GET", "/")
    check(status == 200, "GET / returns 200", f"Got {status}")

    sub("1.2 Protected routes without token")
    for path in ["/bills", "/me", "/users", "/categories", "/stats", "/notices", "/activity"]:
        status, _ = api("GET", path)
        check(status == 401, f"GET {path} without token → 401", f"Got {status}")

    sub("1.3 Invalid / malformed tokens")
    for bad_token in ["garbage", "invalid.jwt.token", ""]:
        status, _ = api("GET", "/me", token=bad_token)
        check(status == 401, f"Bad token '{bad_token or '(empty)'}' → 401", f"Got {status}")


# ============================================================
# 2. AUTHENTICATION
# ============================================================
def test_auth():
    header("2 — Authentication")

    sub("2.1 Admin hardcoded login")
    token, user = login("admin", "admin")
    check(token is not None, "admin/admin login works")
    if user:
        check(user.get("role") == "admin", "Admin role = admin", f"Got {user.get('role')}")
        check(user.get("category_group") == "all", "Admin group = all")

    sub("2.2 Wrong credentials")
    token, _ = login("admin", "wrong")
    check(token is None, "Wrong password rejected")

    token, _ = login("", "")
    check(token is None, "Empty credentials rejected")

    token, _ = login("nonexistent", "nothing")
    check(token is None, "Nonexistent user rejected")

    sub("2.3 Case-insensitive username")
    token, _ = login("ADMIN", "admin")
    check(token is not None, "ADMIN (uppercase) accepted")


# ============================================================
# 3. USER CREATION
# ============================================================
def test_user_creation():
    header("3 — User Creation by Admin")
    admin_token, _ = login("admin", "admin")

    sub("3.1 Create SUPER_ADMIN (rengasamy)")
    status, body = api("POST", "/users", token=admin_token, json_data={
        "username": "rengasamy",
        "password": "renga@123",
        "full_name": "Shri. P. Rengasamy",
        "role": "super_admin",
        "category_group": "adfm_1",
        "designation": "ADFM/I/MDU",
    })
    check(status == 201, "Create rengasamy → 201", f"Got {status}: {body}")
    if body.get("success"):
        check(body["data"].get("category_group") == "adfm_1", "rengasamy group = adfm_1")

    sub("3.2 Create SUPER_ADMIN (gopinath)")
    status, body = api("POST", "/users", token=admin_token, json_data={
        "username": "gopinath",
        "password": "gopi@123",
        "full_name": "Shri. S. Gopinath",
        "role": "super_admin",
        "category_group": "adfm_2",
        "designation": "ADFM/II/MDU",
    })
    check(status == 201, "Create gopinath → 201", f"Got {status}")

    sub("3.3 Create CLERK (clerk1)")
    status, body = api("POST", "/users", token=admin_token, json_data={
        "username": "clerk1",
        "password": "clerk1@123",
        "full_name": "Clerk One",
        "role": "clerk",
        "category_group": "adfm_1",
    })
    check(status == 201, "Create clerk1 → 201", f"Got {status}")

    sub("3.4 Validation rules")
    status, _ = api("POST", "/users", token=admin_token, json_data={
        "username": "admin2", "password": "x", "full_name": "X", "role": "admin"
    })
    check(status in (400, 403), "Cannot create another admin", f"Got {status}")

    status, _ = api("POST", "/users", token=admin_token, json_data={
        "username": "rengasamy", "password": "x", "full_name": "Dup", "role": "clerk"
    })
    check(status == 409, "Duplicate username → 409", f"Got {status}")

    status, _ = api("POST", "/users", token=admin_token, json_data={
        "username": "admin", "password": "x", "full_name": "X", "role": "clerk"
    })
    check(status == 400, "Reserved username 'admin' rejected", f"Got {status}")

    status, _ = api("POST", "/users", token=admin_token, json_data={
        "username": "sabadm", "password": "x", "full_name": "X",
        "role": "super_admin", "category_group": "all"
    })
    check(status == 400, "super_admin with group='all' rejected", f"Got {status}")


# ============================================================
# 4. ROLE LOGINS
# ============================================================
def test_role_logins():
    header("4 — Login as Different Roles")

    sub("4.1 rengasamy (S.A., adfm_1)")
    token, user = login("rengasamy", "renga@123")
    check(token is not None, "rengasamy login works")
    if user:
        check(user.get("role") == "super_admin", "role = super_admin")
        check(user.get("category_group") == "adfm_1", "group = adfm_1")

    sub("4.2 gopinath (S.A., adfm_2)")
    token, user = login("gopinath", "gopi@123")
    check(token is not None, "gopinath login works")
    if user:
        check(user.get("category_group") == "adfm_2", "group = adfm_2")

    sub("4.3 clerk1")
    token, user = login("clerk1", "clerk1@123")
    check(token is not None, "clerk1 login works")
    if user:
        check(user.get("role") == "clerk", "role = clerk")
        check(user.get("category_group") == "adfm_1", "inherited group = adfm_1")


# ============================================================
# 5. PERMISSION RULES
# ============================================================
def test_permissions():
    header("5 — Permission Rules")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")
    clerk_token, _ = login("clerk1", "clerk1@123")

    sub("5.1 Super admin CANNOT create super_admin")
    status, _ = api("POST", "/users", token=renga_token, json_data={
        "username": "sa2", "password": "x", "full_name": "X",
        "role": "super_admin", "category_group": "adfm_2"
    })
    check(status == 403, "S.A. → S.A. blocked (403)", f"Got {status}")

    sub("5.2 Super admin CAN create clerk")
    status, body = api("POST", "/users", token=renga_token, json_data={
        "username": "clerk2", "password": "clerk2@123",
        "full_name": "Clerk Two", "role": "clerk"
    })
    check(status == 201, "S.A. → clerk works (201)", f"Got {status}")
    if body.get("success"):
        check(body["data"].get("category_group") == "adfm_1",
              "clerk2 inherits adfm_1")

    sub("5.3 Clerk CANNOT create anyone")
    status, _ = api("POST", "/users", token=clerk_token, json_data={
        "username": "c3", "password": "x", "full_name": "X", "role": "clerk"
    })
    check(status == 403, "Clerk → clerk blocked (403)", f"Got {status}")

    sub("5.4 Clerk CANNOT list users")
    status, _ = api("GET", "/users", token=clerk_token)
    check(status == 403, "Clerk GET /users blocked (403)", f"Got {status}")

    sub("5.5 Admin CAN list users")
    status, body = api("GET", "/users", token=admin_token)
    check(status == 200, "Admin GET /users works")
    if body.get("success"):
        usernames = [u["username"] for u in body["data"]]
        check("rengasamy" in usernames, "rengasamy in list")
        check("gopinath" in usernames, "gopinath in list")
        check("clerk1" in usernames, "clerk1 in list")


# ============================================================
# 6. BILL VISIBILITY
# ============================================================
def test_bill_visibility():
    header("6 — Bill Visibility by Role")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")
    gopi_token, _ = login("gopinath", "gopi@123")
    clerk_token, _ = login("clerk1", "clerk1@123")

    sub("6.1 Admin sees all")
    status, body = api("GET", "/bills", token=admin_token)
    admin_count = len(body.get("data", []))
    check(status == 200, f"Admin GET /bills works ({admin_count} bills)")

    sub("6.2 rengasamy sees only adfm_1")
    status, body = api("GET", "/bills", token=renga_token)
    renga_count = len(body.get("data", []))
    check(status == 200, f"rengasamy GET /bills works ({renga_count} bills)")
    check(renga_count <= admin_count, "rengasamy <= admin")

    sub("6.3 gopinath sees only adfm_2")
    status, body = api("GET", "/bills", token=gopi_token)
    gopi_count = len(body.get("data", []))
    check(status == 200, f"gopinath GET /bills works ({gopi_count} bills)")

    sub("6.4 Clerk sees only own")
    status, body = api("GET", "/bills", token=clerk_token)
    clerk_count = len(body.get("data", []))
    check(status == 200, f"clerk1 GET /bills works ({clerk_count} bills)")
    check(clerk_count <= admin_count, "clerk1 <= admin")

    sub("6.5 Stats match bill count")
    status, body = api("GET", "/stats", token=admin_token)
    total = body.get("data", {}).get("total_bills", 0)
    check(total == admin_count, f"Admin stats total ({total}) = bills ({admin_count})")


# ============================================================
# 7. CATEGORIES
# ============================================================
def test_categories():
    header("7 — Category Endpoint")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")
    gopi_token, _ = login("gopinath", "gopi@123")

    sub("7.1 Admin sees all 12")
    status, body = api("GET", "/categories", token=admin_token)
    check(status == 200, "Admin GET /categories works")
    data = body.get("data", {})
    check(data.get("allow_all") is True, "Admin allow_all = true")
    check(len(data.get("categories", [])) == 12, "Admin sees 12 categories")

    sub("7.2 rengasamy sees only 6 (adfm_1)")
    status, body = api("GET", "/categories", token=renga_token)
    data = body.get("data", {})
    check(data.get("allow_all") is False, "rengasamy allow_all = false")
    check(len(data.get("categories", [])) == 6, "rengasamy sees 6")
    check("Establishment Bills" in data.get("categories", []), "has Establishment")
    check("Administration" not in data.get("categories", []), "no Administration")

    sub("7.3 gopinath sees only 6 (adfm_2)")
    status, body = api("GET", "/categories", token=gopi_token)
    data = body.get("data", {})
    check(len(data.get("categories", [])) == 6, "gopinath sees 6")
    check("Administration" in data.get("categories", []), "has Administration")


# ============================================================
# 8. BILL SAVE + AUTO-CATEGORIZATION
# ============================================================
def test_bill_save():
    header("8 — Bill Save + Auto-Categorization")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")
    clerk_token, _ = login("clerk1", "clerk1@123")
    gopi_token, _ = login("gopinath", "gopi@123")

    sample = {
        "bill_number": "TEST-001",
        "vendor": "Test Vendor",
        "date": "2026-09-26",
        "subtotal": 1000, "tax": 180, "total": 1180,
        "gstin": "33AAAAA0000A1Z5",
        "items": [{"name": "Item", "price": 500, "qty": 2}],
    }

    sub("8.1 S.A. saves bill with adfm_1 category")
    payload = {**sample, "bill_number": "ADFM1-001", "category": "Establishment Bills"}
    status, body = api("POST", "/save", token=renga_token, json_data=payload)
    check(status == 200, "rengasamy saves bill → 200", f"Got {status}")
    if body.get("success"):
        saved = body["data"]
        check(saved.get("category_group") == "adfm_1", "group = adfm_1")
        check(saved.get("created_by") == "rengasamy", "created_by = rengasamy")
        check(saved.get("created_by_role") == "super_admin", "role = super_admin")

    sub("8.2 S.A. cannot use adfm_2 category")
    payload = {**sample, "bill_number": "BAD-001", "category": "Administration"}
    status, _ = api("POST", "/save", token=renga_token, json_data=payload)
    check(status == 403, "S.A. using adfm_2 category → 403", f"Got {status}")

    sub("8.3 Clerk saves bill (inherits adfm_1)")
    payload = {**sample, "bill_number": "CLERK-001", "category": "Pension, NPS, PF"}
    status, body = api("POST", "/save", token=clerk_token, json_data=payload)
    check(status == 200, "clerk1 saves bill → 200", f"Got {status}")
    if body.get("success"):
        check(body["data"].get("created_by") == "clerk1", "created_by = clerk1")
        check(body["data"].get("category_group") == "adfm_1", "group = adfm_1")

    sub("8.4 Admin saves with any category")
    payload = {**sample, "bill_number": "ADMIN-001", "category": "Administration"}
    status, body = api("POST", "/save", token=admin_token, json_data=payload)
    check(status == 200, "admin saves → 200")
    if body.get("success"):
        check(body["data"].get("category_group") == "adfm_2",
              "Admin bill tagged adfm_2 from Administration category")

    sub("8.5 Visibility after saves (tolerant — no exact counts)")
    # Get all 3 roles' bill lists after the saves above
    _, body_renga = api("GET", "/bills", token=renga_token)
    _, body_clerk = api("GET", "/bills", token=clerk_token)
    _, body_gopi  = api("GET", "/bills", token=gopi_token)

    renga_bills = body_renga.get("data", [])
    clerk_bills = body_clerk.get("data", [])
    gopi_bills  = body_gopi.get("data", [])

    # rengasamy (adfm_1) sees own + clerk1's bills (both adfm_1)
    check(len(renga_bills) >= 2,
          f"rengasamy sees >= 2 adfm_1 bills (got {len(renga_bills)})")

    # clerk1 sees only their own bills
    check(len(clerk_bills) >= 1,
          f"clerk1 sees >= 1 own bill (got {len(clerk_bills)})")

    # Every bill clerk1 sees MUST be created by clerk1
    all_own = all(b.get("created_by") == "clerk1" for b in clerk_bills)
    check(all_own, "clerk1 sees only bills they created")

    # gopinath (adfm_2) sees at least 1 (admin's Administration bill)
    check(len(gopi_bills) >= 1,
          f"gopinath sees >= 1 adfm_2 bill (got {len(gopi_bills)})")

    # Every bill gopinath sees MUST be adfm_2
    all_adfm2 = all(b.get("category_group") == "adfm_2" for b in gopi_bills)
    check(all_adfm2, "gopinath sees only adfm_2 bills")

    # Every bill rengasamy sees MUST be adfm_1
    all_adfm1 = all(b.get("category_group") == "adfm_1" for b in renga_bills)
    check(all_adfm1, "rengasamy sees only adfm_1 bills")


# ============================================================
# 9. USER MANAGEMENT OPERATIONS
# ============================================================
def test_user_management():
    header("9 — User Management Operations")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")

    _, body = api("GET", "/users", token=admin_token)
    users = body.get("data", [])
    clerk1 = next((u for u in users if u["username"] == "clerk1"), None)
    gopinath = next((u for u in users if u["username"] == "gopinath"), None)

    if not clerk1 or not gopinath:
        warn("Cannot find clerk1 or gopinath for testing")
        return

    sub("9.1 Deactivate clerk1")
    status, body = api("POST", f"/users/{clerk1['id']}/toggle", token=admin_token)
    check(status == 200, "Toggle → 200")
    check(body.get("is_active") == 0, "is_active = 0")

    sub("9.2 Deactivated clerk cannot login")
    token, _ = login("clerk1", "clerk1@123")
    check(token is None, "Deactivated clerk login rejected")

    sub("9.3 Reactivate clerk1")
    status, body = api("POST", f"/users/{clerk1['id']}/toggle", token=admin_token)
    check(body.get("is_active") == 1, "is_active = 1")

    sub("9.4 Reactivated clerk CAN login")
    token, _ = login("clerk1", "clerk1@123")
    check(token is not None, "Reactivated clerk login works")

    sub("9.5 Update user details")
    status, body = api("PUT", f"/users/{clerk1['id']}", token=admin_token, json_data={
        "full_name": "Clerk One Updated",
        "designation": "Senior Clerk",
    })
    check(status == 200, "Update → 200")
    if body.get("success"):
        check(body["data"].get("full_name") == "Clerk One Updated", "name updated")
        check(body["data"].get("designation") == "Senior Clerk", "designation updated")

    sub("9.6 Reset clerk password")
    status, _ = api("PUT", f"/users/{clerk1['id']}", token=admin_token, json_data={
        "password": "newpass123"
    })
    check(status == 200, "Password reset → 200")
    token, _ = login("clerk1", "newpass123")
    check(token is not None, "New password works")
    token, _ = login("clerk1", "clerk1@123")
    check(token is None, "Old password rejected")

    sub("9.7 S.A. cannot edit another S.A.")
    status, _ = api("PUT", f"/users/{gopinath['id']}", token=renga_token, json_data={
        "full_name": "Should Fail"
    })
    check(status == 403, "S.A. editing S.A. → 403", f"Got {status}")

    sub("9.8 S.A. cannot delete another S.A.")
    status, _ = api("DELETE", f"/users/{gopinath['id']}", token=renga_token)
    check(status == 403, "S.A. deleting S.A. → 403", f"Got {status}")

    sub("9.9 Admin cannot be edited")
    status, _ = api("PUT", "/users/1", token=admin_token, json_data={
        "full_name": "New Name"
    })
    check(status in (400, 403, 404), "Admin edit rejected", f"Got {status}")


# ============================================================
# 10. SELF-PASSWORD CHANGE
# ============================================================
def test_password_change():
    header("10 — Self Password Change (admin)")

    sub("10.1 Wrong current password")
    admin_token, _ = login("admin", "admin")
    status, body = api("PUT", "/me/password", token=admin_token, json_data={
        "current_password": "WRONG",
        "new_password": "test1234"
    })
    check(status == 401, "Wrong current password → 401", f"Got {status}")

    sub("10.2 Short new password")
    status, body = api("PUT", "/me/password", token=admin_token, json_data={
        "current_password": "admin",
        "new_password": "x"
    })
    check(status == 400, "Short password → 400", f"Got {status}")

    sub("10.3 Valid change")
    status, body = api("PUT", "/me/password", token=admin_token, json_data={
        "current_password": "admin",
        "new_password": "admin@2026"
    })
    check(status == 200, "Change → 200", f"Got {status}")

    sub("10.4 Old password no longer works")
    token, _ = login("admin", "admin")
    check(token is None, "Old admin/admin rejected")

    sub("10.5 New password works")
    token, _ = login("admin", "admin@2026")
    check(token is not None, "New admin@2026 works")

    sub("10.6 Restore default password")
    admin_token, _ = login("admin", "admin@2026")
    status, _ = api("PUT", "/me/password", token=admin_token, json_data={
        "current_password": "admin@2026",
        "new_password": "admin"
    })
    check(status == 200, "Restore → 200")


# ============================================================
# 11. BILL ACCESS CONTROL
# ============================================================
def test_bill_access():
    header("11 — Bill Access Control")
    admin_token, _ = login("admin", "admin")
    renga_token, _ = login("rengasamy", "renga@123")
    gopi_token, _ = login("gopinath", "gopi@123")

    _, body = api("GET", "/bills", token=renga_token)
    renga_bills = body.get("data", [])
    if not renga_bills:
        warn("No adfm_1 bills to test access")
        return

    # Pick a bill owned by rengasamy (not clerk1)
    own_bill = next((b for b in renga_bills if b.get("created_by") == "rengasamy"), None)
    if not own_bill:
        warn("No rengasamy-owned bill to test access")
        return
    bill_id = own_bill["id"]

    sub("11.1 Owner can view own bill")
    status, _ = api("GET", f"/bills/{bill_id}", token=renga_token)
    check(status == 200, "Owner view → 200")

    sub("11.2 Other S.A. blocked from viewing")
    status, _ = api("GET", f"/bills/{bill_id}", token=gopi_token)
    check(status == 403, "Other S.A. blocked → 403", f"Got {status}")

    sub("11.3 Admin can view any bill")
    status, _ = api("GET", f"/bills/{bill_id}", token=admin_token)
    check(status == 200, "Admin view → 200")

    sub("11.4 Nonexistent bill → 404")
    status, _ = api("GET", "/bills/999999", token=admin_token)
    check(status == 404, "Nonexistent → 404", f"Got {status}")


# ============================================================
# 12. NOTICES & ACTIVITY
# ============================================================
def test_dashboard_endpoints():
    header("12 — Notices & Activity")
    admin_token, _ = login("admin", "admin")

    sub("12.1 Notices endpoint")
    status, body = api("GET", "/notices", token=admin_token)
    check(status == 200, "GET /notices → 200")
    if body.get("success"):
        check(len(body.get("data", [])) > 0, "Notices list non-empty")
        notice = body["data"][0]
        check("title" in notice, "Notice has title")
        check("type" in notice, "Notice has type")

    sub("12.2 Activity endpoint")
    status, body = api("GET", "/activity", token=admin_token)
    check(status == 200, "GET /activity → 200")
    if body.get("success"):
        check(isinstance(body.get("data", []), list), "Activity is a list")


# ============================================================
# 13. USER DELETE
# ============================================================
def test_user_delete():
    header("13 — User Deletion")
    admin_token, _ = login("admin", "admin")

    _, body = api("GET", "/users", token=admin_token)
    clerk2 = next((u for u in body.get("data", []) if u["username"] == "clerk2"), None)
    if not clerk2:
        warn("clerk2 not found for deletion test")
        return

    sub("13.1 Admin deletes clerk2")
    status, _ = api("DELETE", f"/users/{clerk2['id']}", token=admin_token)
    check(status == 200, "Delete → 200")

    sub("13.2 Deleted user cannot login")
    token, _ = login("clerk2", "clerk2@123")
    check(token is None, "Deleted user login rejected")

    sub("13.3 Deleted user no longer in list")
    _, body = api("GET", "/users", token=admin_token)
    usernames = [u["username"] for u in body.get("data", [])]
    check("clerk2" not in usernames, "clerk2 gone from list")


# ============================================================
# MAIN
# ============================================================
def main():
    print()
    print(f"{BOLD}{CYAN}╔{'═' * 70}╗{RESET}")
    print(f"{BOLD}{CYAN}║{' ' * 18}FULL SYSTEM TEST SUITE{' ' * 31}║{RESET}")
    print(f"{BOLD}{CYAN}║{' ' * 15}Railway E-Billing v3.0 (RBAC){' ' * 26}║{RESET}")
    print(f"{BOLD}{CYAN}╚{'═' * 70}╝{RESET}")

    status, _ = api("GET", "/")
    if status != 200:
        print(f"\n{RED}❌ Backend not reachable at {BASE}{RESET}")
        print(f"   Start it: cd backend && python app.py")
        sys.exit(1)

    print(f"{GREEN}✅ Backend reachable at {BASE}{RESET}")

    cleanup_users()

    # Run all sections
    test_health()
    test_auth()
    test_user_creation()
    test_role_logins()
    test_permissions()
    test_bill_visibility()
    test_categories()
    test_bill_save()
    test_user_management()
    test_password_change()
    test_bill_access()
    test_dashboard_endpoints()
    test_user_delete()

    # Summary
    header("TEST SUMMARY")
    total = PASSED + FAILED
    print(f"  Total:    {BOLD}{total}{RESET}")
    print(f"  {GREEN}Passed:   {PASSED}{RESET}")
    if FAILED > 0:
        print(f"  {RED}Failed:   {FAILED}{RESET}")
    else:
        print(f"  Failed:   0")
    print(f"  {YELLOW}Warnings: {WARNINGS}{RESET}")

    if FAILED > 0:
        print(f"\n  {RED}❌ Failed tests:{RESET}")
        for f in FAILURES:
            print(f"    • {f}")
        print()
        sys.exit(1)
    else:
        print(f"\n  {GREEN}{BOLD}🎉 ALL TESTS PASSED — SYSTEM FULLY OPERATIONAL{RESET}\n")
        if WARNINGS > 0:
            print(f"  {YELLOW}Warnings:{RESET}")
            for w in WARNING_MSGS:
                print(f"    • {w}")
            print()
        sys.exit(0)


if __name__ == "__main__":
    main()