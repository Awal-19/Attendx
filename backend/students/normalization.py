import re
from typing import Optional, Tuple

EMAIL_REGEX = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
BAD_TLD_TYPOS = {"cim", "con", "yh"}


def normalize_index_number(raw: Optional[str]) -> str:
    """
    Canonical index format:
    - Trims whitespace and uppercases
    - Zero-pads a numeric final slash-separated segment to 4 digits
      e.g. 'ps/csc/24/159 ' -> 'PS/CSC/24/0159'
    """
    if not raw:
        return ""
    cleaned = re.sub(r"\s+", "", str(raw)).upper()
    if "/" not in cleaned:
        return cleaned
    parts = cleaned.split("/")
    last = parts[-1]
    if last.isdigit() and len(last) < 4:
        parts[-1] = last.zfill(4)
    return "/".join(parts)


def clean_name(raw: Optional[str]) -> str:
    """Trims and collapses repeated whitespace while preserving original casing."""
    if not raw:
        return ""
    return re.sub(r"\s+", " ", str(raw).strip())


def normalize_ghana_phone(raw: Optional[str]) -> Tuple[str, str, bool]:
    """
    Normalizes Ghana phone numbers to local 10-digit format (0XXXXXXXXX).
    Returns (normalized_phone, raw_value, is_flagged).
    Never guesses missing digits; flags non-Ghana or malformed numbers.
    """
    raw_str = str(raw or "").strip()
    if not raw_str:
        return "", "", True

    compact = re.sub(r"[\s\-()]+", "", raw_str)
    if compact.startswith("+233"):
        rest = compact[4:]
        if rest.isdigit() and len(rest) == 9:
            return f"0{rest}", "", False
        return "", raw_str, True
    if compact.startswith("233") and len(compact) == 12 and compact.isdigit():
        return f"0{compact[3:]}", "", False
    if compact.startswith("0") and len(compact) == 10 and compact.isdigit():
        return compact, "", False
    return "", raw_str, True


def validate_and_clean_email(raw: Optional[str]) -> Tuple[Optional[str], bool, str]:
    """
    Lowercases and trims email without silently fixing invalid addresses.
    Returns (cleaned_email_or_None, is_flagged, reason).
    """
    val = str(raw or "").strip().lower()
    if not val:
        return None, True, "Empty email"
    if any(ch in val for ch in (" ", ",", "/", ";")):
        return None, True, f"Invalid characters in email: {val}"
    if "@" not in val:
        return None, True, f"Missing '@' in email: {val}"
    if not EMAIL_REGEX.match(val):
        return None, True, f"Malformed email format: {val}"
    tld = val.rsplit(".", 1)[-1]
    if tld in BAD_TLD_TYPOS:
        return None, True, f"Suspected TLD typo '.{tld}' in email: {val}"
    return val, False, ""

