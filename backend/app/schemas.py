"""
Pydantic request/response models.

Input models (`*In`) carry validation/normalisation (PRD Section 21: basic input
validation/sanitisation). Output models deliberately do NOT re-validate stored
values, so legacy rows can never cause a 500 on read.
"""
import re
from datetime import datetime
from typing import Optional, List

from pydantic import AliasChoices, BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator

ALLOWED_WORK_TYPES = ("part-time", "seasonal", "short-term")


def _clean(value: str) -> str:
    """Strip, collapse inner whitespace, drop control characters."""
    if value is None:
        return value
    value = "".join(ch for ch in value if ch == "\n" or ch >= " ")
    return " ".join(value.split()) if "\n" not in value else value.strip()


def _clean_tags(value: str) -> str:
    """Normalise comma-separated tag input: trim, drop empties/duplicates, keep order."""
    seen, out = set(), []
    for raw in (value or "").split(","):
        tag = " ".join(raw.split())
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            out.append(tag)
    return ",".join(out)


_PHONE_RE = re.compile(r"^[0-9+()\-\s]{7,20}$")


def _clean_phone(value):
    """Optional phone number: blank -> None, otherwise digits/+/-/()/spaces, 7-20 chars."""
    if value is None:
        return None
    value = " ".join(str(value).split())
    if not value:
        return None
    if not _PHONE_RE.match(value):
        raise ValueError("Enter a valid phone number (digits, spaces, + - ( ) only, 7-20 characters)")
    return value


# ---------- Auth ----------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(pattern="^(entrepreneur|worker)$")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


# ---------- Account settings / password reset ----------

def _check_new_password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("New password must be at least 8 characters")
    if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("New password must contain at least one letter and one number")
    return v


class ChangeEmailIn(BaseModel):
    new_email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(max_length=128)
    confirm_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong(cls, v: str) -> str:
        return _check_new_password(v)

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        if self.new_password == self.current_password:
            raise ValueError("New password must be different from your current password")
        return self


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(max_length=128)
    confirm_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong(cls, v: str) -> str:
        return _check_new_password(v)

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        return self


class MessageOut(BaseModel):
    message: str


# ---------- Profile enrichment (display/editing only - not used by AI matching) ----------

def _optional_tags(v):
    """Optional tag list: blank -> None, otherwise normalised comma-separated tags."""
    return (_clean_tags(v) or None) if v else None


def _optional_text(v):
    return (_clean(v) or None) if v else None


class CertificationIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    issuer: Optional[str] = Field(default=None, max_length=150)
    year: Optional[int] = Field(default=None, ge=1950, le=2100)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("Certification title cannot be empty")
        return v

    @field_validator("issuer")
    @classmethod
    def _issuer(cls, v):
        return _optional_text(v)


class CertificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    title: str
    issuer: Optional[str] = None
    year: Optional[int] = None


class GalleryItemOut(BaseModel):
    """A gallery entry. `external_url` is set for https sample images; for uploaded files it is
    null and the image is fetched (with the JWT) from .../gallery/{id}/image."""
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    description: Optional[str] = None
    external_url: Optional[str] = None


class GalleryItemUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("title")
    @classmethod
    def _title(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @field_validator("description")
    @classmethod
    def _description(cls, v):
        return _optional_text(v)


# ---------- Entrepreneur profile ----------

class EntrepreneurProfileIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    locality: str = Field(min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)  # optional; shared only with consent
    # Profile-enrichment fields. Omitted -> the stored value is kept (older clients keep working).
    business_intro: Optional[str] = Field(default=None, max_length=3000)
    services_products: Optional[str] = Field(default=None, max_length=500)
    years_in_business: Optional[int] = Field(default=None, ge=0, le=100)
    collaboration_needs: Optional[str] = Field(default=None, max_length=500)
    preferred_work_arrangements: Optional[str] = Field(default=None, max_length=255)

    @field_validator("business_intro")
    @classmethod
    def _intro(cls, v):
        return _optional_text(v)

    @field_validator("services_products", "collaboration_needs", "preferred_work_arrangements")
    @classmethod
    def _tags(cls, v):
        return _optional_tags(v)

    @field_validator("business_name", "locality")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("This field cannot be empty")
        return v

    @field_validator("description")
    @classmethod
    def _strip_description(cls, v):
        return _clean(v) if v else v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return _clean_phone(v)


class EntrepreneurProfileBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    business_name: str
    description: Optional[str] = None
    locality: str
    profile_photo_path: Optional[str] = None
    business_intro: Optional[str] = None
    services_products: Optional[str] = None
    years_in_business: Optional[int] = None
    collaboration_needs: Optional[str] = None
    preferred_work_arrangements: Optional[str] = None
    gallery: List[GalleryItemOut] = []


class EntrepreneurProfileOut(EntrepreneurProfileBase):
    """Public business profile. The account e-mail is always shown here (set by the router);
    the model has no `email` attribute, so it can never appear unless the router fills it in."""
    email: Optional[str] = None


class EntrepreneurProfileMeOut(EntrepreneurProfileBase):
    """Owner-only view: includes the phone number and her own account e-mail (always shown to her).
    Other users never receive these from the profile endpoints."""
    phone: Optional[str] = None
    email: Optional[str] = Field(default=None, validation_alias=AliasChoices("email", "account_email"))


# ---------- Worker profile ----------

class WorkerProfileIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    structured_skills: str = Field(min_length=1, max_length=500)  # e.g. "tailoring,embroidery"
    about_description: str = Field(min_length=1, max_length=5000)
    experience_years: float = Field(default=0, ge=0, le=60)
    locality: str = Field(min_length=1, max_length=255)
    availability: str = Field(min_length=1, max_length=255)  # e.g. "weekdays,mornings"
    work_type: str
    phone: Optional[str] = Field(default=None, max_length=30)  # optional; shared only with consent
    # Opt-in public e-mail. None/omitted = leave the stored choice unchanged (new profiles: OFF).
    show_email_publicly: Optional[bool] = None
    # Profile-enrichment fields. Omitted -> the stored value is kept (older clients keep working).
    services_offered: Optional[str] = Field(default=None, max_length=500)
    languages: Optional[str] = Field(default=None, max_length=255)
    professional_intro: Optional[str] = Field(default=None, max_length=3000)
    certifications: Optional[List[CertificationIn]] = None

    @field_validator("certifications")
    @classmethod
    def _max_certifications(cls, v):
        if v is not None and len(v) > 10:
            raise ValueError("You can list up to 10 certifications")
        return v

    @field_validator("services_offered", "languages")
    @classmethod
    def _tags(cls, v):
        return _optional_tags(v)

    @field_validator("professional_intro")
    @classmethod
    def _intro(cls, v):
        return _optional_text(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return _clean_phone(v)

    @field_validator("full_name", "locality", "about_description")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("This field cannot be empty")
        return v

    @field_validator("structured_skills", "availability")
    @classmethod
    def _tags_required(cls, v: str) -> str:
        v = _clean_tags(v)
        if not v:
            raise ValueError("Enter at least one value (comma-separated)")
        return v

    @field_validator("work_type")
    @classmethod
    def _work_type(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ALLOWED_WORK_TYPES:
            raise ValueError(f"work_type must be one of: {', '.join(ALLOWED_WORK_TYPES)}")
        return v


class WorkerProfileBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    full_name: str
    structured_skills: str
    about_description: str
    experience_years: float
    locality: str
    availability: str
    work_type: str
    portfolio_file_path: Optional[str] = None
    profile_photo_path: Optional[str] = None
    services_offered: Optional[str] = None
    professional_intro: Optional[str] = None
    languages: Optional[str] = None
    certifications: List[CertificationOut] = []
    gallery: List[GalleryItemOut] = []


class WorkerProfileOut(WorkerProfileBase):
    """Public worker profile. `email` is filled by the router ONLY when the worker opted in;
    the model has no `email` attribute, so it stays null otherwise. Never carries the phone."""
    email: Optional[str] = None


class WorkerProfileMeOut(WorkerProfileBase):
    """Owner-only view: includes the phone number and the e-mail visibility choice.
    Other users never receive the phone from the profile endpoints."""
    phone: Optional[str] = None
    show_email_publicly: bool = False
    # Her own account e-mail. The UI shows it on her profile when show_email_publicly is on.
    email: Optional[str] = Field(default=None, validation_alias=AliasChoices("email", "account_email"))


# ---------- Jobs ----------

class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=5000)
    required_skills_text: str = Field(min_length=1, max_length=500)
    experience_required: float = Field(default=0, ge=0, le=60)
    locality: str = Field(min_length=1, max_length=255)
    availability: str = Field(min_length=1, max_length=255)
    work_type: str
    category: Optional[str] = Field(default=None, max_length=100)

    @field_validator("title", "locality", "description")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("This field cannot be empty")
        return v

    @field_validator("required_skills_text", "availability")
    @classmethod
    def _tags_required(cls, v: str) -> str:
        v = _clean_tags(v)
        if not v:
            raise ValueError("Enter at least one value (comma-separated)")
        return v

    @field_validator("work_type")
    @classmethod
    def _work_type(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in ALLOWED_WORK_TYPES:
            raise ValueError(f"work_type must be one of: {', '.join(ALLOWED_WORK_TYPES)}")
        return v

    @field_validator("category")
    @classmethod
    def _category(cls, v):
        v = _clean(v) if v else None
        return v or None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entrepreneur_id: int
    title: str
    description: str
    required_skills_text: str
    experience_required: float
    locality: str
    availability: str
    work_type: str
    category: Optional[str] = None
    status: str
    created_at: datetime


class JobStatusUpdate(BaseModel):
    status: str = Field(pattern="^(open|closed)$")


class AdminJobOut(JobOut):
    business_name: Optional[str] = None


# ---------- Categories ----------

class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = _clean(v).lower()
        if not v:
            raise ValueError("Category name cannot be empty")
        return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


# ---------- Applications ----------

class ApplicationIn(BaseModel):
    job_id: int
    share_contact: bool = False  # worker's consent to share contact details if she is accepted


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    job_id: int
    worker_id: int
    status: str
    applied_at: datetime
    worker_share_contact: bool = False
    entrepreneur_share_contact: bool = False


class ApplicationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(accepted|rejected)$")
    share_contact: bool = False  # entrepreneur's consent to share contact details (used when accepting)


# ---------- Invitations (entrepreneur -> worker) ----------

class InvitationIn(BaseModel):
    job_id: int
    worker_id: int
    share_contact: bool = False  # entrepreneur's consent to share contact details if the worker accepts


class InvitationRespond(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")
    share_contact: bool = False  # worker's consent (used when accepting)


class InvitationOut(BaseModel):
    id: int
    job_id: int
    worker_id: int
    status: str
    created_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    entrepreneur_share_contact: bool = False
    worker_share_contact: bool = False
    # display fields so each side can render the invitation without extra requests
    job_title: str
    job_description: str
    job_locality: str
    job_work_type: str
    entrepreneur_id: int
    business_name: str
    worker_name: str


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: Optional[datetime] = None


class UnreadCount(BaseModel):
    unread: int


# ---------- Connections (accepted applications / invitations) ----------

class ContactDetails(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None


class ConnectionOut(BaseModel):
    source: str                       # "application" | "invitation"
    source_id: int
    job_id: int
    job_title: str
    counterpart_name: str
    counterpart_role: str             # "worker" | "entrepreneur"
    counterpart_profile_id: int       # worker_profiles.id or entrepreneur_profiles.id (for View Profile links)
    connected_at: Optional[datetime] = None
    my_share_contact: bool            # have I agreed to share MY details?
    counterpart_shared: bool          # have THEY agreed to share theirs?
    contact: Optional[ContactDetails] = None  # only present when counterpart_shared is true


class ConsentUpdate(BaseModel):
    share: bool


# ---------- Recommendations ----------

class MatchExplanation(BaseModel):
    semantic_skill_match: str      # Strong / Moderate / Weak
    location: str                  # Same locality / Nearby / Different
    availability: str              # Fully overlapping / Partially overlapping / No overlap
    experience: str                # Meets requirement / Below requirement


class WorkerRecommendation(BaseModel):
    worker_id: int
    full_name: str
    structured_skills: str
    about_description: str
    experience_years: float
    locality: str
    availability: str
    work_type: str
    portfolio_file_path: Optional[str] = None
    final_score: float
    semantic_score: float
    explanation: MatchExplanation


class JobRecommendation(BaseModel):
    job_id: int
    entrepreneur_id: Optional[int] = None  # lets the worker UI link to the business profile
    title: str
    description: str
    required_skills_text: str
    experience_required: float
    locality: str
    availability: str
    work_type: str
    final_score: float
    semantic_score: float
    explanation: MatchExplanation


class ApplicantMatch(BaseModel):
    """'Why this match?' for a worker who applied (may not pass the Step-0 eligibility filter)."""
    worker_id: int
    final_score: float
    semantic_score: float
    eligible: bool
    explanation: MatchExplanation


class BaselineResult(BaseModel):
    """Plain keyword-overlap result, used only for the 'naive vs AI' viva comparison."""
    entity_id: int
    name: str
    skills: str
    locality: str
    keyword_score: float
    matched_keywords: List[str]
