"""Tiny deterministic text matching shared by helper routing, the leave simulator and ghost-credit detection.

No AI: lowercase word tokens, light stemming, stopword removal, and IDF weights so that rare,
specific words ("idempotency", "kafka") count more than common ones ("test", "service").
"""
from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Iterable

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "has", "had", "you", "your", "are",
    "was", "were", "but", "not", "can", "cant", "could", "would", "should", "how", "what", "why",
    "when", "where", "who", "does", "doing", "did", "into", "out", "our", "its", "it's", "all", "any",
    "get", "got", "getting", "keep", "keeps", "kept", "just", "like", "need", "needs", "help", "stuck",
    "anyone", "someone", "know", "idea", "ideas", "please", "thanks", "about", "after", "before",
    "there", "their", "then", "than", "them", "they", "will", "also", "some", "one", "two", "use",
    "using", "used", "way", "make", "made", "still", "very", "really", "here", "being", "been", "too",
    "i'm", "im", "me", "my", "we", "us", "is", "am", "be", "to", "of", "in", "on", "at", "it", "a",
    "an", "or", "if", "so", "do", "up", "no", "yes", "first", "new", "again", "every", "each",
    "maybe", "probably", "think", "seems", "issue", "problem", "thing", "things", "work", "working",
}

_WORD_RE = re.compile(r"[a-z0-9_]+")


def stem(tok: str) -> str:
    if len(tok) > 4 and tok.endswith("ies"):
        return tok[:-3] + "y"  # retries -> retry
    for suf in ("ing", "ed", "es", "s"):
        if len(tok) > len(suf) + 3 and tok.endswith(suf):
            return tok[: -len(suf)]
    return tok


def surface_tokens(text: str) -> dict[str, str]:
    """stem -> first surface form seen (so we can display 'caches' instead of the stem 'cach')."""
    out: dict[str, str] = {}
    for raw in _WORD_RE.findall((text or "").lower()):
        if len(raw) < 3 or raw in STOPWORDS or raw.isdigit():
            continue
        out.setdefault(stem(raw), raw)
    return out


def tokenize(text: str) -> set[str]:
    return set(surface_tokens(text))


def words(text: str) -> set[str]:
    """Raw lowercase words (no stemming/stopwords) — used for name mentions."""
    return set(_WORD_RE.findall((text or "").lower()))


class Idf:
    """Inverse document frequency over a corpus of texts."""

    def __init__(self, texts: Iterable[str]) -> None:
        self.df: Counter[str] = Counter()
        self.n = 0
        for t in texts:
            self.df.update(tokenize(t))
            self.n += 1
        self.n = max(1, self.n)

    def __call__(self, tok: str) -> float:
        return math.log((1 + self.n) / (1 + self.df[tok])) + 1.0

    def weight(self, toks: Iterable[str]) -> float:
        return sum(self(t) for t in toks)
