"""Unit tests: structured eligibility, scoring/explanation, SBERT utilities, baseline."""
import numpy as np

from app.ai import pipeline as p
from app.ai.embeddings import (
    build_worker_text, build_job_text, compute_embedding,
    serialize_embedding, deserialize_embedding, cosine_similarity,
)
from app.ai.baseline import tokenize, keyword_overlap


def test_locality_relations():
    assert p.locality_relation("Kochi", " kochi ") == "same"
    assert p.locality_relation("Kochi", "Kakkanad") == "nearby"
    assert p.locality_relation("Kochi", "Bangalore") == "different"


def test_availability_overlap():
    assert p.availability_overlap("weekdays,evenings", "weekdays,evenings") == "full"
    assert p.availability_overlap("weekdays", "weekdays,evenings") == "partial"
    assert p.availability_overlap("weekdays", "weekends") == "none"
    assert p.availability_overlap("flexible", "weekends") == "full"
    assert p.availability_overlap("", "weekends") == "none"


def _factors(**over):
    args = dict(
        candidate_locality="Kochi", target_locality="Kochi",
        candidate_availability="weekdays", target_availability="weekdays",
        candidate_work_type="part-time", target_work_type="part-time",
        candidate_experience=3, required_experience=2,
    )
    args.update(over)
    return p.evaluate_structured_factors(**args)


def test_eligibility_filter_rules():
    assert p.is_structurally_eligible(_factors())
    assert not p.is_structurally_eligible(_factors(candidate_locality="Bangalore"))
    assert not p.is_structurally_eligible(_factors(candidate_availability="weekends"))
    assert not p.is_structurally_eligible(_factors(candidate_work_type="seasonal"))
    assert not p.is_structurally_eligible(_factors(candidate_experience=1))


def test_structured_strength_and_final_score_blend():
    perfect = _factors()
    assert perfect.structured_strength == 1.0
    assert p.combine_final_score(1.0, 1.0) == 1.0
    assert p.combine_final_score(0.0, 0.0) == 0.0
    assert p.combine_final_score(1.0, 0.0) == round(p.SEMANTIC_WEIGHT, 4)


def test_explanation_labels():
    ex = p.build_explanation(_factors(candidate_experience=1), 0.7)
    assert ex == {
        "semantic_skill_match": "Strong",
        "location": "Same locality",
        "availability": "Fully overlapping",
        "experience": "Below requirement",
    }
    assert p.semantic_bucket(0.5) == "Moderate"
    assert p.semantic_bucket(0.1) == "Weak"


def test_embedding_roundtrip_and_cosine():
    v = compute_embedding("tailoring and embroidery")
    arr = deserialize_embedding(serialize_embedding(v))
    assert arr.shape == (len(v),)
    assert abs(cosine_similarity(arr, arr) - 1.0) < 1e-5
    assert cosine_similarity(np.zeros(3), np.ones(3)) == 0.0


def test_text_builders_include_all_fields():
    assert "embroidery" in build_worker_text("embroidery", "about me")
    t = build_job_text("Title X", "Desc Y", "skill Z")
    assert all(s in t for s in ("Title X", "Desc Y", "skill Z"))


def test_pipeline_ranks_matching_candidate_above_unrelated():
    """Pipeline sanity (fake models): an obviously matching profile outranks an unrelated one."""
    query = build_job_text("Bridal embroidery", "hand embroidery zardozi bridal blouses", "embroidery,zardozi")
    good_text = build_worker_text("embroidery,zardozi", "hand embroidery and zardozi on bridal blouses")
    bad_text = build_worker_text("cooking,catering", "south indian meals for large weekend events")
    f = _factors()
    pool = [
        {"id": 1, "embedding": serialize_embedding(compute_embedding(bad_text)), "text": bad_text, "structured": f},
        {"id": 2, "embedding": serialize_embedding(compute_embedding(good_text)), "text": good_text, "structured": f},
    ]
    ranked = p.run_recommendation_pipeline(query, compute_embedding(query), pool)
    assert [r.entity_id for r in ranked][0] == 2
    assert ranked[0].final_score > ranked[1].final_score


def test_pipeline_shortlist_cap_and_empty_pool():
    assert p.run_recommendation_pipeline("q", None, []) == []
    f = _factors()
    pool = []
    for i in range(p.SHORTLIST_SIZE + 10):
        txt = f"candidate number {i} embroidery"
        pool.append({"id": i, "embedding": serialize_embedding(compute_embedding(txt)), "text": txt, "structured": f})
    ranked = p.run_recommendation_pipeline("embroidery", compute_embedding("embroidery"), pool)
    assert len(ranked) == p.SHORTLIST_SIZE


def test_keyword_baseline_misses_synonyms():
    q = tokenize("embroidery, zardozi")
    score, matched = keyword_overlap(q, "I stitch beautiful gold thread work on wedding outfits")
    assert score == 0.0 and matched == []
    score, matched = keyword_overlap(q, "hand embroidery expert")
    assert matched == ["embroidery"] and score == 0.5
