"""
Profile-visibility rules for the "View Profile" feature.

Kept in one place so the workers and entrepreneurs routers apply the same,
testable policy. These helpers only decide *whether* a viewer may see a profile;
they never touch the SBERT / Cross-Encoder pipeline.

Entrepreneur -> worker profile (and portfolio file):
    worker's account must be active AND the worker either
      * applied to one of this entrepreneur's jobs, or
      * was invited by this entrepreneur to one of her jobs, or
      * passes the same structured eligibility filter (Step 0 of the pipeline)
        for at least one of this entrepreneur's jobs, i.e. she can show up in
        their AI recommendations.

Worker -> business profile:
    business account must be active AND either
      * the business has at least one open job (visible in job browsing), or
      * the worker has applied to one of the business's jobs, or
      * the business has invited the worker to one of its jobs.

Admins are handled by the routers (they may view everything).
"""
from sqlalchemy.orm import Session

from app import models
from app.ai.pipeline import evaluate_structured_factors, is_structurally_eligible


def _worker_applied_to_entrepreneur(db: Session, worker_id: int, entrepreneur_id: int) -> bool:
    return (
        db.query(models.Application.id)
        .join(models.Job, models.Application.job_id == models.Job.id)
        .filter(
            models.Application.worker_id == worker_id,
            models.Job.entrepreneur_id == entrepreneur_id,
        )
        .first()
        is not None
    )


def _worker_invited_by_entrepreneur(db: Session, worker_id: int, entrepreneur_id: int) -> bool:
    return (
        db.query(models.Invitation.id)
        .join(models.Job, models.Invitation.job_id == models.Job.id)
        .filter(
            models.Invitation.worker_id == worker_id,
            models.Job.entrepreneur_id == entrepreneur_id,
        )
        .first()
        is not None
    )


def _eligible_for_job(job: models.Job, worker: models.WorkerProfile) -> bool:
    # Same arguments as recommendations._job_vs_worker_factors - keep in sync.
    factors = evaluate_structured_factors(
        candidate_locality=worker.locality, target_locality=job.locality,
        candidate_availability=worker.availability, target_availability=job.availability,
        candidate_work_type=worker.work_type, target_work_type=job.work_type,
        candidate_experience=worker.experience_years, required_experience=job.experience_required,
    )
    return is_structurally_eligible(factors)


def entrepreneur_can_view_worker(db: Session, user: models.User, worker: models.WorkerProfile) -> bool:
    if worker.user is None or not worker.user.is_active:
        return False
    entrepreneur = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == user.id
    ).first()
    if entrepreneur is None:
        return False
    if _worker_applied_to_entrepreneur(db, worker.id, entrepreneur.id):
        return True
    if _worker_invited_by_entrepreneur(db, worker.id, entrepreneur.id):
        return True
    jobs = db.query(models.Job).filter(models.Job.entrepreneur_id == entrepreneur.id).all()
    return any(_eligible_for_job(job, worker) for job in jobs)


def worker_can_view_entrepreneur(db: Session, user: models.User, entrepreneur: models.EntrepreneurProfile) -> bool:
    if entrepreneur.user is None or not entrepreneur.user.is_active:
        return False
    has_open_job = (
        db.query(models.Job.id)
        .filter(models.Job.entrepreneur_id == entrepreneur.id, models.Job.status == "open")
        .first()
        is not None
    )
    if has_open_job:
        return True
    worker = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == user.id).first()
    return worker is not None and (
        _worker_applied_to_entrepreneur(db, worker.id, entrepreneur.id)
        or _worker_invited_by_entrepreneur(db, worker.id, entrepreneur.id)
    )


# ---------------------------------------------------------------- public e-mail rules

def public_worker_email(worker: models.WorkerProfile):
    """A worker's account e-mail is public ONLY if she switched "Show my email publicly" on."""
    if worker.show_email_publicly and worker.user is not None:
        return worker.user.email
    return None


def public_entrepreneur_email(entrepreneur: models.EntrepreneurProfile):
    """An entrepreneur's account e-mail is always shown on her public business profile."""
    return entrepreneur.user.email if entrepreneur.user is not None else None

