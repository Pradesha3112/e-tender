# ============================================================
# FILE: categories.py
# PURPOSE: Central category definitions and role-based helpers
# ============================================================

# ------------------------------------------------------------
# MASTER CATEGORY LIST (12 categories from the work allocation)
# ------------------------------------------------------------
CATEGORIES = {
    # ADFM/I — Shri. P. Rengasamy
    "adfm_1": [
        "Establishment Bills",
        "Suspense: Establishment & Expenditure",
        "Expenditure (X-II bills)",
        "Audit objections/Railway Board Inspection Reports (Personnel)",
        "Stores Finance: PO vetting, Agreement vetting, Establishment Finance",
        "Pension, NPS, PF",
    ],
    # ADFM/II — Shri. S. Gopinath
    "adfm_2": [
        "Administration",
        "RTI, GST, Computer",
        "Expenditure (X-I bills)",
        "R&E: Audit objections/Railway Board Inspection Reports (Non-Personnel & Overall co-ordination)",
        "Bills Recoverable, Inspection General & Efficiency",
        "Books & Budget, CAR",
    ],
}

# ------------------------------------------------------------
# GROUP LABELS (for UI display)
# ------------------------------------------------------------
GROUP_LABELS = {
    "adfm_1": "ADFM/I — Shri. P. Rengasamy",
    "adfm_2": "ADFM/II — Shri. S. Gopinath",
    "all":    "All Categories (Admin)",
}

# ------------------------------------------------------------
# REVERSE MAP: category name → group
# ------------------------------------------------------------
CATEGORY_TO_GROUP = {}
for group, cats in CATEGORIES.items():
    for cat in cats:
        CATEGORY_TO_GROUP[cat] = group


# ------------------------------------------------------------
# HELPER FUNCTIONS
# ------------------------------------------------------------
def get_categories_for_group(group: str) -> list:
    """Return list of categories for a given group. 'all' returns every category."""
    if group == "all":
        return CATEGORIES["adfm_1"] + CATEGORIES["adfm_2"]
    return CATEGORIES.get(group, [])


def get_group_for_category(category: str) -> str | None:
    """Given a category name, return its group. None if unknown."""
    return CATEGORY_TO_GROUP.get(category)


def is_category_valid_for_group(category: str, group: str) -> bool:
    """Check if a category is allowed for a given group."""
    if group == "all":
        return category in get_categories_for_group("all")
    return category in CATEGORIES.get(group, [])


def get_all_categories() -> list:
    """Flat list of every category."""
    return CATEGORIES["adfm_1"] + CATEGORIES["adfm_2"]


def build_category_payload(user_group: str, user_role: str) -> dict:
    """
    Build the payload sent to the frontend for the category dropdown.
    Admin sees ALL. super_admin / clerk see only their group.
    """
    if user_role == "admin" or user_group == "all":
        return {
            "group": "all",
            "label": GROUP_LABELS["all"],
            "categories": get_all_categories(),
            "allow_all": True,
        }
    return {
        "group": user_group,
        "label": GROUP_LABELS.get(user_group, user_group),
        "categories": get_categories_for_group(user_group),
        "allow_all": False,
    }