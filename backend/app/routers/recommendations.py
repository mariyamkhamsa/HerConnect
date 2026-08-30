"""
FR9/FR10/FR12: AI-recommended workers for a job, and AI-recommended jobs for a
worker, each with a "Why this match?" breakdown. This is where the structured
eligibility filter (normal code) and the two-stage AI pipeline (SBERT +
Cross-Encoder) are wired together against real database records - nothing here
is hardcoded or faked.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.ai.embeddings import build_job_text, build_worker_text, compute_embedding
from app.ai.pipeline import evaluate_structured_factors, is_structurally_eligible, run_recommendation_pipeline

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/candidates/{job_id}", response_model=List[schemas.WorkerRecommendation])
def recommend_candidates_for_job(
    job_id: int,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if not entrepreneur or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=403, detail="Not your job posting")

    all_workers = db.query(models.WorkerProfile).all()

    # Step 0: normal-code structured eligibility filtering
    pool = []
    worker_lookup = {}
    for worker in all_workers:
        factors = evaluate_structured_factors(
            candidate_locality=worker.locality, target_locality=job.locality,
            candidate_availability=worker.availability, target_availability=job.availability,
            candidate_work_type=worker.work_type, target_work_type=job.work_type,
            candidate_experience=worker.experience_years, required_experience=job.experience_required,
        )
        if not is_structurally_eligible(factors):
            continue
        pool.append({
            "id": worker.id,
            "embedding": worker.embedding,
            "text": build_worker_text(worker.structured_skills, worker.about_description),
            "structured": factors,
        })
        worker_lookup[worker.id] = worker

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


@router.get("/jobs/{worker_id}", response_model=List[schemas.JobRecommendation])
def recommend_jobs_for_worker(
    worker_id: int,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    worker = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    if worker.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your profile")

    open_jobs = db.query(models.Job).filter(models.Job.status == "open").all()

    pool = []
    job_lookup = {}
    for job in open_jobs:
        factors = evaluate_structured_factors(
            candidate_locality=job.locality, target_locality=worker.locality,
            candidate_availability=job.availability, target_availability=worker.availability,
            candidate_work_type=job.work_type, target_work_type=worker.work_type,
            candidate_experience=worker.experience_years, required_experience=job.experience_required,
        )
        if not is_structurally_eligible(factors):
            continue
        pool.append({
            "id": job.id,
            "embedding": job.embedding,
            "text": build_job_text(job.title, job.description, job.required_skills_text),
            "structured": factors,
        })
        job_lookup[job.id] = job

    query_text = build_worker_text(worker.structured_skills, worker.about_description)
    query_embedding = compute_embedding(query_text)

    ranked = run_recommendation_pipeline(query_text, query_embedding, pool)

    results = []
    for r in ranked:
        j = job_lookup[r.entity_id]
        results.append(schemas.JobRecommendation(
            job_id=j.id,
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
