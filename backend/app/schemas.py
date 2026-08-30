"""
Pydantic request/response models.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ---------- Auth ----------

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
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


# ---------- Entrepreneur profile ----------

class EntrepreneurProfileIn(BaseModel):
    business_name: str
    description: Optional[str] = None
    locality: str


class EntrepreneurProfileOut(EntrepreneurProfileIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int


# ---------- Worker profile ----------

class WorkerProfileIn(BaseModel):
    full_name: str
    structured_skills: str  # comma-separated tags e.g. "tailoring,embroidery"
    about_description: str
    experience_years: float = 0
    locality: str
    availability: str  # comma-separated tags e.g. "weekdays,mornings"
    work_type: str


class WorkerProfileOut(WorkerProfileIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    portfolio_file_path: Optional[str] = None


# ---------- Jobs ----------

class JobIn(BaseModel):
    title: str
    description: str
    required_skills_text: str
    experience_required: float = 0
    locality: str
    availability: str
    work_type: str


class JobOut(JobIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entrepreneur_id: int
    status: str
    created_at: datetime


# ---------- Applications ----------

class ApplicationIn(BaseModel):
    job_id: int


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    job_id: int
    worker_id: int
    status: str
    applied_at: datetime


class ApplicationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(accepted|rejected)$")


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
