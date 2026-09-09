from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.jar import Jar
from app.models.jar_transaction import JarTransaction
import uuid

client = TestClient(app)

def get_token(email="jar_test@gmail.com"):
    client.post("/auth/register", json={"email": email, "password":"123456"})
    r = client.post("/auth/login", json={"email": email, "password":"123456"})
    return r.json()["access_token"], email

def test_create_jar():
    token,_ = get_token("jar_create@gmail.com")
    h = {"Authorization": f"Bearer {token}"}
    # cleanup
    db=SessionLocal()
    db.query(JarTransaction).delete()
    db.query(Jar).delete()
    db.commit(); db.close()
    r = client.post("/jars", json={"budget":2000000,"month":"2026-10"}, headers=h)
    assert r.status_code==201
    assert r.json()["budget"]==2000000
    assert r.json()["remaining"]==2000000
    assert r.json()["month"]=="2026-10"
    # duplicate month
    r2 = client.post("/jars", json={"budget":1000000,"month":"2026-10"}, headers=h)
    assert r2.status_code==400

def test_add_withdraw():
    token,_ = get_token("jar_add@gmail.com")
    h = {"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r = client.post("/jars", json={"budget":2000000,"month":"2026-11"}, headers=h)
    jid=r.json()["id"]
    r = client.post(f"/jars/{jid}/add", json={"amount":500000}, headers=h)
    assert r.json()["budget"]==2500000
    r = client.post(f"/jars/{jid}/withdraw", json={"amount":300000}, headers=h)
    assert r.json()["budget"]==2200000
    # invalid amount
    r = client.post(f"/jars/{jid}/add", json={"amount":0}, headers=h)
    assert r.status_code==400

def test_negative_balance():
    token,_ = get_token("jar_neg@gmail.com")
    h = {"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r = client.post("/jars", json={"budget":2000000,"month":"2026-12"}, headers=h)
    jid=r.json()["id"]
    # withdraw more than budget => negative remaining allowed
    r = client.post(f"/jars/{jid}/withdraw", json={"amount":2500000}, headers=h)
    assert r.json()["remaining"]==-500000
    assert r.json()["budget"]==-500000  # budget reduced, spent still 0, so remaining negative
    # Now test with spent scenario: create expense later will increase spent

def test_idor():
    token1,_ = get_token("jar_idor1@gmail.com")
    token2,_ = get_token("jar_idor2@gmail.com")
    h1 = {"Authorization": f"Bearer {token1}"}
    h2 = {"Authorization": f"Bearer {token2}"}
    db=SessionLocal(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r = client.post("/jars", json={"budget":1000000,"month":"2027-01"}, headers=h1)
    jid=r.json()["id"]
    r = client.get(f"/jars/{jid}", headers=h2)
    assert r.status_code==404
    r = client.post(f"/jars/{jid}/add", json={"amount":100000}, headers=h2)
    assert r.status_code==404
    r = client.get(f"/jars/{jid}/history", headers=h2)
    assert r.status_code==404

def test_delete_jar():
    token,_ = get_token("jar_del@gmail.com")
    h = {"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r = client.post("/jars", json={"budget":1000000,"month":"2027-03"}, headers=h)
    jid=r.json()["id"]
    client.post("/expenses", data={"jar_id": jid, "amount":"50000"}, headers={"Authorization": f"Bearer {token}"})
    r = client.delete(f"/jars/{jid}", headers=h)
    assert r.status_code==200
    assert r.json()["deleted_expenses"]==1
    r = client.get(f"/jars/{jid}", headers=h)
    assert r.status_code==404
    # IDOR: user khác không xóa được
    r = client.post("/jars", json={"budget":1000000,"month":"2027-04"}, headers=h)
    jid2=r.json()["id"]
    token2,_ = get_token("jar_del2@gmail.com")
    r = client.delete(f"/jars/{jid2}", headers={"Authorization": f"Bearer {token2}"})
    assert r.status_code==404

def test_history_and_update():
    token,_ = get_token("jar_hist@gmail.com")
    h = {"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r = client.post("/jars", json={"budget":1000000,"month":"2027-02"}, headers=h)
    jid=r.json()["id"]
    client.post(f"/jars/{jid}/add", json={"amount":100000}, headers=h)
    client.patch(f"/jars/{jid}", json={"budget": 1500000}, headers=h)
    r = client.get(f"/jars/{jid}/history", headers=h)
    assert len(r.json())>=3
    r = client.patch(f"/jars/{jid}", json={"name":"Hũ mới"}, headers=h)
    assert r.status_code==200
