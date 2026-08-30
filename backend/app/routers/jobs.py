"""
FR5/FR6: Entrepreneurs post jobs with structured fields; skilled women can
browse all open jobs (independent of AI recommendations). Creating/editing a
job triggers SBERT embedding generation on title + description + required
skills, precomputed and stored.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.ai.embeddings import build_job_text, compute_embedding, serialize_embedding

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _generate_and_store_embedding(job: models.Job) -> None:
    text = build_job_text(job.title, job.description, job.required_skills_text)
    vector = compute_embedding(text)
    job.embedding = serialize_embedding(vector)


@router.post("", response_model=schemas.JobOut, status_code=201)
def create_job(
    payload: schemas.JobIn,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if not entrepreneur:
        raise HTTPException(status_code=400, detail="Create your business profile before posting a job")

    job = models.Job(entrepreneur_id=entrepreneur.id, **payload.model_dump())
    db.add(job)
    db.flush()
    _generate_and_store_embedding(job)
    db.commit()
    db.refresh(job)
    return job


@router.put("/{job_id}", response_model=schemas.JobOut)
def update_job(
    job_id: int,
    payload: schemas.JobIn,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job or not entrepreneur or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=404, detail="Job not found")

    for field, value in payload.model_dump().items():
        setattr(job, field, value)
    _generate_and_store_embedding(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=List[schemas.JobOut])
def browse_jobs(db: Session = Depends(get_db)):
    """FR6: manual browsing of all open jobs, independent of AI recommendations."""
    return db.query(models.Job).filter(models.Job.status == "open").order_by(models.Job.created_at.desc()).all()


@router.get("/mine", response_model=List[schemas.JobOut])
def my_jobs(
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if not entrepreneur:
        return []
    return db.query(models.Job).filter(models.Job.entrepreneur_id == entrepreneur.id).order_by(
        models.Job.created_at.desc()
    ).all()


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
