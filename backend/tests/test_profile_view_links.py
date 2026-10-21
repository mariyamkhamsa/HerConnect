"""
Tests for the data + access rules behind the three "View ... Profile" buttons:

  1. Browse All Open Jobs          -> worker opens /worker/businesses/:entrepreneurId
  2. Your Applications             -> worker opens /worker/businesses/:entrepreneurId
  3. Applications Received         -> entrepreneur opens /entrepreneur/workers/:workerId

The buttons themselves are frontend code; these tests verify that the API fields
they read (`entrepreneur_id` on jobs, `worker_id` on applications) exist and that
the existing privacy rules allow exactly the intended navigation - and nothing more.
"""
from tests.conftest import JOB, WORKER, register_and_login

def _entrepreneur_with_job(client, email="boss@test.com", business="Rose Petal Boutique"):
    headers = register_and_login(client, email, "entrepreneur")
    r = client.post(
        "/entrepreneurs/me",
        json={"business_name": business, "description": "Bridal wear", "locality": "Kochi"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    entrepreneur_id = r.json()["id"]
    r = client.post("/jobs", json=JOB, headers=headers)
    assert r.status_code == 201, r.text
    return headers, entrepreneur_id, r.json()["id"]


def _worker(client, email="meera@test.com", **overrides):
    headers = register_and_login(client, email, "worker")
    r = client.post("/workers/me", json={**WORKER, **overrides}, headers=headers)
    assert r.status_code == 200, r.text
    return headers, r.json()["id"]


# ------------------------------------------------ 1. Browse All Open Jobs

def test_browse_jobs_include_entrepreneur_id(client):
    _, entrepreneur_id, job_id = _entrepreneur_with_job(client)
    worker_headers, _ = _worker(client)

    jobs = client.get("/jobs", headers=worker_headers).json()
    assert [j["id"] for j in jobs] == [job_id]
    assert jobs[0]["entrepreneur_id"] == entrepreneur_id


def test_worker_can_open_business_profile_of_every_browsable_job(client):
    _, entrepreneur_id, _ = _entrepreneur_with_job(client)
    worker_headers, _ = _worker(client)

    for job in client.get("/jobs", headers=worker_headers).json():
        r = client.get(f"/entrepreneurs/{job['entrepreneur_id']}", headers=worker_headers)
        assert r.status_code == 200, r.text
        assert r.json()["id"] == entrepreneur_id
        assert r.json()["business_name"] == "Rose Petal Boutique"


# ------------------------------------------------ 2. Your Applications

def test_single_job_endpoint_includes_entrepreneur_id(client):
    """'Your Applications' loads each job via GET /jobs/{id}."""
    _, entrepreneur_id, job_id = _entrepreneur_with_job(client)
    worker_headers, _ = _worker(client)

    r = client.get(f"/jobs/{job_id}", headers=worker_headers)
    assert r.status_code == 200
    assert r.json()["entrepreneur_id"] == entrepreneur_id


def test_applied_business_profile_still_viewable_after_job_closed(client):
    owner_headers, entrepreneur_id, job_id = _entrepreneur_with_job(client)
    worker_headers, _ = _worker(client)
    assert client.post("/applications", json={"job_id": job_id}, headers=worker_headers).status_code == 201

    r = client.put(f"/jobs/{job_id}/status", json={"status": "closed"}, headers=owner_headers)
    assert r.status_code == 200, r.text

    r = client.get(f"/entrepreneurs/{entrepreneur_id}", headers=worker_headers)
    assert r.status_code == 200, r.text


def test_non_applicant_cannot_view_business_with_no_open_jobs(client):
    owner_headers, entrepreneur_id, job_id = _entrepreneur_with_job(client)
    applicant_headers, _ = _worker(client, "applicant@test.com")
    other_headers, _ = _worker(client, "other@test.com")
    client.post("/applications", json={"job_id": job_id}, headers=applicant_headers)
    client.put(f"/jobs/{job_id}/status", json={"status": "closed"}, headers=owner_headers)

    assert client.get(f"/entrepreneurs/{entrepreneur_id}", headers=applicant_headers).status_code == 200
    assert client.get(f"/entrepreneurs/{entrepreneur_id}", headers=other_headers).status_code == 404


# ------------------------------------------------ 3. Applications Received

def test_received_applications_expose_worker_id_and_worker_profile_opens(client):
    owner_headers, _, job_id = _entrepreneur_with_job(client)
    worker_headers, worker_id = _worker(client)
    assert client.post("/applications", json={"job_id": job_id}, headers=worker_headers).status_code == 201

    apps = client.get(f"/applications?job_id={job_id}", headers=owner_headers).json()
    assert len(apps) == 1
    assert apps[0]["worker_id"] == worker_id

    r = client.get(f"/workers/{apps[0]['worker_id']}", headers=owner_headers)
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == WORKER["full_name"]


def test_applicant_profile_viewable_even_if_not_a_structural_match(client):
    """An applicant chose to apply, so she must stay viewable even if she would
    not appear in the AI recommendations (different locality / work type)."""
    owner_headers, _, job_id = _entrepreneur_with_job(client)
    worker_headers, worker_id = _worker(
        client, "far@test.com", locality="Thrissur", work_type="seasonal", availability="weekends"
    )
    assert client.post("/applications", json={"job_id": job_id}, headers=worker_headers).status_code == 201

    r = client.get(f"/workers/{worker_id}", headers=owner_headers)
    assert r.status_code == 200, r.text


def test_unrelated_entrepreneur_cannot_view_applicant_profile(client):
    _, _, job_id = _entrepreneur_with_job(client)
    worker_headers, worker_id = _worker(client)
    client.post("/applications", json={"job_id": job_id}, headers=worker_headers)

    # A second entrepreneur with no jobs and no applications from this worker.
    stranger = register_and_login(client, "stranger@test.com", "entrepreneur")
    client.post(
        "/entrepreneurs/me",
        json={"business_name": "Other Biz", "locality": "Kochi"},
        headers=stranger,
    )
    assert client.get(f"/workers/{worker_id}", headers=stranger).status_code == 404


def test_deactivated_applicant_profile_is_not_viewable(client, db):
    from app import models

    owner_headers, _, job_id = _entrepreneur_with_job(client)
    worker_headers, worker_id = _worker(client)
    client.post("/applications", json={"job_id": job_id}, headers=worker_headers)

    user = db.query(models.User).filter(models.User.email == "meera@test.com").first()
    user.is_active = False
    db.commit()

    assert client.get(f"/workers/{worker_id}", headers=owner_headers).status_code == 404


def test_worker_cannot_view_another_workers_profile(client):
    _, first_id = _worker(client, "first@test.com")
    second_headers, _ = _worker(client, "second@test.com")
    assert client.get(f"/workers/{first_id}", headers=second_headers).status_code == 403
