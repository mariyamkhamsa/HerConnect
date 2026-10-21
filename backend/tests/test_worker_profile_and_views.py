"""
Tests for:
  1. worker profile saving (all fields persisted, embedding stored, portfolio untouched)
  2. portfolio upload/delete still behaving as before
  3. "View Profile" access rules (entrepreneur -> worker, worker -> business)

Self-contained: uses an in-memory SQLite DB and a tiny FastAPI app that mounts only the
workers + entrepreneurs routers. The SBERT model is NOT loaded - compute_embedding is
replaced by a fake inside the workers router. Authentication is replaced by a header
(`X-Test-User: <user id>`) via dependency_overrides[get_current_user], which assumes
app.deps.require_role() is built on top of get_current_user.

Eligibility fixtures use "all four structured factors match" vs "none match" so the
tests do not depend on the exact tuning of app.ai.pipeline.

ADJUST IF NEEDED: the router import path on the next lines.
"""
from typing import Optional

import pytest
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models, schemas
from app.config import settings
from app.database import Base, get_db
from app.deps import get_current_user
from app.routers import entrepreneurs as entrepreneurs_router  # <-- adjust path if different
from app.routers import workers as workers_router              # <-- adjust path if different

PDF_BYTES = b"%PDF-1.4\n% test portfolio\n"


# ------------------------------------------------------------------ fixtures

@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, autocommit=False)
    engine.dispose()


@pytest.fixture()
def db(session_factory):
    session = session_factory()
    yield session
    session.close()


@pytest.fixture()
def embedding_calls():
    return []


@pytest.fixture()
def client(session_factory, monkeypatch, tmp_path, embedding_calls):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))

    def fake_embedding(text):
        embedding_calls.append(text)
        return [0.1, 0.2, 0.3]

    monkeypatch.setattr(workers_router, "compute_embedding", fake_embedding)

    app = FastAPI()
    app.include_router(workers_router.router)
    app.include_router(entrepreneurs_router.router)

    def _get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    def _current_user(x_test_user: Optional[str] = Header(default=None), session: Session = Depends(get_db)):
        if x_test_user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        user = session.query(models.User).filter(models.User.id == int(x_test_user)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_current_user] = _current_user
    return TestClient(app)


def as_user(user):
    return {"X-Test-User": str(user.id)}


# ------------------------------------------------------------------ builders

def make_user(db, email, role, active=True):
    user = models.User(email=email, password_hash="x", role=role, is_active=active)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_entrepreneur(db, email, active=True, business="Rose Tailors", locality="Kochi"):
    user = make_user(db, email, "entrepreneur", active)
    profile = models.EntrepreneurProfile(
        user_id=user.id, business_name=business, description="Custom stitching", locality=locality
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return user, profile


MATCHING = dict(locality="Kochi", availability="weekdays", work_type="part-time")
NON_MATCHING = dict(locality="Delhi", availability="weekends", work_type="seasonal")


def make_worker(db, email, name, active=True, matching=True, experience=3.0):
    user = make_user(db, email, "worker", active)
    factors = MATCHING if matching else NON_MATCHING
    profile = models.WorkerProfile(
        user_id=user.id, full_name=name, structured_skills="tailoring,embroidery",
        about_description="I stitch bridal blouses.", experience_years=experience, **factors,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return user, profile


def make_job(db, entrepreneur_profile, status="open", **overrides):
    fields = dict(
        title="Blouse stitcher", description="Stitch blouses", required_skills_text="tailoring",
        experience_required=1.0, status=status, **MATCHING,
    )
    fields.update(overrides)
    job = models.Job(entrepreneur_id=entrepreneur_profile.id, **fields)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def apply_to(db, job, worker_profile):
    db.add(models.Application(job_id=job.id, worker_id=worker_profile.id))
    db.commit()


@pytest.fixture()
def world(db):
    """
    ent_a  : job_a (open, Kochi/weekdays/part-time)
    ent_b  : only a CLOSED job (job_b); ent_c: inactive account with an open job
    w_elig : matches job_a on all structured factors, has NOT applied
    w_appl : matches nothing, but APPLIED to job_a
    w_str  : matches nothing, no applications (stranger)
    w_off  : matches job_a but account deactivated (also applied)
    """
    w = {}
    w["ent_a"], w["ent_a_p"] = make_entrepreneur(db, "a@x.com", business="A Tailors")
    w["ent_b"], w["ent_b_p"] = make_entrepreneur(db, "b@x.com", business="B Bakes")
    w["ent_c"], w["ent_c_p"] = make_entrepreneur(db, "c@x.com", active=False, business="C Crafts")
    w["job_a"] = make_job(db, w["ent_a_p"])
    w["job_b"] = make_job(db, w["ent_b_p"], status="closed")
    w["job_c"] = make_job(db, w["ent_c_p"])
    w["w_elig"], w["w_elig_p"] = make_worker(db, "elig@x.com", "Eligible Elena", matching=True)
    w["w_appl"], w["w_appl_p"] = make_worker(db, "appl@x.com", "Applicant Asha", matching=False)
    w["w_str"], w["w_str_p"] = make_worker(db, "str@x.com", "Stranger Sita", matching=False)
    w["w_off"], w["w_off_p"] = make_worker(db, "off@x.com", "Inactive Indu", active=False, matching=True)
    w["admin"] = make_user(db, "admin@x.com", "admin")
    apply_to(db, w["job_a"], w["w_appl_p"])
    apply_to(db, w["job_a"], w["w_off_p"])
    apply_to(db, w["job_b"], w["w_appl_p"])  # w_appl also applied to ent_b's closed job
    return w


# ================================================== 1. saving a worker profile

PROFILE = {
    "full_name": "  Meera   Nair ",
    "structured_skills": "tailoring, embroidery ,, Tailoring",
    "about_description": "Ten years of bridal   wear.",
    "experience_years": 4.5,
    "locality": "Kochi",
    "availability": "weekdays, mornings",
    "work_type": "Seasonal",
}


def test_create_profile_persists_every_field_and_stores_embedding(client, db, embedding_calls):
    user = make_user(db, "new@x.com", "worker")
    res = client.post("/workers/me", json=PROFILE, headers=as_user(user))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["full_name"] == "Meera Nair"
    assert body["structured_skills"] == "tailoring,embroidery"  # trimmed, de-duplicated
    assert body["availability"] == "weekdays,mornings"
    assert body["work_type"] == "seasonal"
    assert body["experience_years"] == 4.5

    db.expire_all()
    row = db.query(models.WorkerProfile).filter_by(user_id=user.id).one()
    assert (row.full_name, row.locality, row.experience_years) == ("Meera Nair", "Kochi", 4.5)
    assert row.about_description == "Ten years of bridal wear."
    assert row.embedding  # precomputed embedding stored (pipeline contract unchanged)
    assert len(embedding_calls) == 1


def test_resaving_updates_same_row_and_regenerates_embedding(client, db, embedding_calls):
    user = make_user(db, "upd@x.com", "worker")
    client.post("/workers/me", json=PROFILE, headers=as_user(user))
    changed = dict(PROFILE, full_name="Meera N", locality="Aluva", experience_years=6)
    res = client.post("/workers/me", json=changed, headers=as_user(user))
    assert res.status_code == 200
    db.expire_all()
    rows = db.query(models.WorkerProfile).filter_by(user_id=user.id).all()
    assert len(rows) == 1
    assert (rows[0].full_name, rows[0].locality, rows[0].experience_years) == ("Meera N", "Aluva", 6)
    assert len(embedding_calls) == 2


def test_form_payload_with_extra_fields_cannot_touch_portfolio_or_ids(client, db):
    """The React form used to send back id/user_id/portfolio_file_path from GET /workers/me."""
    user = make_user(db, "extra@x.com", "worker")
    client.post("/workers/me", json=PROFILE, headers=as_user(user))
    up = client.post(
        "/workers/me/portfolio", headers=as_user(user),
        files={"file": ("cert.pdf", PDF_BYTES, "application/pdf")},
    )
    assert up.status_code == 200
    stored_path = up.json()["portfolio_file_path"]
    assert stored_path

    hostile = dict(PROFILE, id=9999, user_id=9999, portfolio_file_path=None)
    res = client.post("/workers/me", json=hostile, headers=as_user(user))
    assert res.status_code == 200
    assert res.json()["portfolio_file_path"] == stored_path
    assert res.json()["id"] != 9999 and res.json()["user_id"] == user.id


def test_invalid_payload_gives_422_with_list_detail(client, db):
    """Documents the contract the frontend must handle: 422 'detail' is a LIST of objects."""
    user = make_user(db, "bad@x.com", "worker")
    res = client.post("/workers/me", json=dict(PROFILE, structured_skills=" , ,"), headers=as_user(user))
    assert res.status_code == 422
    assert isinstance(res.json()["detail"], list)
    assert db.query(models.WorkerProfile).filter_by(user_id=user.id).count() == 0

    res = client.post("/workers/me", json=dict(PROFILE, work_type="weekly"), headers=as_user(user))
    assert res.status_code == 422
    res = client.post("/workers/me", json=dict(PROFILE, experience_years=61), headers=as_user(user))
    assert res.status_code == 422


def test_save_requires_worker_login(client, db):
    assert client.post("/workers/me", json=PROFILE).status_code == 401
    ent, _ = make_entrepreneur(db, "e@x.com")
    assert client.post("/workers/me", json=PROFILE, headers=as_user(ent)).status_code in (401, 403)


# ============================================================ 2. portfolio

def test_portfolio_upload_replace_delete_and_validation(client, db):
    user = make_user(db, "pf@x.com", "worker")
    h = as_user(user)
    # needs a profile first
    r = client.post("/workers/me/portfolio", headers=h, files={"file": ("a.pdf", PDF_BYTES, "application/pdf")})
    assert r.status_code == 404
    client.post("/workers/me", json=PROFILE, headers=h)

    bad_ext = client.post("/workers/me/portfolio", headers=h, files={"file": ("a.exe", PDF_BYTES, "application/pdf")})
    assert bad_ext.status_code == 400
    bad_magic = client.post("/workers/me/portfolio", headers=h, files={"file": ("a.pdf", b"not a pdf", "application/pdf")})
    assert bad_magic.status_code == 400
    too_big = client.post("/workers/me/portfolio", headers=h, files={"file": ("a.pdf", PDF_BYTES + b"0" * (5 * 1024 * 1024), "application/pdf")})
    assert too_big.status_code == 400

    first = client.post("/workers/me/portfolio", headers=h, files={"file": ("a.pdf", PDF_BYTES, "application/pdf")})
    first_path = first.json()["portfolio_file_path"]
    second = client.post("/workers/me/portfolio", headers=h, files={"file": ("b.pdf", PDF_BYTES, "application/pdf")})
    second_path = second.json()["portfolio_file_path"]
    assert first_path != second_path
    import os
    assert not os.path.exists(first_path) and os.path.exists(second_path)  # single file per profile

    gone = client.delete("/workers/me/portfolio", headers=h)
    assert gone.status_code == 200 and gone.json()["portfolio_file_path"] is None
    assert not os.path.exists(second_path)


# ================================== 3a. entrepreneur -> worker profile access

def test_worker_can_view_own_profile_but_not_others(client, world):
    me = client.get(f"/workers/{world['w_elig_p'].id}", headers=as_user(world["w_elig"]))
    assert me.status_code == 200
    other = client.get(f"/workers/{world['w_str_p'].id}", headers=as_user(world["w_elig"]))
    assert other.status_code == 403


def test_entrepreneur_can_view_applicant_even_if_not_structurally_eligible(client, world):
    res = client.get(f"/workers/{world['w_appl_p'].id}", headers=as_user(world["ent_a"]))
    assert res.status_code == 200
    assert res.json()["full_name"] == "Applicant Asha"


def test_entrepreneur_can_view_recommendable_worker_who_has_not_applied(client, world):
    res = client.get(f"/workers/{world['w_elig_p'].id}", headers=as_user(world["ent_a"]))
    assert res.status_code == 200
    assert res.json()["structured_skills"] == "tailoring,embroidery"
    assert "email" not in res.json() and "password_hash" not in res.json()


def test_entrepreneur_cannot_view_unrelated_worker(client, world):
    res = client.get(f"/workers/{world['w_str_p'].id}", headers=as_user(world["ent_a"]))
    assert res.status_code == 404


def test_entrepreneur_without_relationship_cannot_view_applicant_of_someone_else(client, world):
    # ent_b has only a closed job in Kochi/weekdays/part-time; w_elig is eligible for it,
    # but w_str is neither eligible nor an applicant of ent_b.
    assert client.get(f"/workers/{world['w_str_p'].id}", headers=as_user(world["ent_b"])).status_code == 404


def test_entrepreneur_cannot_view_deactivated_worker_even_if_applied(client, world):
    res = client.get(f"/workers/{world['w_off_p'].id}", headers=as_user(world["ent_a"]))
    assert res.status_code == 404


def test_admin_can_view_any_worker(client, world):
    for key in ("w_elig_p", "w_str_p", "w_off_p"):
        assert client.get(f"/workers/{world[key].id}", headers=as_user(world["admin"])).status_code == 200


def test_worker_profile_requires_authentication(client, world):
    assert client.get(f"/workers/{world['w_elig_p'].id}").status_code == 401


def test_unknown_worker_is_404(client, world):
    assert client.get("/workers/99999", headers=as_user(world["ent_a"])).status_code == 404


def test_portfolio_download_follows_same_access_rules(client, world, db):
    owner_headers = as_user(world["w_elig"])
    up = client.post("/workers/me/portfolio", headers=owner_headers,
                     files={"file": ("cert.pdf", PDF_BYTES, "application/pdf")})
    assert up.status_code == 200
    wid = world["w_elig_p"].id

    assert client.get(f"/workers/{wid}/portfolio", headers=owner_headers).status_code == 200
    ok = client.get(f"/workers/{wid}/portfolio", headers=as_user(world["ent_a"]))
    assert ok.status_code == 200 and ok.headers["content-type"] == "application/pdf"
    assert client.get(f"/workers/{wid}/portfolio", headers=as_user(world["admin"])).status_code == 200
    # ent_b: closed job only -> w_elig is still "eligible" for that job, so make a clean outsider
    outsider, _ = make_entrepreneur(db, "out@x.com", locality="Mumbai", business="Far Away")
    make_job(db, db.query(models.EntrepreneurProfile).filter_by(user_id=outsider.id).one(), **NON_MATCHING)
    assert client.get(f"/workers/{wid}/portfolio", headers=as_user(outsider)).status_code == 404
    assert client.get(f"/workers/{wid}/portfolio", headers=as_user(world["w_str"])).status_code == 403
    assert client.get(f"/workers/{wid}/portfolio").status_code == 401


# =================================== 3b. worker -> business profile access

def test_worker_can_view_business_with_open_job(client, world):
    res = client.get(f"/entrepreneurs/{world['ent_a_p'].id}", headers=as_user(world["w_str"]))
    assert res.status_code == 200
    assert res.json()["business_name"] == "A Tailors"


def test_worker_cannot_view_business_without_open_job_or_application(client, world):
    res = client.get(f"/entrepreneurs/{world['ent_b_p'].id}", headers=as_user(world["w_str"]))
    assert res.status_code == 404


def test_worker_can_view_business_she_applied_to_even_if_job_closed(client, world):
    res = client.get(f"/entrepreneurs/{world['ent_b_p'].id}", headers=as_user(world["w_appl"]))
    assert res.status_code == 200


def test_worker_cannot_view_deactivated_business(client, world):
    res = client.get(f"/entrepreneurs/{world['ent_c_p'].id}", headers=as_user(world["w_str"]))
    assert res.status_code == 404


def test_entrepreneur_and_admin_business_access_unchanged(client, world):
    own = client.get(f"/entrepreneurs/{world['ent_b_p'].id}", headers=as_user(world["ent_b"]))
    assert own.status_code == 200
    assert client.get(f"/entrepreneurs/{world['ent_c_p'].id}", headers=as_user(world["admin"])).status_code == 200
    assert client.get(f"/entrepreneurs/{world['ent_a_p'].id}", headers=as_user(world["ent_b"])).status_code == 200


def test_business_profile_requires_authentication_and_404_for_unknown(client, world):
    assert client.get(f"/entrepreneurs/{world['ent_a_p'].id}").status_code == 401
    assert client.get("/entrepreneurs/99999", headers=as_user(world["w_str"])).status_code == 404


def test_entrepreneur_profile_create_and_update_still_work(client, db):
    user = make_user(db, "newent@x.com", "entrepreneur")
    h = as_user(user)
    created = client.post("/entrepreneurs/me", json={"business_name": "Spice Box", "locality": "Kochi"}, headers=h)
    assert created.status_code == 200
    updated = client.post("/entrepreneurs/me", json={"business_name": "Spice Box 2", "description": "Catering", "locality": "Aluva"}, headers=h)
    assert updated.json()["business_name"] == "Spice Box 2"
    assert client.get("/entrepreneurs/me", headers=h).json()["locality"] == "Aluva"
    assert db.query(models.EntrepreneurProfile).filter_by(user_id=user.id).count() == 1


# ======================================================== schema (additive)

def test_job_recommendation_schema_accepts_entrepreneur_id_and_stays_backward_compatible():
    base = dict(
        job_id=1, title="t", description="d", required_skills_text="s", experience_required=0.0,
        locality="Kochi", availability="weekdays", work_type="part-time", final_score=0.5,
        semantic_score=0.5,
        explanation=schemas.MatchExplanation(
            semantic_skill_match="Strong", location="Same locality",
            availability="Fully overlapping", experience="Meets requirement"),
    )
    assert schemas.JobRecommendation(**base).entrepreneur_id is None
    assert schemas.JobRecommendation(entrepreneur_id=7, **base).entrepreneur_id == 7
