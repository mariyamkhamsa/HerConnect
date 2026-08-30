"""
Cross-Encoder re-ranking.

Uses a pre-trained Cross-Encoder (default: cross-encoder/ms-marco-MiniLM-L-6-v2)
that takes a (query, candidate) text pair as *joint* input and produces a single
relevance score. This is more accurate than comparing independent embeddings,
but too slow to run against every profile - so it is only applied to the small
shortlist produced by SBERT retrieval.
"""
import threading
from typing import List, Tuple

import numpy as np
from sentence_transformers import CrossEncoder

from app.config import settings

_cross_encoder = None
_lock = threading.Lock()


def get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        with _lock:
            if _cross_encoder is None:
                _cross_encoder = CrossEncoder(settings.CROSS_ENCODER_MODEL_NAME)
    return _cross_encoder


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def rerank(query_text: str, candidate_texts: List[str]) -> List[float]:
    """
    Score each (query_text, candidate_text) pair with the Cross-Encoder.
    Returns a list of scores normalized to [0, 1] (raw ms-marco logits are
    passed through a sigmoid so they behave like a relevance probability).
    """
    if not candidate_texts:
        return []
    model = get_cross_encoder()
    pairs: List[Tuple[str, str]] = [(query_text, c) for c in candidate_texts]
    raw_scores = model.predict(pairs)
    normalized = _sigmoid(np.array(raw_scores, dtype=np.float32))
    return normalized.tolist()
