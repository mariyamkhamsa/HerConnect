"""
FR9/FR10/FR12: AI-recommended workers for a job, and AI-recommended jobs for a
worker, each with a "Why this match?" breakdown. This is where the structured
eligibility filter (normal code) and the two-stage AI pipeline (SBERT +
Cross-Encoder) are wired together against real database records - nothing here
is hardcoded or faked.

Additions on top of the original wiring (pipeline.py itself is unchanged):
  * deactivated users are excluded from every pool
  * profiles/jobs with a missing embedding get one computed on the fly instead
    of being silently dropped
  * /applicants/{job_id}: "Why this match?" for workers who APPLIED (FR8)
  * /baseline/*: plain keyword-overlap results for the naive-vs-AI comparison (Sec. 24)
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.ai.embeddings import (
    build_job_text, build_worker_text, compute_embedding, serialize_embedding,
)
from app.ai.pipeline import (
    SHORTLIST_SIZE, build_explanation, combine_final_score,
    evaluate_structured_factors, is_structurally_eligible, run_recommendation_pipeline,
)
from app.ai.reranker import rerank
from app.ai.baseline import tokenize, keyword_overlap

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


# ---------------------------------------------------------------- helpers

def _owned_job_or_error(db: Session, job_id: int, user: models.User) -> models.Job:
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == user.id
    ).first()
    if not entrepreneur or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=403, detail="Not your job posting")
    return job


def _own_worker_or_error(db: Session, worker_id: int, user: models.User) -> models.WorkerProfile:
    worker = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    if worker.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your profile")
    return worker


def _ensure_worker_embedding(worker: models.WorkerProfile) -> bool:
    """Compute+store a missing embedding. Returns True if the row was changed."""
    if worker.embedding:
        return False
    worker.embedding = serialize_embedding(
        compute_embedding(build_worker_text(worker.structured_skills, worker.about_description))
    )
    return True


def _ensure_job_embedding(job: models.Job) -> bool:
    if job.embedding:
        return False
    job.embedding = serialize_embedding(
        compute_embedding(build_job_text(job.title, job.description, job.required_skills_text))
    )
    return True


def _active_workers(db: Session) -> List[models.WorkerProfile]:
    return (
        db.query(models.WorkerProfile)
        .join(models.User, models.WorkerProfile.user_id == models.User.id)
        .filter(models.User.is_active.is_(True))
        .all()
    )


def _open_active_jobs(db: Session) -> List[models.Job]:
    return (
        db.query(models.Job)
        .join(models.EntrepreneurProfile, models.Job.entrepreneur_id == models.EntrepreneurProfile.id)
        .join(models.User, models.EntrepreneurProfile.user_id == models.User.id)
        .filter(models.Job.status == "open", models.User.is_active.is_(True))
        .all()
    )


def _job_vs_worker_factors(job: models.Job, worker: models.WorkerProfile):
    return evaluate_structured_factors(
        candidate_locality=worker.locality, target_locality=job.locality,
        candidate_availability=worker.availability, target_availability=job.availability,
        candidate_work_type=worker.work_type, target_work_type=job.work_type,
        candidate_experience=worker.experience_years, required_experience=job.experience_required,
    )


# ---------------------------------------------------- AI: workers for a job

@router.get("/candidates/{job_id}", response_model=List[schemas.WorkerRecommendation])
def recommend_candidates_for_job(
    job_id: int,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    job = _owned_job_or_error(db, job_id, current_user)
    all_workers = _active_workers(db)

    # Step 0: normal-code structured eligibility filtering
    pool = []
    worker_lookup = {}
    changed = False
    for worker in all_workers:
        factors = _job_vs_worker_factors(job, worker)
        if not is_structurally_eligible(factors):
            continue
        changed |= _ensure_worker_embedding(worker)
        pool.append({
            "id": worker.id,
            "embedding": worker.embedding,
            "text": build_worker_text(worker.structured_skills, worker.about_description),
            "structured": factors,
        })
        worker_lookup[worker.id] = worker
    if changed:
        db.commit()

    query_text = build_job_text(job.title, job.description, job.required_skills_text)
    query_embedding = compute_embedding(query_text)

    ranked = run_recommendation_pipeline(query_text, query_embedding, pool)

    results = []
    for r in ranked:
        w = worker_lookup[r.entity_id]
        results.append(schemas.WorkerRecommendation(
            worker_id=w.id,
            full_name=w.full_name,
            structured_skills=w.structured_skills,
            about_description=w.about_description,
            experience_years=w.experience_years,
            locality=w.locality,
            availability=w.availability,
            work_type=w.work_type,
            portfolio_file_path=w.portfolio_file_path,
            final_score=r.final_score,
            semantic_score=r.semantic_score,
            explanation=schemas.MatchExplanation(**r.explanation),
        ))
    return results


# ---------------------------------------------------- AI: jobs for a worker

@router.get("/jobs/{worker_id}", response_model=List[schemas.JobRecommendation])
def recommend_jobs_for_worker(
    worker_id: int,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    worker = _own_worker_or_error(db, worker_id, current_user)
    open_jobs = _open_active_jobs(db)

    pool = []
    job_lookup = {}
    changed = False
    for job in open_jobs:
        factors = _job_vs_worker_factors(job, worker)
        if not is_structurally_eligible(factors):
            continue
        changed |= _ensure_job_embedding(job)
        pool.append({
            "id": job.id,
            "embedding": job.embedding,
            "text": build_job_text(job.title, job.description, job.required_skills_text),
            "structured": factors,
        })
        job_lookup[job.id] = job
    if changed:
        db.commit()

    query_text = build_worker_text(worker.structured_skills, worker.about_description)
    query_embedding = compute_embedding(query_text)

    ranked = run_recommendation_pipeline(query_text, query_embedding, pool)

    results = []
    for r in ranked:
        j = job_lookup[r.entity_id]
        results.append(schemas.JobRecommendation(
            job_id=j.id,
            entrepreneur_id=j.entrepreneur_id,
            title=j.title,
            description=j.description,
            required_skills_text=j.required_skills_text,
            experience_required=j.experience_required,
            locality=j.locality,
            availability=j.availability,
            work_type=j.work_type,
            final_score=r.final_score,
            semantic_score=r.semantic_score,
            explanation=schemas.MatchExplanation(**r.explanation),
        ))
    return results


# -------------------------- "Why this match?" for workers who applied (FR8)

@router.get("/applicants/{job_id}", response_model=List[schemas.ApplicantMatch])
def explain_applicants_for_job(
    job_id: int,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    """
    Match explanation for each worker who APPLIED to this job. Applicants are
    scored with the same Cross-Encoder + structured factors as recommendations,
    but are NOT dropped by the Step-0 filter (she chose to apply) - instead
    `eligible` says whether she would have passed it, and the explanation shows
    exactly which factor fell short. Decision support only.
    """
    job = _owned_job_or_error(db, job_id, current_user)
    workers = (
        db.query(models.WorkerProfile)
        .join(models.Application, models.Application.worker_id == models.WorkerProfile.id)
        .filter(models.Application.job_id == job.id)
        .all()
    )
    if not workers:
        return []

    query_text = build_job_text(job.title, job.description, job.required_skills_text)
    texts = [build_worker_text(w.structured_skills, w.about_description) for w in workers]
    ce_scores = rerank(query_text, texts)  # one batched Cross-Encoder call

    out = []
    for w, ce in zip(workers, ce_scores):
        factors = _job_vs_worker_factors(job, w)
        out.append(schemas.ApplicantMatch(
            worker_id=w.id,
            final_score=combine_final_score(ce, factors.structured_strength),
            semantic_score=round(float(ce), 4),
            eligible=is_structurally_eligible(factors),
            explanation=schemas.MatchExplanation(**build_explanation(factors, ce)),
        ))
    return out


# ------------------------------ naive keyword baseline (viva comparison only)

@router.get("/baseline/candidates/{job_id}", response_model=List[schemas.BaselineResult])
def baseline_candidates_for_job(
    job_id: int,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    job = _owned_job_or_error(db, job_id, current_user)
    query_keywords = tokenize(job.required_skills_text) | tokenize(job.title)
    scored = []
    for w in _active_workers(db):
        score, matched = keyword_overlap(query_keywords, f"{w.structured_skills} {w.about_description}")
        if score > 0:
            scored.append((score, w, matched))
    scored.sort(key=lambda t: (-t[0], t[1].id))
    return [
        schemas.BaselineResult(
            entity_id=w.id, name=w.full_name, skills=w.structured_skills,
            locality=w.locality, keyword_score=score, matched_keywords=matched,
        )
        for score, w, matched in scored[:SHORTLIST_SIZE]
    ]


@router.get("/baseline/jobs/{worker_id}", response_model=List[schemas.BaselineResult])
def baseline_jobs_for_worker(
    worker_id: int,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    worker = _own_worker_or_error(db, worker_id, current_user)
    query_keywords = tokenize(worker.structured_skills)
    scored = []
    for j in _open_active_jobs(db):
        score, matched = keyword_overlap(
            query_keywords, f"{j.title} {j.required_skills_text} {j.description}"
        )
        if score > 0:
            scored.append((score, j, matched))
    scored.sort(key=lambda t: (-t[0], t[1].id))
    return [
        schemas.BaselineResult(
            entity_id=j.id, name=j.title, skills=j.required_skills_text,
            locality=j.locality, keyword_score=score, matched_keywords=matched,
        )
        for score, j, matched in scored[:SHORTLIST_SIZE]
    ]
