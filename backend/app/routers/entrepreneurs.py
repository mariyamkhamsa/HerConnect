"""
FR2: Entrepreneurs can create/edit a business profile.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user, require_role

router = APIRouter(prefix="/entrepreneurs", tags=["entrepreneurs"])


@router.get("/me", response_model=schemas.EntrepreneurProfileOut)
def get_my_profile(
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No business profile yet")
    return profile


@router.post("/me", response_model=schemas.EntrepreneurProfileOut)
def create_or_update_my_profile(
    payload: schemas.EntrepreneurProfileIn,
    current_user: models.User = Depends(require_role("entrepreneur")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.user_id == current_user.id
    ).first()
    if profile:
        profile.business_name = payload.business_name
        profile.description = payload.description
        profile.locality = payload.locality
    else:
        profile = models.EntrepreneurProfile(user_id=current_user.id, **payload.model_dump())
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{entrepreneur_id}", response_model=schemas.EntrepreneurProfileOut)
def get_entrepreneur(entrepreneur_id: int, db: Session = Depends(get_db)):
    profile = db.query(models.EntrepreneurProfile).filter(
        models.EntrepreneurProfile.id == entrepreneur_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Business profile not found")
    return profile
