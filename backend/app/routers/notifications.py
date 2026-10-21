"""
In-website notifications. Every endpoint is scoped to the logged-in user's own rows.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role

router = APIRouter(prefix="/notifications", tags=["notifications"])

_ROLES = ("entrepreneur", "worker")


@router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: models.User = Depends(require_role(*_ROLES)),
    db: Session = Depends(get_db),
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.is_read.is_(False))
    return query.order_by(models.Notification.created_at.desc(), models.Notification.id.desc()).limit(limit).all()


@router.get("/unread-count", response_model=schemas.UnreadCount)
def unread_count(
    current_user: models.User = Depends(require_role(*_ROLES)),
    db: Session = Depends(get_db),
):
    n = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read.is_(False),
    ).count()
    return schemas.UnreadCount(unread=n)


@router.put("/read-all", response_model=schemas.UnreadCount)
def mark_all_read(
    current_user: models.User = Depends(require_role(*_ROLES)),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read.is_(False),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()
    return schemas.UnreadCount(unread=0)


@router.put("/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_read(
    notification_id: int,
    current_user: models.User = Depends(require_role(*_ROLES)),
    db: Session = Depends(get_db),
):
    note = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if not note:  # someone else's notification looks exactly like a missing one
        raise HTTPException(status_code=404, detail="Notification not found")
    note.is_read = True
    db.commit()
    db.refresh(note)
    return note
