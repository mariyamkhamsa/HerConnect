"""
FR3/FR4: Skilled women can create/edit a profile (structured skills + free-text
About/Description + experience/location/availability/work type) and optionally
upload ONE portfolio/certificate file. Creating/editing the profile triggers
SBERT embedding generation on the combined skills + description text, which is
then stored (precomputed) rather than recomputed on every recommendation call.

Portfolio files are never served publicly: they are returned only through an
authenticated endpoint to the owner, entrepreneurs and admins (so an
entrepreneur can review them before the final hiring decision, FR8).
"""
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_role
from app.config import settings
from app.privacy import entrepreneur_can_view_worker, public_worker_email
from app.ai.embeddings import build_worker_text, compute_embedding, serialize_embedding

router = APIRouter(prefix="/workers", tags=["workers"])

ALLOWED_PORTFOLIO_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_PORTFOLIO_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Display-only profile fields (not part of the AI text); left untouched when a client omits them.
PROFILE_EXTRA_FIELDS = {"services_offered", "languages", "professional_intro", "certifications"}

# (magic bytes, media type) - the file CONTENT must match its extension family
_SIGNATURES = {
    ".pdf": (b"%PDF", "application/pdf"),
    ".png": (b"\x89PNG\r\n\x1a\n", "image/png"),
    ".jpg": (b"\xff\xd8\xff", "image/jpeg"),
    ".jpeg": (b"\xff\xd8\xff", "image/jpeg"),
}


def _generate_and_store_embedding(profile: models.WorkerProfile) -> None:
    text = build_worker_text(profile.structured_skills, profile.about_description)
    vector = compute_embedding(text)
    profile.embedding = serialize_embedding(vector)


def _safe_portfolio_path(stored_path: Optional[str]) -> Optional[str]:
    """Return the stored path only if it really lives inside UPLOAD_DIR and exists."""
    if not stored_path:
        return None
    upload_root = os.path.realpath(settings.UPLOAD_DIR)
    candidate = os.path.realpath(stored_path)
    if os.path.commonpath([upload_root, candidate]) != upload_root:
        return None
    return candidate if os.path.isfile(candidate) else None


def _remove_old_file(stored_path: Optional[str]) -> None:
    safe = _safe_portfolio_path(stored_path)
    if safe:
        try:
            os.remove(safe)
        except OSError:
            pass


def _require_profile_access(db: Session, current_user: models.User, profile: models.WorkerProfile) -> None:
    """
    Who may see a worker profile (and her portfolio file):
      * the worker herself and admins - always
      * an entrepreneur - only if the worker is active AND either applied to one of
        that entrepreneur's jobs or is structurally eligible for one of them (i.e. she
        can appear in their AI recommendations). Otherwise 404, so ids can't be probed.
      * other workers - never (403, unchanged behaviour)
    """
    if current_user.role == "admin" or profile.user_id == current_user.id:
        return
    if current_user.role == "worker":
        raise HTTPException(status_code=403, detail="Not your profile")
    if current_user.role == "entrepreneur" and entrepreneur_can_view_worker(db, current_user, profile):
        return
    raise HTTPException(status_code=404, detail="Worker profile not found")


@router.get("/me", response_model=schemas.WorkerProfileMeOut)
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


@router.post("/me", response_model=schemas.WorkerProfileMeOut)
def create_or_update_my_profile(
    payload: schemas.WorkerProfileIn,
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(
        models.WorkerProfile.user_id == current_user.id
    ).first()
    data = payload.model_dump()
    if profile:
        for field, value in data.items():
            if field == "phone" and "phone" not in payload.model_fields_set:
                continue  # older clients that don't send a phone must not wipe the stored one
            if field in PROFILE_EXTRA_FIELDS and field not in payload.model_fields_set:
                continue  # omitted display-only field -> keep what is stored
            if field == "show_email_publicly" and value is None:
                continue  # omitted -> keep the stored choice
            setattr(profile, field, value)
    else:
        data["show_email_publicly"] = bool(data.get("show_email_publicly"))  # default OFF
        profile = models.WorkerProfile(user_id=current_user.id, **data)
        db.add(profile)

    db.flush()
    _generate_and_store_embedding(profile)  # AI embedding trigger, precomputed & stored
    db.commit()
    db.refresh(profile)
    return profile




ALLOWED_PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
PHOTO_SIGNATURES = {".png": b"\x89PNG\r\n\x1a\n", ".jpg": b"\xff\xd8\xff", ".jpeg": b"\xff\xd8\xff", ".webp": b"RIFF"}
MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024

def _is_external_photo_url(stored_value: Optional[str]) -> bool:
    """True when profile_photo_path holds an external HTTPS image URL (e.g. demo/sample accounts)
    rather than a file saved in UPLOAD_DIR. The browser loads those directly from their host."""
    return isinstance(stored_value, str) and stored_value.strip().lower().startswith("https://")

def _safe_profile_photo_path(stored_path: Optional[str]) -> Optional[str]:
    if not stored_path or _is_external_photo_url(stored_path): return None  # URLs are never local files
    root = os.path.realpath(settings.UPLOAD_DIR)
    candidate = os.path.realpath(stored_path)
    try:
        if os.path.commonpath([root, candidate]) != root: return None
    except ValueError:  # e.g. different drives on Windows
        return None
    return candidate if os.path.isfile(candidate) else None

def _photo_response(stored_value: Optional[str]):
    """Response for GET .../photo (caller has already passed the access check).
    Local upload -> the file. External https URL -> {"url": ...} so the browser loads it from its host
    (a cross-origin redirect would lose the auth header and trip CORS). Nothing usable -> 404."""
    if _is_external_photo_url(stored_value):
        return JSONResponse({"url": stored_value.strip()})
    path = _safe_profile_photo_path(stored_value)
    if not path: raise HTTPException(status_code=404, detail="No profile photo")
    return FileResponse(path)

def _email_initial(email: Optional[str]) -> str:
    """First character of the account email, uppercased; 'U' when there is no email."""
    first = (email or "").strip()[:1]
    return first.upper()[:1] or "U"

def _save_profile_photo(file: UploadFile, old_path: Optional[str]) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_PHOTO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Photo must be PNG, JPG, or WEBP")
    contents = file.file.read(MAX_PHOTO_SIZE_BYTES + 1)
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Photo must be 3 MB or smaller")
    signature = PHOTO_SIGNATURES[ext]
    if not contents.startswith(signature) or (ext == ".webp" and contents[8:12] != b"WEBP"):
        raise HTTPException(status_code=400, detail="File content does not match its image type")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    path = os.path.join(settings.UPLOAD_DIR, f"profile_{uuid.uuid4().hex}{ext}")
    with open(path, "wb") as output: output.write(contents)
    safe_old = _safe_profile_photo_path(old_path)
    if safe_old:
        try: os.remove(safe_old)
        except OSError: pass
    return path

@router.post("/me/photo", response_model=schemas.WorkerProfileMeOut)
def upload_my_profile_photo(current_user: models.User = Depends(require_role("worker")), db: Session = Depends(get_db), file: UploadFile = File(...)):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not profile: raise HTTPException(status_code=404, detail="Save your profile before uploading a photo")
    profile.profile_photo_path = _save_profile_photo(file, profile.profile_photo_path)
    db.commit(); db.refresh(profile); return profile

@router.delete("/me/photo", response_model=schemas.WorkerProfileMeOut)
def delete_my_profile_photo(current_user: models.User = Depends(require_role("worker")), db: Session = Depends(get_db)):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == current_user.id).first()
    if not profile: raise HTTPException(status_code=404, detail="Worker profile not found")
    _remove_old_file(profile.profile_photo_path); profile.profile_photo_path = None
    db.commit(); db.refresh(profile); return profile

@router.get("/{worker_id}/photo")
def get_profile_photo(worker_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile: raise HTTPException(status_code=404, detail="Worker profile not found")
    _require_profile_access(db, current_user, profile)
    return _photo_response(profile.profile_photo_path)


@router.get("/{worker_id}/avatar-initial")
def get_avatar_initial(worker_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Letter shown in the avatar when the worker has no photo. Same access rules as the photo itself."""
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile: raise HTTPException(status_code=404, detail="Worker profile not found")
    _require_profile_access(db, current_user, profile)
    # The letter comes from the account e-mail, so for anyone but the owner/admin it is only
    # derived from it when the worker made her e-mail public; otherwise use her name instead.
    if current_user.role == "admin" or profile.user_id == current_user.id or profile.show_email_publicly:
        return {"initial": _email_initial(profile.user.email if profile.user else None)}
    return {"initial": _email_initial(profile.full_name)}


@router.post("/me/portfolio", response_model=schemas.WorkerProfileMeOut)
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

    contents = file.file.read(MAX_PORTFOLIO_SIZE_BYTES + 1)
    if len(contents) > MAX_PORTFOLIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Portfolio file must be under 5 MB")
    magic, _media = _SIGNATURES[ext]
    if not contents.startswith(magic):
        raise HTTPException(status_code=400, detail="File content does not match its extension")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(contents)

    _remove_old_file(profile.portfolio_file_path)  # single file per profile
    profile.portfolio_file_path = stored_path
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/me/portfolio", response_model=schemas.WorkerProfileMeOut)
def delete_portfolio(
    current_user: models.User = Depends(require_role("worker")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(
        models.WorkerProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No worker profile yet")
    _remove_old_file(profile.portfolio_file_path)
    profile.portfolio_file_path = None
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{worker_id}", response_model=schemas.WorkerProfileOut)
def get_worker(
    worker_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    _require_profile_access(db, current_user, profile)
    out = schemas.WorkerProfileOut.model_validate(profile)
    email = public_worker_email(profile)  # None unless she turned "Show my email publicly" on
    if email is None:
        # Private: the response has no "email" key at all (not even null).
        return JSONResponse(out.model_dump(mode="json", exclude={"email"}))
    out.email = email
    return JSONResponse(out.model_dump(mode="json"))


@router.get("/{worker_id}/portfolio")
def download_portfolio(
    worker_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.id == worker_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Worker profile not found")
    _require_profile_access(db, current_user, profile)

    safe = _safe_portfolio_path(profile.portfolio_file_path)
    if not safe:
        raise HTTPException(status_code=404, detail="No portfolio file on this profile")
    ext = os.path.splitext(safe)[1].lower()
    return FileResponse(safe, media_type=_SIGNATURES.get(ext, (b"", "application/octet-stream"))[1])
