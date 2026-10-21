"""
Entrepreneur -> worker invitations (the mirror image of applications).

  POST /invitations        entrepreneur invites a worker to one of her OPEN jobs
  GET  /invitations        entrepreneur: invitations she sent (optional ?job_id=)
                           worker:       invitations she received
  PUT  /invitations/{id}   the invited worker accepts or declines (once)

Rules enforced here (not just in the UI):
  * only the job's owner can invite, and only for an open job
  * the worker must be active and pass the SAME Step-0 structured eligibility filter the
    recommendation pipeline uses, i.e. she is a legitimate recommendation for that job
    (the SBERT + Cross-Encoder pipeline itself is untouched and is not re-run here)
  * at most one invitation per (job, worker); no invitation if she already applied
  * only the invited worker can respond, and only while the invitation is pending
Each step also creates an in-website notification in the same transaction.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.notify import notify
from app.privacy import _eligible_for_job

router = APIRouter(prefix="/invitations", tags=["invitations"])


def _to_out(inv: models.Invitation, job: models.Job, owner: models.EntrepreneurProfile,
            worker: models.WorkerProfile) -> schemas.InvitationOut:
    return schemas.InvitationOut(
        id=inv.id, job_id=inv.job_id, worker_id=inv.worker_id, status=inv.status,
        created_at=inv.created_at, responded_at=inv.responded_at,
        entrepreneur_share_contact=inv.entrepreneur_share_contact,
        worker_share_contact=inv.worker_share_contact,
        job_title=job.title, job_description=job.description,
        job_locality=job.locality, job_work_type=job.work_type,
        entrepreneur_id=owner.id, business_name=owner.business_name,
        worker_name=worker.full_name,
    )


def _rows(db: Session):
    return (
        db.query(models.Invitation, models.Job, models.EntrepreneurProfile, models.WorkerProfile)
        .join(models.Job, models.Invitation.job_id == models.Job.id)
        .join(models.EntrepreneurProfile, models.Job.entrepreneur_id == models.EntrepreneurProfile.id)
        .join(models.WorkerProfile, models.Invitation.worker_id == models.WorkerProfile.id)
    )


@router.post("", response_model=schemas.InvitationOut, status_code=201)
def invite_worker(
    payload: schemas.InvitationIn,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    owner = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Create your business profile before inviting workers")

    job = db.query(models.Job).filter(models.Job.id == payload.job_id).first()
    if not job or job.entrepreneur_id != owner.id:
        raise HTTPException(status_code=403, detail="Not your job posting")
    if job.status != "open":
        raise HTTPException(status_code=400, detail="You can only invite workers to an open job")

    worker = (
        db.query(models.WorkerProfile)
        .join(models.User, models.WorkerProfile.user_id == models.User.id)
        .filter(models.WorkerProfile.id == payload.worker_id, models.User.is_active.is_(True))
        .first()
    )
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    if not _eligible_for_job(job, worker):
        raise HTTPException(status_code=400, detail="This worker is not a current match for this job")

    if db.query(models.Application.id).filter(
        models.Application.job_id == job.id, models.Application.worker_id == worker.id
    ).first():
        raise HTTPException(status_code=400, detail="This worker has already applied to this job - review her application instead")

    existing = db.query(models.Invitation).filter(
        models.Invitation.job_id == job.id, models.Invitation.worker_id == worker.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"You have already invited this worker to this job ({existing.status})")

    inv = models.Invitation(
        job_id=job.id, worker_id=worker.id, entrepreneur_share_contact=payload.share_contact,
    )
    db.add(inv)
    notify(db, worker.user_id, "invitation_received",
           f'{owner.business_name} invited you to apply for "{job.title}"',
           "/worker/invitations")
    try:
        db.commit()
    except IntegrityError:  # simultaneous duplicate: the unique (job_id, worker_id) key wins
        db.rollback()
        raise HTTPException(status_code=400, detail="You have already invited this worker to this job")
    db.refresh(inv)
    return _to_out(inv, job, owner, worker)


@router.get("", response_model=List[schemas.InvitationOut])
def list_invitations(
    job_id: Optional[int] = Query(default=None),
    current_user: models.User = Depends(require_role("entrepreneur", "worker")),
    db: Session = Depends(get_db),
):
    """Scoped by role: a user only ever sees invitations she sent / received."""
    query = _rows(db)
    if current_user.role == "worker":
        me = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
        if not me:
            return []
        query = query.filter(models.Invitation.worker_id == me.id)
        if job_id is not None:
            query = query.filter(models.Invitation.job_id == job_id)
    else:
        owner = db.query(models.EntrepreneurProfile).filter(
            models.EntrepreneurProfile.user_id == current_user.id
        ).first()
        if not owner:
            return []
        query = query.filter(models.EntrepreneurProfile.id == owner.id)
        if job_id is not None:
            job = db.query(models.Job).filter(models.Job.id == job_id).first()
            if not job or job.entrepreneur_id != owner.id:
                raise HTTPException(status_code=403, detail="Not your job posting")
            query = query.filter(models.Invitation.job_id == job_id)
    rows = query.order_by(models.Invitation.created_at.desc(), models.Invitation.id.desc()).all()
    return [_to_out(*row) for row in rows]


@router.put("/{invitation_id}", response_model=schemas.InvitationOut)
def respond_to_invitation(
    invitation_id: int,
    payload: schemas.InvitationRespond,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    me = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    inv = db.query(models.Invitation).filter(models.Invitation.id == invitation_id).first()
    # Someone else's invitation is reported as "not found" so ids cannot be probed.
    if not me or not inv or inv.worker_id != me.id:
        raise HTTPException(status_code=404, detail="Invitation not found")

    job = db.query(models.Job).filter(models.Job.id == inv.job_id).first()
    owner = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.id == job.entrepreneur_id
    ).first()

    if payload.status == "accepted" and job.status != "open":
        raise HTTPException(status_code=400, detail="This job is no longer open")

    # Respond exactly once: the UPDATE only matches a still-pending row.
    changed = db.query(models.Invitation).filter(
        models.Invitation.id == invitation_id,
        models.Invitation.status == "pending",
    ).update(
        {
            "status": payload.status,
            "responded_at": datetime.utcnow(),
            "worker_share_contact": bool(payload.share_contact) if payload.status == "accepted" else False,
        },
        synchronize_session=False,
    )
    if changed == 0:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"You have already responded to this invitation ({inv.status})")

    if payload.status == "accepted":
        notify(db, owner.user_id, "invitation_accepted",
               f'{me.full_name} accepted your invitation for "{job.title}"', "/connections")
    else:
        notify(db, owner.user_id, "invitation_declined",
               f'{me.full_name} declined your invitation for "{job.title}"', "/entrepreneur/invitations")
    db.commit()
    db.refresh(inv)
    return _to_out(inv, job, owner, me)
