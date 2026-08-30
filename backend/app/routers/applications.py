"""
FR7/FR8: Skilled women can apply to a job; entrepreneurs accept/reject.
Intentionally separate from the AI Recommendation module - a worker can be
AI-recommended without applying, and can apply without being recommended.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("", response_model=schemas.ApplicationOut, status_code=201)
def apply_to_job(
    payload: schemas.ApplicationIn,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    worker = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=400, detail="Create your worker profile before applying")

    job = db.query(models.Job).filter(models.Job.id == payload.job_id).first()
    if not job or job.status != "open":
        raise HTTPException(status_code=404, detail="Job not found or no longer open")

    existing = db.query(models.Application).filter(
        models.Application.job_id == payload.job_id,
        models.Application.worker_id == worker.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    application = models.Application(job_id=payload.job_id, worker_id=worker.id)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("", response_model=List[schemas.ApplicationOut])
def list_applications(
    job_id: Optional[int] = Query(default=None),
    worker_id: Optional[int] = Query(default=None),
    current_user: models.User = Depends(require_role("entrepreneur", "worker")),
    db: Session = Depends(get_db),
):
    query = db.query(models.Application)
    if job_id is not None:
        query = query.filter(models.Application.job_id == job_id)
    if worker_id is not None:
        query = query.filter(models.Application.worker_id == worker_id)
    return query.order_by(models.Application.applied_at.desc()).all()


@router.put("/{application_id}", response_model=schemas.ApplicationOut)
def update_application_status(
    application_id: int,
    payload: schemas.ApplicationStatusUpdate,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    application = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    job = db.query(models.Job).filter(models.Job.id == application.job_id).first()
    if not entrepreneur or not job or job.entrepreneur_id != entrepreneur.id:
        raise HTTPException(status_code=403, detail="Not your job posting")

    application.status = payload.status
    db.commit()
    db.refresh(application)
    return application
