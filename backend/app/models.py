"""
SQLAlchemy ORM models mirroring schema.sql.
"""
from sqlalchemy import (
    Column, Integer, Float, String, Text, DateTime, ForeignKey, Enum, Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

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
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="entrepreneur_profile")
    jobs = relationship("Job", back_populates="entrepreneur", cascade="all, delete")


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
    embedding = Column(Text, nullable=True)  # JSON-serialized vector
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="worker_profile")
    applications = relationship("Application", back_populates="worker", cascade="all, delete")


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
    status = Column(Enum("open", "closed", name="job_status"), default="open", nullable=False)
    embedding = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    entrepreneur = relationship("EntrepreneurProfile", back_populates="jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "worker_id", name="uniq_job_worker"),)

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum("pending", "accepted", "rejected", name="application_status"), default="pending", nullable=False)
    applied_at = Column(DateTime, server_default=func.now())

    job = relationship("Job", back_populates="applications")
    worker = relationship("WorkerProfile", back_populates="applications")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
