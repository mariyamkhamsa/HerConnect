"""
The end-to-end Hybrid AI-Based Recommendation pipeline described in the PRD
(Section 14/18):

  Step 0  (normal code)  - structured eligibility filtering
                            (locality, availability overlap, work type, min. experience)
  Step 1  (AI - SBERT)   - semantic retrieval: cosine similarity between the query
                            embedding and the eligible pool's precomputed embeddings,
                            producing a top-N shortlist
  Step 2  (AI - Cross-Encoder) - re-ranks the shortlist with joint-pair scoring
  Step 3  (normal code)  - combines the semantic relevance score with structured
                            factor strength into one final score + "Why this match?"

This module is deliberately the ONLY place that talks to both the ORM objects
and the AI models, so the AI logic stays cleanly separated from the API layer.
"""
from dataclasses import dataclass
from typing import List, Optional, Sequence

from app.ai.embeddings import (
    build_worker_text, build_job_text, compute_embedding,
    deserialize_embedding, cosine_similarity,
)
from app.ai.reranker import rerank

SHORTLIST_SIZE = 15          # top-N candidates SBERT hands to the Cross-Encoder
SEMANTIC_WEIGHT = 0.6        # final score = SEMANTIC_WEIGHT * semantic + (1-SEMANTIC_WEIGHT) * structured

# A tiny predefined "nearby localities" map used only to demonstrate the
# location-matching rule described in the PRD (no GPS/geocoding involved).
# Keys/values are lower-cased locality names.
NEARBY_LOCALITIES = {
    "kochi": {"ernakulam", "kakkanad", "tripunithura"},
    "ernakulam": {"kochi", "kakkanad", "tripunithura"},
    "kakkanad": {"kochi", "ernakulam"},
    "tripunithura": {"kochi", "ernakulam"},
    "koramangala": {"btm layout", "hsr layout", "indiranagar"},
    "btm layout": {"koramangala", "hsr layout"},
    "hsr layout": {"koramangala", "btm layout", "indiranagar"},
    "indiranagar": {"koramangala", "hsr layout"},
}


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _tags(s: str) -> set:
    return {t.strip().lower() for t in (s or "").split(",") if t.strip()}


def locality_relation(a: str, b: str) -> str:
    """Returns 'same', 'nearby', or 'different'."""
    a, b = _norm(a), _norm(b)
    if a == b:
        return "same"
    if b in NEARBY_LOCALITIES.get(a, set()):
        return "nearby"
    return "different"


def availability_overlap(a: str, b: str) -> str:
    """Returns 'full', 'partial', or 'none' based on comma-separated availability tags."""
    tags_a, tags_b = _tags(a), _tags(b)
    if not tags_a or not tags_b:
        return "none"
    if "flexible" in tags_a or "flexible" in tags_b:
        return "full"
    if tags_a == tags_b:
        return "full"
    if tags_a & tags_b:
        return "partial"
    return "none"


def work_type_match(a: str, b: str) -> bool:
    return _norm(a) == _norm(b)


@dataclass
class StructuredFactors:
    locality_relation: str      # same / nearby / different
    availability_overlap: str   # full / partial / none
    work_type_ok: bool
    experience_ok: bool         # candidate experience >= required experience
    structured_strength: float  # 0..1, used in final score blending


def evaluate_structured_factors(
    candidate_locality: str, target_locality: str,
    candidate_availability: str, target_availability: str,
    candidate_work_type: str, target_work_type: str,
    candidate_experience: float, required_experience: float,
) -> StructuredFactors:
    loc_rel = locality_relation(candidate_locality, target_locality)
    avail = availability_overlap(candidate_availability, target_availability)
    work_ok = work_type_match(candidate_work_type, target_work_type)
    exp_ok = candidate_experience >= required_experience

    loc_score = {"same": 1.0, "nearby": 0.6, "different": 0.0}[loc_rel]
    avail_score = {"full": 1.0, "partial": 0.5, "none": 0.0}[avail]
    work_score = 1.0 if work_ok else 0.0
    exp_score = 1.0 if exp_ok else 0.5  # "below requirement" still contributes partially

    structured_strength = (loc_score + avail_score + work_score + exp_score) / 4.0

    return StructuredFactors(
        locality_relation=loc_rel,
        availability_overlap=avail,
        work_type_ok=work_ok,
        experience_ok=exp_ok,
        structured_strength=structured_strength,
    )


def is_structurally_eligible(factors: StructuredFactors) -> bool:
    """
    Step 0 hard filter, per PRD Section 14:
    locality must be same/nearby (not different), availability must overlap
    at least partially, work type must match, and experience must meet the
    requirement. This keeps the pool the AI has to evaluate small.
    """
    return (
        factors.locality_relation != "different"
        and factors.availability_overlap != "none"
        and factors.work_type_ok
        and factors.experience_ok
    )


def semantic_bucket(score: float) -> str:
    if score >= 0.65:
        return "Strong"
    if score >= 0.4:
        return "Moderate"
    return "Weak"


def build_explanation(factors: StructuredFactors, semantic_score: float) -> dict:
    location_label = {"same": "Same locality", "nearby": "Nearby", "different": "Different"}[factors.locality_relation]
    availability_label = {
        "full": "Fully overlapping", "partial": "Partially overlapping", "none": "No overlap",
    }[factors.availability_overlap]
    experience_label = "Meets requirement" if factors.experience_ok else "Below requirement"
    return {
        "semantic_skill_match": semantic_bucket(semantic_score),
        "location": location_label,
        "availability": availability_label,
        "experience": experience_label,
    }


def combine_final_score(semantic_score: float, structured_strength: float) -> float:
    return round(SEMANTIC_WEIGHT * semantic_score + (1 - SEMANTIC_WEIGHT) * structured_strength, 4)


@dataclass
class RankedCandidate:
    entity_id: int
    final_score: float
    semantic_score: float
    explanation: dict


def run_recommendation_pipeline(
    query_text: str,
    query_embedding_text_builder_result: Optional[List[float]],
    pool: Sequence[dict],
) -> List[RankedCandidate]:
    """
    Generic pipeline runner shared by both "recommend workers for a job" and
    "recommend jobs for a worker".

    `pool` is a list of dicts, each with:
      - id: int
      - embedding: str (JSON) or None
      - structured: StructuredFactors (already evaluated + already passed the
        eligibility filter by the caller)

    Returns candidates ranked by final_score, descending.
    """
    if not pool:
        return []

    # Live query embedding (only the query side is computed on the fly).
    query_vec = compute_embedding(query_text) if query_embedding_text_builder_result is None \
        else query_embedding_text_builder_result
    import numpy as np
    query_vec = np.array(query_vec, dtype=np.float32)

    # ---- Step 1: SBERT semantic retrieval -> shortlist ----
    scored_for_retrieval = []
    for item in pool:
        if not item.get("embedding"):
            continue
        cand_vec = deserialize_embedding(item["embedding"])
        sim = cosine_similarity(query_vec, cand_vec)
        scored_for_retrieval.append((item, sim))

    scored_for_retrieval.sort(key=lambda x: x[1], reverse=True)
    shortlist = scored_for_retrieval[:SHORTLIST_SIZE]

    if not shortlist:
        return []

    # ---- Step 2: Cross-Encoder re-ranking on the shortlist only ----
    candidate_texts = [item["text"] for item, _sim in shortlist]
    ce_scores = rerank(query_text, candidate_texts)

    # ---- Step 3: combine with structured strength ----
    results: List[RankedCandidate] = []
    for (item, _sim), ce_score in zip(shortlist, ce_scores):
        factors: StructuredFactors = item["structured"]
        final = combine_final_score(ce_score, factors.structured_strength)
        explanation = build_explanation(factors, ce_score)
        results.append(RankedCandidate(
            entity_id=item["id"],
            final_score=final,
            semantic_score=round(float(ce_score), 4),
            explanation=explanation,
        ))

    results.sort(key=lambda r: r.final_score, reverse=True)
    return results
