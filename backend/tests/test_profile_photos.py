"""Profile photos: local uploads, external https sample URLs, removal and access rules (workers + entrepreneurs)."""
from app import models
from tests.conftest import WORKER, register_and_login

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
EXTERNAL = "https://i.pravatar.cc/300?img=47"


def _worker(client, email="pw@test.com"):
    h = register_and_login(client, email, "worker")
    me = client.post("/workers/me", json=WORKER, headers=h)
    assert me.status_code == 200, me.text
    return h, me.json()


def _business(client, email="pe@test.com"):
    h = register_and_login(client, email, "entrepreneur")
    me = client.post("/entrepreneurs/me", json={"business_name": "Rose Petal", "locality": "Kochi"}, headers=h)
    assert me.status_code == 200, me.text
    return h, me.json()


def _upload(client, url, headers, content=PNG, name="p.png"):
    return client.post(url, files={"file": (name, content, "image/png")}, headers=headers)


def test_worker_local_photo_upload_serve_and_remove(client):
    h, prof = _worker(client)
    r = _upload(client, "/workers/me/photo", h)
    assert r.status_code == 200 and r.json()["profile_photo_path"]
    got = client.get(f"/workers/{prof['id']}/photo", headers=h)
    assert got.status_code == 200 and got.content == PNG
    r = client.delete("/workers/me/photo", headers=h)
    assert r.status_code == 200 and r.json()["profile_photo_path"] is None
    assert client.get(f"/workers/{prof['id']}/photo", headers=h).status_code == 404


def test_entrepreneur_local_photo_upload_serve_and_remove(client):
    h, prof = _business(client)
    r = _upload(client, "/entrepreneurs/me/photo", h)
    assert r.status_code == 200 and r.json()["profile_photo_path"]
    got = client.get(f"/entrepreneurs/{prof['id']}/photo", headers=h)
    assert got.status_code == 200 and got.content == PNG
    r = client.delete("/entrepreneurs/me/photo", headers=h)
    assert r.status_code == 200 and r.json()["profile_photo_path"] is None
    assert client.get(f"/entrepreneurs/{prof['id']}/photo", headers=h).status_code == 404


def test_photo_upload_validation_and_auth(client):
    h, _ = _business(client)
    assert _upload(client, "/entrepreneurs/me/photo", h, content=b"not an image").status_code == 400
    assert _upload(client, "/entrepreneurs/me/photo", h, name="p.gif").status_code == 400
    assert client.post("/entrepreneurs/me/photo", files={"file": ("p.png", PNG, "image/png")}).status_code == 401
    hw, _ = _worker(client)
    assert _upload(client, "/entrepreneurs/me/photo", hw).status_code == 403


def test_external_url_worker_is_returned_and_served_as_url(client, db):
    h, prof = _worker(client)
    row = db.query(models.WorkerProfile).filter_by(id=prof["id"]).one()
    row.profile_photo_path = EXTERNAL
    db.commit()
    assert client.get("/workers/me", headers=h).json()["profile_photo_path"] == EXTERNAL
    r = client.get(f"/workers/{prof['id']}/photo", headers=h)
    assert r.status_code == 200 and r.json() == {"url": EXTERNAL}


def test_external_url_entrepreneur_is_returned_and_served_as_url(client, db):
    h, prof = _business(client)
    row = db.query(models.EntrepreneurProfile).filter_by(id=prof["id"]).one()
    row.profile_photo_path = EXTERNAL
    db.commit()
    assert client.get("/entrepreneurs/me", headers=h).json()["profile_photo_path"] == EXTERNAL
    r = client.get(f"/entrepreneurs/{prof['id']}/photo", headers=h)
    assert r.status_code == 200 and r.json() == {"url": EXTERNAL}


def test_external_url_can_be_removed_or_replaced_by_upload(client, db):
    h, prof = _worker(client)
    row = db.query(models.WorkerProfile).filter_by(id=prof["id"]).one()
    row.profile_photo_path = EXTERNAL
    db.commit()
    assert _upload(client, "/workers/me/photo", h).json()["profile_photo_path"] != EXTERNAL
    row.profile_photo_path = EXTERNAL
    db.commit()
    assert client.delete("/workers/me/photo", headers=h).json()["profile_photo_path"] is None


def test_non_https_values_are_never_returned_as_urls(client, db):
    h, prof = _worker(client)
    row = db.query(models.WorkerProfile).filter_by(id=prof["id"]).one()
    for bad in ("http://example.com/a.png", "javascript:alert(1)", "../../etc/passwd"):
        row.profile_photo_path = bad
        db.commit()
        assert client.get(f"/workers/{prof['id']}/photo", headers=h).status_code == 404


def test_entrepreneur_photo_respects_business_visibility_rules(client, db):
    _, biz = _business(client)
    row = db.query(models.EntrepreneurProfile).filter_by(id=biz["id"]).one()
    row.profile_photo_path = EXTERNAL
    db.commit()
    hw, _ = _worker(client)  # no open job / application with this business -> hidden, same as the profile
    assert client.get(f"/entrepreneurs/{biz['id']}/photo", headers=hw).status_code == 404
    assert client.get(f"/entrepreneurs/{biz['id']}/photo").status_code == 401


# ---------- avatar initial (first letter of the account email, uppercased) ----------

def test_email_initial_helper():
    from app.routers.workers import _email_initial
    assert _email_initial("meera@gmail.com") == "M"
    assert _email_initial("  rose@x.com") == "R"
    assert _email_initial("") == "U" and _email_initial(None) == "U" and _email_initial("   ") == "U"


def test_worker_avatar_initial_for_self_and_authorised_viewers(client):
    h, prof = _worker(client, "meera@test.com")
    assert client.get(f"/workers/{prof['id']}/avatar-initial", headers=h).json() == {"initial": "M"}
    hw2, _ = _worker(client, "other@test.com")  # another worker may not see this profile (same rule as the photo)
    assert client.get(f"/workers/{prof['id']}/avatar-initial", headers=hw2).status_code == 403
    assert client.get(f"/workers/{prof['id']}/avatar-initial").status_code == 401
    assert client.get("/workers/99999/avatar-initial", headers=h).status_code == 404


def test_entrepreneur_avatar_initial_for_self_and_visibility_rule(client):
    h, biz = _business(client, "rosepetal@test.com")
    assert client.get(f"/entrepreneurs/{biz['id']}/avatar-initial", headers=h).json() == {"initial": "R"}
    hw, _ = _worker(client, "w@test.com")  # no open job / application -> hidden exactly like the profile
    assert client.get(f"/entrepreneurs/{biz['id']}/avatar-initial", headers=hw).status_code == 404
    assert client.get(f"/entrepreneurs/{biz['id']}/avatar-initial").status_code == 401


def test_avatar_initial_endpoint_does_not_change_photo_behaviour(client):
    h, prof = _worker(client, "meera@test.com")
    assert client.get(f"/workers/{prof['id']}/photo", headers=h).status_code == 404  # no photo -> still 404
    assert _upload(client, "/workers/me/photo", h).status_code == 200
    assert client.get(f"/workers/{prof['id']}/photo", headers=h).content == PNG
