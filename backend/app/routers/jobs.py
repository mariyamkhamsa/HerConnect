"""
FR5/FR6: Entrepreneurs post jobs with structured fields; skilled women can
browse all open jobs (independent of AI recommendations). Creating/editing a
job triggers SBERT embedding generation on title + description + required
skills, precomputed and stored.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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


def _check_category(db: Session, category: Optional[str]) -> None:
    if category and not db.query(models.Category).filter(models.Category.name == category.lower()).first():
        raise HTTPException(status_code=400, detail="Unknown category - pick one from the list")


def _my_entrepreneur(db: Session, user: models.User) -> Optional[models.EntrepreneurProfile]:
    return db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == user.id
    ).first()


@router.post("", response_model=schemas.JobOut, status_code=201)
def create_job(
    payload: schemas.JobIn,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    entrepreneur = _my_entrepreneur(db, current_user)
    if not entrepreneur:
        raise HTTPException(status_code=400, detail="Create your business profile before posting a job")
    _check_category(db, payload.category)

    data = payload.model_dump()
    if data.get("category"):
        data["category"] = data["category"].lower()
    job = models.Job(entrepreneur_id=entrepreneur.id, **data)
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
    entrepreneur = _my_entrepreneur(db, current_user)
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job or not entrepreneur or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=404, detail="Job not found")
    _check_category(db, payload.category)

    data = payload.model_dump()
    if data.get("category"):
        data["category"] = data["category"].lower()
    for field, value in data.items():
        setattr(job, field, value)
    _generate_and_store_embedding(job)  # re-embed on every edit
    db.commit()
    db.refresh(job)
    return job


@router.put("/{job_id}/status", response_model=schemas.JobOut)
def set_job_status(
    job_id: int,
    payload: schemas.JobStatusUpdate,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    """Close a filled job (hides it from browsing/recommendations) or reopen it."""
    entrepreneur = _my_entrepreneur(db, current_user)
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job or not entrepreneur or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = payload.status
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=List[schemas.JobOut])
def browse_jobs(
    category: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
):
    """
    FR6: manual browsing of all open jobs, independent of AI recommendations.
    Optional plain filters (category, text search) are ordinary SQL - no AI involved.
    Jobs from deactivated entrepreneurs are hidden.
    """
    query = (
        db.query(models.Job)
        .join(models.EntrepreneurProfile, models.Job.entrepreneur_id == models.EntrepreneurProfile.id)
        .join(models.User, models.EntrepreneurProfile.user_id == models.User.id)
        .filter(models.Job.status == "open", models.User.is_active.is_(True))
    )
    if category:
        query = query.filter(models.Job.category == category.lower())
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            models.Job.title.ilike(like)
            | models.Job.description.ilike(like)
            | models.Job.required_skills_text.ilike(like)
        )
    return query.order_by(models.Job.created_at.desc()).all()


@router.get("/mine", response_model=List[schemas.JobOut])
def my_jobs(
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    entrepreneur = _my_entrepreneur(db, current_user)
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
