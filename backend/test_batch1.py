# ============================================================
# FILE: test_delete_reason.py
# PURPOSE: Test delete-with-reason flow
# RUN: python test_delete_reason.py
# ============================================================

import requests

BASE = "http://localhost:5000"
GREEN = "\033[92m"; RED = "\033[91m"; YELLOW = "\033[93m"
CYAN = "\033[96m"; BOLD = "\033[1m"; RESET = "\033[0m"

PASSED = 0; FAILED = 0

def check(cond, label):
    global PASSED, FAILED
    if cond:
        PASSED += 1
        print(f"  {GREEN}✅ PASS{RESET}  {label}")
    else:
        FAILED += 1
        print(f"  {RED}❌ FAIL{RESET}  {label}")

def section(t):
    print(f"\n{BOLD}{CYAN}▶ {t}{RESET}")

def login(u, p):
    r = requests.post(f"{BASE}/login", json={"username": u, "password": p})
    return r.json().get("token")

def make_bill(token, bill_number, category="Establishment Bills"):
    h = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE}/save", headers=h, json={
        "bill_number": bill_number,
        "vendor": f"Reason Test {bill_number}",
        "date": "2026-10-09",
        "subtotal": 100, "tax": 18, "total": 118,
        "category": category,
    })
    return r.json().get("data", {}).get("id") if r.status_code == 200 else None

def main():
    print(f"\n{BOLD}{CYAN}DELETE REASON TEST SUITE{RESET}")

    admin = login("admin", "admin")
    sa    = login("rengasamy", "renga@123")
    clerk = login("clerk1", "clerk@123")

    if not all([admin, sa, clerk]):
        print(f"{RED}Login failed. Check users exist.{RESET}")
        return

    # ============================================
    section("1. ADMIN — delete with no reason (should work)")
    bid = make_bill(admin, "ADM-NOREASON-1")
    if not bid:
        print(f"{RED}Could not create test bill{RESET}"); return
    r = requests.delete(f"{BASE}/bills/{bid}",
                        headers={"Authorization": f"Bearer {admin}"}, json={})
    print(f"  Status: {r.status_code}")
    check(r.status_code == 200, f"Admin delete → 200 (got {r.status_code})")
    check(r.json().get("success") is True, "success=true")

    # ============================================
    section("2. ADMIN — even if reason sent, ignored")
    bid = make_bill(admin, "ADM-IGNORE-1")
    r = requests.delete(f"{BASE}/bills/{bid}",
                        headers={"Authorization": f"Bearer {admin}"},
                        json={"reason": "Should be ignored for admin"})
    check(r.status_code == 200, "Admin delete ignores reason → 200")

    # Verify reason is NOT stored for admin deletes
    deleted = requests.get(f"{BASE}/bills/deleted",
                           headers={"Authorization": f"Bearer {admin}"}).json()["data"]
    bill = next((b for b in deleted if b["id"] == bid), None)
    if bill:
        check(bill.get("deletion_reason") is None, "Admin delete → reason NULL in DB")

    # ============================================
    section("3. S.A. — delete WITHOUT reason (should fail)")
    bid = make_bill(admin, "SA-NOREASON-1")
    r = requests.delete(f"{BASE}/bills/{bid}",
                        headers={"Authorization": f"Bearer {sa}"}, json={})
    print(f"  Status: {r.status_code}, {r.json()}")
    check(r.status_code == 400, "S.A. no reason → 400")

    # ============================================
    section("4. S.A. — 2-char reason (should fail)")
    r = requests.delete(f"{BASE}/bills/{bid}",
                        headers={"Authorization": f"Bearer {sa}"},
                        json={"reason": "ab"})
    check(r.status_code == 400, "S.A. 2-char → 400")

    # ============================================
    section("5. S.A. — valid reason (should work)")
    r = requests.delete(f"{BASE}/bills/{bid}",
                        headers={"Authorization": f"Bearer {sa}"},
                        json={"reason": "Duplicate entry"})
    print(f"  Status: {r.status_code}, {r.json()}")
    check(r.status_code == 200, "S.A. valid reason → 200")

    # Verify reason stored
    deleted = requests.get(f"{BASE}/bills/deleted",
                           headers={"Authorization": f"Bearer {admin}"}).json()["data"]
    bill = next((b for b in deleted if b["id"] == bid), None)
    if bill:
        check(bill.get("deletion_reason") == "Duplicate entry",
              f"Reason stored = '{bill.get('deletion_reason')}'")
        check(bill.get("deleted_by") == "rengasamy", "deleted_by = rengasamy")
        check(bill.get("deleted_by_role") == "super_admin", "deleted_by_role = super_admin")

    # ============================================
    section("6. CLERK — delete WITHOUT reason")
    bid = make_bill(clerk, "CLK-NOREASON-1", "Pension, NPS, PF")
    if not bid:
        print(f"{RED}Could not create clerk bill{RESET}")
    else:
        r = requests.delete(f"{BASE}/bills/{bid}",
                            headers={"Authorization": f"Bearer {clerk}"}, json={})
        check(r.status_code == 400, "Clerk no reason → 400")

        # ============================================
        section("7. CLERK — valid reason")
        r = requests.delete(f"{BASE}/bills/{bid}",
                            headers={"Authorization": f"Bearer {clerk}"},
                            json={"reason": "Wrong vendor data"})
        check(r.status_code == 200, "Clerk valid reason → 200")

    # ============================================
    section("8. RESTORE — clears reason")
    deleted = requests.get(f"{BASE}/bills/deleted",
                           headers={"Authorization": f"Bearer {admin}"}).json()["data"]
    sa_bill = next((b for b in deleted if b["bill_number"] == "SA-NOREASON-1"), None)
    if sa_bill:
        r = requests.put(f"{BASE}/bills/{sa_bill['id']}/restore",
                         headers={"Authorization": f"Bearer {admin}"}, json={})
        check(r.status_code == 200, "Restore → 200")

        bill = requests.get(f"{BASE}/bills/{sa_bill['id']}",
                            headers={"Authorization": f"Bearer {admin}"}).json()["data"]
        check(bill.get("deletion_reason") is None, "Reason cleared after restore")
        check(bill.get("is_deleted") == 0, "is_deleted = 0")

    # ============================================
    print(f"\n{BOLD}{CYAN}{'=' * 60}{RESET}")
    print(f"  Total:  {PASSED + FAILED}")
    print(f"  {GREEN}Passed: {PASSED}{RESET}")
    print(f"  {RED}Failed: {FAILED}{RESET}")
    if FAILED == 0:
        print(f"\n  {GREEN}{BOLD}🎉 ALL TESTS PASSED{RESET}\n")

if __name__ == "__main__":
    main()