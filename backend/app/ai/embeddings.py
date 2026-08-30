"""
SBERT (Sentence-BERT) embedding generation.

Uses a pre-trained bi-encoder (default: all-MiniLM-L6-v2) to convert text into
fixed-length vector embeddings. The model is loaded once (lazily, on first use)
and reused for the lifetime of the process, since embeddings for existing
profiles/jobs are precomputed and stored, and only the "query" side needs a
live embedding call at recommendation time.

No models are trained or fine-tuned here - this wraps a pre-trained model only.
"""
import json
import threading
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings

_model = None
_model_lock = threading.Lock()


def get_sbert_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer(settings.SBERT_MODEL_NAME)
    return _model


def build_worker_text(structured_skills: str, about_description: str) -> str:
    """Combine structured skills + free-text description into one passage for embedding."""
    return f"Skills: {structured_skills}. About: {about_description}"


def build_job_text(title: str, description: str, required_skills_text: str) -> str:
    """Combine job title, description and required skills for embedding."""
    return f"Job title: {title}. Required skills: {required_skills_text}. Description: {description}"


def compute_embedding(text: str) -> List[float]:
    """Compute a single SBERT embedding and return it as a plain Python list."""
    model = get_sbert_model()
    vector = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return vector.tolist()


def serialize_embedding(vector: List[float]) -> str:
    return json.dumps(vector)


def deserialize_embedding(raw: str) -> np.ndarray:
    return np.array(json.loads(raw), dtype=np.float32)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Vectors are already normalized at encode time, so dot product == cosine similarity."""
    denom = (np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)
