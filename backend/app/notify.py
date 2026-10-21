"""
In-website notifications.

`notify()` only *adds* the row to the caller's session - it never commits. The caller
commits once, so the business action (invite / apply / accept ...) and its notification
are stored in the same transaction: either both exist or neither does, and a retried or
double-clicked action can never leave a stray notification behind.
"""
from sqlalchemy.orm import Session

from app import models


def notify(db: Session, user_id: int, kind: str, message: str, link: str = None) -> models.Notification:
    note = models.Notification(user_id=user_id, kind=kind, message=message[:500], link=link)
    db.add(note)
    return note
