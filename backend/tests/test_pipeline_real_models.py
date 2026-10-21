"""
PRD Section 22 pipeline sanity test with the REAL pre-trained SBERT + Cross-Encoder.

Skipped automatically when the models can't be loaded (no internet on first run /
sentence-transformers not installed). Run it on your machine once the models are
downloaded:   pytest tests/test_pipeline_real_models.py -v -s
"""
import pytest

pytestmark = pytest.mark.real_models


@pytest.fixture(scope="module")
def real_models():
    try:
        from app.ai.embeddings import get_sbert_model
        from app.ai.reranker import get_cross_encoder
        get_sbert_model()
        get_cross_encoder()
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"real models unavailable: {exc}")


def _factors():
    from app.ai.pipeline import evaluate_structured_factors
    return evaluate_structured_factors("Kochi", "Kochi", "weekdays", "weekdays", "part-time", "part-time", 5, 1)


def _entry(i, text):
    from app.ai.embeddings import compute_embedding, serialize_embedding
    return {"id": i, "embedding": serialize_embedding(compute_embedding(text)), "text": text, "structured": _factors()}


def test_semantic_match_beats_unrelated_even_without_shared_keywords(real_models):
    from app.ai.embeddings import build_job_text, build_worker_text, compute_embedding
    from app.ai.pipeline import run_recommendation_pipeline

    job = build_job_text(
        "Bridal blouse embroidery", "Hand embroidery and zardozi on bridal blouses and lehengas", "embroidery,zardozi")
    paraphrase = build_worker_text(      # no literal keyword overlap with the job
        "needlework, gold thread", "I stitch ornate gold-thread designs on wedding outfits by hand")
    unrelated = build_worker_text(
        "cooking, catering", "I prepare large south indian vegetarian meals for weekend events")

    ranked = run_recommendation_pipeline(job, compute_embedding(job), [_entry(1, unrelated), _entry(2, paraphrase)])
    assert [r.entity_id for r in ranked] == [2, 1]
    assert ranked[0].semantic_score > ranked[1].semantic_score
