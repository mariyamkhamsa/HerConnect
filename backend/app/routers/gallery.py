"""
Portfolio / gallery for worker and entrepreneur profiles: images with a title and description.

Display-only - nothing here touches the SBERT / Cross-Encoder pipeline or embeddings.

Images are validated like profile photos (PNG/JPG/WEBP, <= 3 MB, content must match the type) and
are served only through authenticated endpoints that apply the SAME visibility rules as the
profile photo of the same profile. Demo/sample items may instead hold an external https URL, which
the API returns in `external_url` so the browser loads it directly.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_role
from app.privacy import worker_can_view_entrepreneur
from app.routers.workers import (
    _photo_response, _remove_old_file, _require_profile_access, _save_profile_photo,
)

router = APIRouter(tags=["gallery"])

MAX_GALLERY_ITEMS = 12


# ------------------------------------------------------------------ helpers

def _parse_text(title: str, description: Optional[str]) -> schemas.GalleryItemUpdate:
    try:
        return schemas.GalleryItemUpdate(title=title, description=description)
    except Exception as exc:  # pydantic ValidationError -> a readable 422
        errors = getattr(exc, "errors", lambda: [])()
        msg = "Enter a title (up to 150 characters) and a description (up to 1000 characters)."
        if errors:
            msg = str(errors[0].get("msg", msg)).replace("Value error, ", "")
        raise HTTPException(status_code=422, detail=msg)


def _add_item(db: Session, owner_filter: dict, owner, file: UploadFile, title: str, description: Optional[str]):
    meta = _parse_text(title, description)
    if len(owner.gallery_items) >= MAX_GALLERY_ITEMS:
        raise HTTPException(status_code=400, detail=f"You can add up to {MAX_GALLERY_ITEMS} gallery items")
    path = _save_profile_photo(file, None)  # validates type/size/content, stores in UPLOAD_DIR
    next_order = max([i.sort_order for i in owner.gallery_items], default=0) + 1
    item = models.PortfolioItem(
        title=meta.title, description=meta.description, image_path=path, sort_order=next_order, **owner_filter
    )
    db.add(item)
    db.commit()
    db.refresh(owner)
    return owner


def _find_item(db: Session, item_id: int, **owner_filter) -> models.PortfolioItem:
    item = db.query(models.PortfolioItem).filter_by(id=item_id, **owner_filter).first()
    if not item:
        raise HTTPException(status_code=404, detail="Gallery item not found")
    return item


def _worker_of(db: Session, user: models.User) -> models.WorkerProfile:
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Save your profile before adding gallery items")
    return profile


def _business_of(db: Session, user: models.User) -> models.EntrepreneurProfile:
    profile = db.query(models.EntrepreneurProfile).filter(models.EntrepreneurProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Save your profile before adding gallery items")
    return profile


# ------------------------------------------------------------------ workers

@router.post("/workers/me/gallery", response_model=schemas.WorkerProfileMeOut)
def add_worker_gallery_item(
    title: str = Form(...), description: Optional[str] = Form(None), file: UploadFile = File(...),
    current_user: models.User = Depends(require_role("worker")), db: Session = Depends(get_db),
):
    profile = _worker_of(db, current_user)
    return _add_item(db, {"worker_id": profile.id}, profile, file, title, description)


@router.put("/workers/me/gallery/{item_id}", response_model=schemas.WorkerProfileMeOut)
def update_worker_gallery_item(
    item_id: int, payload: schemas.GalleryItemUpdate,
    current_user: models.User = Depends(require_role("worker")), db: Session = Depends(get_db),
):
    profile = _worker_of(db, current_user)
    item = _find_item(db, item_id, worker_id=profile.id)
    item.title, item.description = payload.title, payload.description
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/workers/me/gallery/{item_id}", response_model=schemas.WorkerProfileMeOut)
def delete_worker_gallery_item(
    item_id: int,
    current_user: models.User = Depends(require_role("worker")), db: Session = Depends(get_db),
):
    profile = _worker_of(db, current_user)
    item = _find_item(db, item_id, worker_id=profile.id)
    _remove_old_file(item.image_path)  # no-op for external URLs
    db.delete(item)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/workers/{worker_id}/gallery/{item_id}/image")
def get_worker_gallery_image(
    worker_id: int, item_id: int,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    _require_profile_access(db, current_user, profile)  # same rule as the profile itself
    return _photo_response(_find_item(db, item_id, worker_id=profile.id).image_path)


# ------------------------------------------------------------------ entrepreneurs

@router.post("/entrepreneurs/me/gallery", response_model=schemas.EntrepreneurProfileMeOut)
def add_business_gallery_item(
    title: str = Form(...), description: Optional[str] = Form(None), file: UploadFile = File(...),
    current_user: models.User = Depends(require_role("entrepreneur")), db: Session = Depends(get_db),
):
    profile = _business_of(db, current_user)
    return _add_item(db, {"entrepreneur_id": profile.id}, profile, file, title, description)


@router.put("/entrepreneurs/me/gallery/{item_id}", response_model=schemas.EntrepreneurProfileMeOut)
def update_business_gallery_item(
    item_id: int, payload: schemas.GalleryItemUpdate,
    current_user: models.User = Depends(require_role("entrepreneur")), db: Session = Depends(get_db),
):
    profile = _business_of(db, current_user)
    item = _find_item(db, item_id, entrepreneur_id=profile.id)
    item.title, item.description = payload.title, payload.description
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/entrepreneurs/me/gallery/{item_id}", response_model=schemas.EntrepreneurProfileMeOut)
def delete_business_gallery_item(
    item_id: int,
    current_user: models.User = Depends(require_role("entrepreneur")), db: Session = Depends(get_db),
):
    profile = _business_of(db, current_user)
    item = _find_item(db, item_id, entrepreneur_id=profile.id)
    _remove_old_file(item.image_path)
    db.delete(item)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/entrepreneurs/{entrepreneur_id}/gallery/{item_id}/image")
def get_business_gallery_image(
    entrepreneur_id: int, item_id: int,
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    profile = db.query(models.EntrepreneurProfile).filter(models.EntrepreneurProfile.id == entrepreneur_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Business profile not found")
    # Same visibility rule as the business profile / its photo.
    if current_user.role == "worker" and not worker_can_view_entrepreneur(db, current_user, profile):
        raise HTTPException(status_code=404, detail="Business profile not found")
    return _photo_response(_find_item(db, item_id, entrepreneur_id=profile.id).image_path)
