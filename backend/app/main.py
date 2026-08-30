"""
HerConnect FastAPI application entrypoint.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, workers, entrepreneurs, jobs, applications, recommendations, admin

# Creates any tables that don't exist yet. For a fresh setup, running schema.sql
# directly is recommended (it also seeds default categories), but this keeps
# `uvicorn app.main:app` runnable even if that step was skipped.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HerConnect API",
    description="AI-powered women collaboration platform - backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(entrepreneurs.router)
app.include_router(workers.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(recommendations.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "HerConnect API"}


@app.get("/health")
def health():
    return {"status": "healthy"}
