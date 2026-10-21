"""
Connections = accepted applications + accepted invitations, seen from the current user's side.

Contact details are consent-based and one-directional per side:
  * each side has its own flag (`*_share_contact`) that only that side can change;
  * you can see the OTHER side's email/phone only when the connection is accepted AND
    they have agreed to share (`counterpart_shared`). Otherwise `contact` is null and the
    details never leave the server;
  * either side can switch their own sharing on or off later (PUT .../consent);
  * deactivated counterparts are not listed, so their details are never exposed.
The email is the counterpart's account email; the phone is the optional number from their
profile. Neither is ever part of the profile endpoints for other users.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.notify import notify

router = APIRouter(prefix="/connections", tags=["connections"])

_SOURCES = {"application": models.Application, "invitation": models.Invitation}


def _worker_side_rows(db: Session, worker: models.WorkerProfile) -> List[schemas.ConnectionOut]:
    out = []
    for source, Model, when in (
        ("application", models.Application, models.Application.applied_at),
        ("invitation", models.Invitation, models.Invitation.responded_at),
    ):
        rows = (
            db.query(Model, models.Job, models.EntrepreneurProfile, models.User)
            .join(models.Job, Model.job_id == models.Job.id)
            .join(models.EntrepreneurProfile, models.Job.entrepreneur_id == models.EntrepreneurProfile.id)
            .join(models.User, models.EntrepreneurProfile.user_id == models.User.id)
            .filter(Model.worker_id == worker.id, Model.status == "accepted", models.User.is_active.is_(True))
            .all()
        )
        for item, job, owner, owner_user in rows:
            shared = bool(item.entrepreneur_share_contact)
            out.append(schemas.ConnectionOut(
                source=source, source_id=item.id, job_id=job.id, job_title=job.title,
                counterpart_name=owner.business_name, counterpart_role="entrepreneur",
                counterpart_profile_id=owner.id,
                connected_at=(item.responded_at if source == "invitation" else item.applied_at),
                my_share_contact=bool(item.worker_share_contact),
                counterpart_shared=shared,
                contact=schemas.ContactDetails(name=owner.business_name, email=owner_user.email, phone=owner.phone)
                if shared else None,
            ))
    return out


def _entrepreneur_side_rows(db: Session, owner: models.EntrepreneurProfile) -> List[schemas.ConnectionOut]:
    out = []
    for source, Model in (("application", models.Application), ("invitation", models.Invitation)):
        rows = (
            db.query(Model, models.Job, models.WorkerProfile, models.User)
            .join(models.Job, Model.job_id == models.Job.id)
            .join(models.WorkerProfile, Model.worker_id == models.WorkerProfile.id)
            .join(models.User, models.WorkerProfile.user_id == models.User.id)
            .filter(models.Job.entrepreneur_id == owner.id, Model.status == "accepted", models.User.is_active.is_(True))
            .all()
        )
        for item, job, worker, worker_user in rows:
            shared = bool(item.worker_share_contact)
            out.append(schemas.ConnectionOut(
                source=source, source_id=item.id, job_id=job.id, job_title=job.title,
                counterpart_name=worker.full_name, counterpart_role="worker",
                counterpart_profile_id=worker.id,
                connected_at=(item.responded_at if source == "invitation" else item.applied_at),
                my_share_contact=bool(item.entrepreneur_share_contact),
                counterpart_shared=shared,
                contact=schemas.ContactDetails(name=worker.full_name, email=worker_user.email, phone=worker.phone)
                if shared else None,
            ))
    return out


def _my_connections(db: Session, user: models.User) -> List[schemas.ConnectionOut]:
    if user.role == "worker":
        me = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == user.id).first()
        rows = _worker_side_rows(db, me) if me else []
    else:
        owner = db.query(models.EntrepreneurProfile).filter(
            models.EntrepreneurProfile.user_id == user.id
        ).first()
        rows = _entrepreneur_side_rows(db, owner) if owner else []
    rows.sort(key=lambda c: (c.connected_at is not None, c.connected_at), reverse=True)
    return rows


@router.get("", response_model=List[schemas.ConnectionOut])
def list_connections(
    current_user: models.User = Depends(require_role("entrepreneur", "worker")),
    db: Session = Depends(get_db),
):
    return _my_connections(db, current_user)


@router.put("/{source}/{item_id}/consent", response_model=schemas.ConnectionOut)
def set_contact_consent(
    source: str,
    item_id: int,
    payload: schemas.ConsentUpdate,
    current_user: models.User = Depends(require_role("entrepreneur", "worker")),
    db: Session = Depends(get_db),
):
    """Turn MY side's contact sharing on/off for one accepted connection."""
    Model = _SOURCES.get(source)
    if Model is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    item = db.query(Model).filter(Model.id == item_id).first()
    job = db.query(models.Job).filter(models.Job.id == item.job_id).first() if item else None
    if not item or not job:
        raise HTTPException(status_code=404, detail="Connection not found")

    if current_user.role == "worker":
        me = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
        if not me or item.worker_id != me.id:
            raise HTTPException(status_code=404, detail="Connection not found")
        flag, label = "worker_share_contact", me.full_name
        other_user_id = db.query(models.EntrepreneurProfile.user_id).filter(
            models.EntrepreneurProfile.id == job.entrepreneur_id
        ).scalar()
    else:
        owner = db.query(models.EntrepreneurProfile).filter(
            models.EntrepreneurProfile.user_id == current_user.id
        ).first()
        if not owner or job.entrepreneur_id != owner.id:
            raise HTTPException(status_code=404, detail="Connection not found")
        flag, label = "entrepreneur_share_contact", owner.business_name
        other_user_id = db.query(models.WorkerProfile.user_id).filter(
            models.WorkerProfile.id == item.worker_id
        ).scalar()

    if item.status != "accepted":
        raise HTTPException(status_code=400, detail="Contact details can only be shared after the connection is accepted")

    was_shared = bool(getattr(item, flag))
    setattr(item, flag, bool(payload.share))
    if payload.share and not was_shared and other_user_id:
        notify(db, other_user_id, "contact_shared",
               f'{label} shared their contact details with you for "{job.title}"', "/connections")
    db.commit()

    for c in _my_connections(db, current_user):
        if c.source == source and c.source_id == item_id:
            return c
    raise HTTPException(status_code=404, detail="Connection not found")
