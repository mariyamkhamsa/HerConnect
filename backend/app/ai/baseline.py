"""
Plain keyword-overlap baseline (NO AI, no structured filtering).

PRD Section 24 asks the demo to show "visibly different/better results than
plain keyword search on the same sample data". This module is that naive
comparison point: it simply counts how many of the query's keywords literally
appear in a candidate's text. It is never used by the real recommendation
pipeline - only by the /recommendations/baseline/* endpoints.
"""
import re
from typing import Iterable, List, Set, Tuple

_STOPWORDS = {
    "a", "an", "and", "or", "the", "of", "for", "to", "in", "on", "with", "at", "by",
    "is", "are", "be", "as", "from", "we", "i", "my", "our", "you", "your", "need",
    "needed", "looking", "work", "help",
}


def tokenize(text: str) -> Set[str]:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def keyword_overlap(query_keywords: Iterable[str], candidate_text: str) -> Tuple[float, List[str]]:
    """Return (fraction of query keywords found literally in candidate text, matched keywords)."""
    q = set(query_keywords)
    if not q:
        return 0.0, []
    cand = tokenize(candidate_text)
    matched = sorted(q & cand)
    return round(len(matched) / len(q), 4), matched
