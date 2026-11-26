import re
from difflib import SequenceMatcher
from typing import Optional, Tuple

EMAIL_REGEX = re.compile(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$")
UCC_INDEX_REGEX = re.compile(r"^PS/CSC/\d{2}/\d{4}$")
BAD_TLD_TYPOS = {"cim", "con", "yh"}


def is_valid_ucc_index_format(normalized_index: Optional[str]) -> bool:
    """Returns True only if normalized_index strictly matches PS/CSC/YY/NNNN."""
    return bool(normalized_index and UCC_INDEX_REGEX.match(normalized_index))


def _name_tokens(raw: Optional[str]) -> list:
    if not raw:
        return []
    cleaned = re.sub(r"[^\w\s]", " ", str(raw).lower())
    cleaned = cleaned.replace("_", " ")
    return [tok for tok in cleaned.split() if tok]


def names_match_tolerantly(typed_name: Optional[str], roster_name: Optional[str]) -> bool:
    """
    Order-insensitive, punctuation-insensitive, typo-tolerant name matcher.
    Roster names are SURNAME FIRST MIDDLE; students often type FIRST LAST.
    Requires >= 80% token match (fuzzy ratio >= 0.80 per token).
    """
    typed = _name_tokens(typed_name)
    roster = _name_tokens(roster_name)
    if not typed or not roster:
        return False
    if len(roster) >= 2 and len(typed) < 2:
        return False

    used = set()
    matched = 0
    for t in typed:
        best_idx = -1
        best_ratio = 0.0
        for idx, r in enumerate(roster):
            if idx in used:
                continue
            ratio = 1.0 if t == r else SequenceMatcher(None, t, r).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_idx = idx
        if best_idx != -1 and best_ratio >= 0.80:
            used.add(best_idx)
            matched += 1

    return (matched / len(typed)) >= 0.80 and matched >= min(2, len(roster))


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

