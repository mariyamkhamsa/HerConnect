"""
FR7/FR8: Skilled women can apply to a job; entrepreneurs accept/reject.
Intentionally separate from the AI Recommendation module - a worker can be
AI-recommended without applying, and can apply without being recommended.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.notify import notify

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

    # An invitation for the same job already covers this relationship - answer it instead
    # of creating a second, parallel request for the same pair.
    invitation = db.query(models.Invitation).filter(
        models.Invitation.job_id == payload.job_id,
        models.Invitation.worker_id == worker.id,
    ).first()
    if invitation and invitation.status == "pending":
        raise HTTPException(status_code=400, detail="You have a pending invitation for this job - accept or decline it under Invitations")
    if invitation and invitation.status == "accepted":
        raise HTTPException(status_code=400, detail="You are already connected for this job through an accepted invitation")

    application = models.Application(
        job_id=payload.job_id, worker_id=worker.id, worker_share_contact=payload.share_contact,
    )
    db.add(application)
    owner = db.query(models.EntrepreneurProfile).filter(models.EntrepreneurProfile.id == job.entrepreneur_id).first()
    if owner:
        notify(db, owner.user_id, "application_received",
               f'{worker.full_name} applied for "{job.title}"',
               f"/entrepreneur/jobs/{job.id}/applications")
    try:
        db.commit()
    except IntegrityError:  # two simultaneous requests: the unique (job_id, worker_id) key wins
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already applied to this job")
    db.refresh(application)
    return application


@router.get("", response_model=List[schemas.ApplicationOut])
def list_applications(
    job_id: Optional[int] = Query(default=None),
    worker_id: Optional[int] = Query(default=None),
    current_user: models.User = Depends(require_role("entrepreneur", "worker")),
    db: Session = Depends(get_db),
):
    """
    Scoped by role so nobody can read someone else's applications:
      - worker: only her own applications (worker_id, if given, must be her own)
      - entrepreneur: only applications to jobs she owns (job_id, if given, must be hers)
    """
    query = db.query(models.Application)

    if current_user.role == "worker":
        me = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
        if not me:
            return []
        if worker_id is not None and worker_id != me.id:
            raise HTTPException(status_code=403, detail="Not your applications")
        query = query.filter(models.Application.worker_id == me.id)
        if job_id is not None:
            query = query.filter(models.Application.job_id == job_id)
    else:
        owner = db.query(models.EntrepreneurProfile).filter(
            models.EntrepreneurProfile.user_id == current_user.id
        ).first()
        if not owner:
            return []
        if job_id is not None:
            job = db.query(models.Job).filter(models.Job.id == job_id).first()
            if not job or job.entrepreneur_id != owner.id:
                raise HTTPException(status_code=403, detail="Not your job posting")
            query = query.filter(models.Application.job_id == job_id)
        else:
            my_job_ids = [j.id for j in db.query(models.Job.id).filter(models.Job.entrepreneur_id == owner.id)]
            query = query.filter(models.Application.job_id.in_(my_job_ids or [-1]))
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

    # Decide exactly once: the UPDATE only matches a still-pending row, so a double click
    # or two browser tabs cannot decide (or notify) twice, and an accepted application can
    # never be flipped to rejected after contact details were shared.
    values = {"status": payload.status}
    if payload.status == "accepted":
        values["entrepreneur_share_contact"] = payload.share_contact
    changed = db.query(models.Application).filter(
        models.Application.id == application_id,
        models.Application.status == "pending",
    ).update(values, synchronize_session=False)
    if changed == 0:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"This application was already {application.status}")

    worker = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == application.worker_id).first()
    if worker:
        if payload.status == "accepted":
            notify(db, worker.user_id, "application_accepted",
                   f'Your application for "{job.title}" was accepted',
                   "/connections")
        else:
            notify(db, worker.user_id, "application_rejected",
                   f'Your application for "{job.title}" was not accepted',
                   f"/worker/{worker.id}/applications")
    db.commit()
    db.refresh(application)
    return application
