"""
FR3/FR4: Skilled women can create/edit a profile (structured skills + free-text
About/Description + experience/location/availability/work type) and optionally
upload ONE portfolio/certificate file. Creating/editing the profile triggers
SBERT embedding generation on the combined skills + description text, which is
then stored (precomputed) rather than recomputed on every recommendation call.
"""
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import require_role
from app.config import settings
from app.ai.embeddings import build_worker_text, compute_embedding, serialize_embedding

router = APIRouter(prefix="/workers", tags=["workers"])

ALLOWED_PORTFOLIO_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_PORTFOLIO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _generate_and_store_embedding(profile: models.WorkerProfile) -> None:
    text = build_worker_text(profile.structured_skills, profile.about_description)
    vector = compute_embedding(text)
    profile.embedding = serialize_embedding(vector)


@router.get("/me", response_model=schemas.WorkerProfileOut)
def get_my_profile(
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(
        models.WorkerProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No worker profile yet")
    return profile


@router.post("/me", response_model=schemas.WorkerProfileOut)
def create_or_update_my_profile(
    payload: schemas.WorkerProfileIn,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(
        models.WorkerProfile.user_id == current_user.id
    ).first()
    if profile:
        for field, value in payload.model_dump().items():
            setattr(profile, field, value)
    else:
        profile = models.WorkerProfile(user_id=current_user.id, **payload.model_dump())
        db.add(profile)

    db.flush()
    _generate_and_store_embedding(profile)  # AI embedding trigger, precomputed & stored
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/me/portfolio", response_model=schemas.WorkerProfileOut)
def upload_portfolio(
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
):
    profile = db.query(models.WorkerProfile).filter(
        models.WorkerProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Create your profile before uploading a portfolio file")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_PORTFOLIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Portfolio must be a PDF, PNG, or JPG file")

    contents = file.file.read()
    if len(contents) > MAX_PORTFOLIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Portfolio file must be under 5 MB")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(contents)

    profile.portfolio_file_path = stored_path
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{worker_id}", response_model=schemas.WorkerProfileOut)
def get_worker(worker_id: int, db: Session = Depends(get_db)):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    return profile
