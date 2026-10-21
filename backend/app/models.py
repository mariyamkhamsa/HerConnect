"""
SQLAlchemy ORM models mirroring schema.sql.
"""
import json

from sqlalchemy import (
    Column, Integer, Float, String, Text, DateTime, ForeignKey, Enum, Boolean,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, expression

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("entrepreneur", "worker", "admin", name="user_role"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    entrepreneur_profile = relationship(
        "EntrepreneurProfile", back_populates="user", uselist=False, cascade="all, delete"
    )
    worker_profile = relationship(
        "WorkerProfile", back_populates="user", uselist=False, cascade="all, delete"
    )


class EntrepreneurProfile(Base):
    __tablename__ = "entrepreneur_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    business_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    locality = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)  # optional; shared only with consent (see connections)
    profile_photo_path = Column(String(500), nullable=True)
    # --- Profile-enrichment fields (display/editing only - never used by the AI matching) ---
    business_intro = Column(Text, nullable=True)
    services_products = Column(String(500), nullable=True)           # comma-separated tags
    years_in_business = Column(Integer, nullable=True)
    collaboration_needs = Column(String(500), nullable=True)         # comma-separated tags (skills / workers sought)
    preferred_work_arrangements = Column(String(255), nullable=True)  # comma-separated tags
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="entrepreneur_profile")
    jobs = relationship("Job", back_populates="entrepreneur", cascade="all, delete")
    gallery_items = relationship(
        "PortfolioItem", back_populates="entrepreneur", cascade="all, delete-orphan",
        order_by="PortfolioItem.sort_order, PortfolioItem.id",
    )

    @property
    def gallery(self):
        return self.gallery_items

    @property
    def account_email(self):
        """Used ONLY by the owner-only EntrepreneurProfileMeOut schema (never the public one)."""
        return self.user.email if self.user is not None else None


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    structured_skills = Column(String(500), nullable=False)
    about_description = Column(Text, nullable=False)
    experience_years = Column(Float, default=0, nullable=False)
    locality = Column(String(255), nullable=False)
    availability = Column(String(255), nullable=False)
    work_type = Column(String(100), nullable=False)
    portfolio_file_path = Column(String(500), nullable=True)
    profile_photo_path = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)  # optional; shared only with consent (see connections)
    # Opt-in: when true the account e-mail is shown on this worker's public profile. Default OFF.
    show_email_publicly = Column(Boolean, default=False, nullable=False, server_default=expression.false())
    embedding = Column(Text, nullable=True)  # JSON-serialized vector
    # --- Profile-enrichment fields (display/editing only - never used by the AI matching) ---
    services_offered = Column(String(500), nullable=True)   # comma-separated tags
    professional_intro = Column(Text, nullable=True)
    languages = Column(String(255), nullable=True)          # comma-separated tags
    certifications_json = Column(Text, nullable=True)       # JSON list of {title, issuer, year}
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="worker_profile")
    applications = relationship("Application", back_populates="worker", cascade="all, delete")
    invitations = relationship("Invitation", back_populates="worker", cascade="all, delete")
    gallery_items = relationship(
        "PortfolioItem", back_populates="worker", cascade="all, delete-orphan",
        order_by="PortfolioItem.sort_order, PortfolioItem.id",
    )

    @property
    def gallery(self):
        return self.gallery_items

    @property
    def certifications(self):
        """Parsed list of certification dicts; a missing/invalid value is simply an empty list."""
        try:
            data = json.loads(self.certifications_json) if self.certifications_json else []
        except (ValueError, TypeError):
            return []
        return [c for c in data if isinstance(c, dict)] if isinstance(data, list) else []

    @certifications.setter
    def certifications(self, value):
        self.certifications_json = json.dumps(value, ensure_ascii=False) if value else None

    @property
    def account_email(self):
        """Used ONLY by the owner-only WorkerProfileMeOut schema (never the public one)."""
        return self.user.email if self.user is not None else None


class PortfolioItem(Base):
    """One gallery entry (image + description) on a worker OR an entrepreneur profile.
    Exactly one of worker_id / entrepreneur_id is set. image_path is either a file saved in
    UPLOAD_DIR or an external https:// URL (used by the demo sample data)."""
    __tablename__ = "portfolio_items"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    entrepreneur_id = Column(Integer, ForeignKey("entrepreneur_profiles.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    image_path = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    worker = relationship("WorkerProfile", back_populates="gallery_items")
    entrepreneur = relationship("EntrepreneurProfile", back_populates="gallery_items")

    @property
    def external_url(self):
        """The https URL when the image is external; None for a locally stored file (served by the API)."""
        v = (self.image_path or "").strip()
        return v if v.lower().startswith("https://") else None


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    entrepreneur_id = Column(Integer, ForeignKey("entrepreneur_profiles.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    required_skills_text = Column(String(500), nullable=False)
    experience_required = Column(Float, default=0, nullable=False)
    locality = Column(String(255), nullable=False)
    availability = Column(String(255), nullable=False)
    work_type = Column(String(100), nullable=False)
    category = Column(String(100), nullable=True)  # optional, display/filter only (admin-managed list)
    status = Column(Enum("open", "closed", name="job_status"), default="open", nullable=False)
    embedding = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    entrepreneur = relationship("EntrepreneurProfile", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete")
    invitations = relationship("Invitation", back_populates="job", cascade="all, delete")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "worker_id", name="uniq_job_worker"),)

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum("pending", "accepted", "rejected", name="application_status"), default="pending", nullable=False)
    applied_at = Column(DateTime, server_default=func.now())
    # Contact-sharing consent, one flag per side. A side can only SEE the other side's
    # contact details once the application is accepted AND the other side's flag is true.
    worker_share_contact = Column(Boolean, default=False, nullable=False, server_default=expression.false())
    entrepreneur_share_contact = Column(Boolean, default=False, nullable=False, server_default=expression.false())

    job = relationship("Job", back_populates="applications")
    worker = relationship("WorkerProfile", back_populates="applications")


class Invitation(Base):
    """Entrepreneur -> worker invitation to a specific job (the mirror image of Application)."""
    __tablename__ = "invitations"
    __table_args__ = (UniqueConstraint("job_id", "worker_id", name="uniq_invitation_job_worker"),)

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum("pending", "accepted", "declined", name="invitation_status"), default="pending", nullable=False)
    entrepreneur_share_contact = Column(Boolean, default=False, nullable=False, server_default=expression.false())
    worker_share_contact = Column(Boolean, default=False, nullable=False, server_default=expression.false())
    created_at = Column(DateTime, server_default=func.now())
    responded_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="invitations")
    worker = relationship("WorkerProfile", back_populates="invitations")


class Notification(Base):
    """Simple in-website notification (no email/push)."""
    __tablename__ = "notifications"
    __table_args__ = (Index("idx_notifications_user_read", "user_id", "is_read"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(50), nullable=False)
    message = Column(String(500), nullable=False)
    link = Column(String(255), nullable=True)  # in-app route to open
    is_read = Column(Boolean, default=False, nullable=False, server_default=expression.false())
    created_at = Column(DateTime, server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)


class PasswordResetToken(Base):
    """Single-use, expiring password-reset token. Only the SHA-256 hash is stored."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
