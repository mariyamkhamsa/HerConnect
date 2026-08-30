"""
Seeds the database with the sample dataset described in the PRD (Section 24):
10-30 sample jobs and worker profiles, used for demo and pipeline validation
only (not training data - SBERT and the Cross-Encoder are pre-trained and used
as-is, with no fine-tuning).

This script uses the SAME embedding functions the live API uses
(app.ai.embeddings.compute_embedding), so the seeded embeddings are genuinely
computed by SBERT, not faked or hardcoded.

Usage (from the backend/ directory, with your virtualenv active and .env set up):
    python seed.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, Base, engine
from app import models
from app.security import hash_password
from app.ai.embeddings import build_worker_text, build_job_text, compute_embedding, serialize_embedding

DEFAULT_PASSWORD = "Password123"  # demo-only credential for every seeded account

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_data")


def load_json(filename):
    with open(os.path.join(SAMPLE_DIR, filename), "r", encoding="utf-8") as f:
        return json.load(f)


def get_or_create_user(db, email, role):
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        return user
    user = models.User(email=email, password_hash=hash_password(DEFAULT_PASSWORD), role=role)
    db.add(user)
    db.flush()
    return user


def seed_workers(db):
    workers_data = load_json("sample_workers.json")
    print(f"Seeding {len(workers_data)} worker profiles...")
    for w in workers_data:
        user = get_or_create_user(db, w["email"], "worker")
        profile = db.query(models.WorkerProfile).filter(models.WorkerProfile.user_id == user.id).first()
        if not profile:
            profile = models.WorkerProfile(
                user_id=user.id,
                full_name=w["full_name"],
                structured_skills=w["structured_skills"],
                about_description=w["about_description"],
                experience_years=w["experience_years"],
                locality=w["locality"],
                availability=w["availability"],
                work_type=w["work_type"],
            )
            db.add(profile)
            db.flush()

        text = build_worker_text(profile.structured_skills, profile.about_description)
        vector = compute_embedding(text)
        profile.embedding = serialize_embedding(vector)
    db.commit()
    print("Worker profiles seeded and embeddings computed.")


def seed_jobs(db):
    jobs_data = load_json("sample_jobs.json")
    print(f"Seeding {len(jobs_data)} jobs...")
    for j in jobs_data:
        user = get_or_create_user(db, j["entrepreneur_email"], "entrepreneur")
        entrepreneur = db.query(models.EntrepreneurProfile).filter(
            models.EntrepreneurProfile.user_id == user.id
        ).first()
        if not entrepreneur:
            entrepreneur = models.EntrepreneurProfile(
                user_id=user.id,
                business_name=j["entrepreneur_business_name"],
                description=f"{j['entrepreneur_business_name']} - a small local business.",
                locality=j["entrepreneur_locality"],
            )
            db.add(entrepreneur)
            db.flush()

        existing_job = db.query(models.Job).filter(
            models.Job.entrepreneur_id == entrepreneur.id,
            models.Job.title == j["title"],
        ).first()
        if not existing_job:
            existing_job = models.Job(
                entrepreneur_id=entrepreneur.id,
                title=j["title"],
                description=j["description"],
                required_skills_text=j["required_skills_text"],
                experience_required=j["experience_required"],
                locality=j["locality"],
                availability=j["availability"],
                work_type=j["work_type"],
            )
            db.add(existing_job)
            db.flush()

        text = build_job_text(existing_job.title, existing_job.description, existing_job.required_skills_text)
        vector = compute_embedding(text)
        existing_job.embedding = serialize_embedding(vector)
    db.commit()
    print("Jobs seeded and embeddings computed.")


def seed_categories(db):
    default_categories = ["tailoring", "cooking", "tutoring", "crafts", "beauty & personal care", "baking", "catering"]
    for name in default_categories:
        exists = db.query(models.Category).filter(models.Category.name == name).first()
        if not exists:
            db.add(models.Category(name=name))
    db.commit()


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_categories(db)
        seed_workers(db)
        seed_jobs(db)
        print("\nDone. All seeded accounts use the password:", DEFAULT_PASSWORD)
    finally:
        db.close()


if __name__ == "__main__":
    main()
