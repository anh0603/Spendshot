from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_push_subscribe():
    t=client.post("/auth/login", json={"email":"admin@spendshot.local","password":"Admin123!"}).json()["access_token"]
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/push/subscribe", json={"endpoint":"https://ex.com/1","keys":{"p256dh":"x","auth":"y"}}, headers=h)
    assert r.status_code==200
    r=client.post("/push/test", headers=h)
    assert r.status_code==200
    r=client.post("/push/send", json={"title":"Hello"}, headers=h)
    assert r.status_code==200
    r=client.post("/push/unsubscribe", json={"endpoint":"https://ex.com/1"}, headers=h)
    assert r.status_code==200

def test_push_free_cannot_send():
    client.post("/auth/register", json={"email":"push_free_test@gmail.com","password":"123456"})
    t=client.post("/auth/login", json={"email":"push_free_test@gmail.com","password":"123456"}).json()["access_token"]
    r=client.post("/push/send", json={"title":"x"}, headers={"Authorization": f"Bearer {t}"})
    assert r.status_code==403

def test_push_vapid():
    r=client.get("/push/vapid")
    assert r.status_code==200
    assert "public_key" in r.json()
