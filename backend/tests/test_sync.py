from fastapi.testclient import TestClient
from app.main import app
import uuid, io
from PIL import Image

client = TestClient(app)

def get_user(email=None):
    if not email: email=f"sync_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password":"123456"})
    r=client.post("/auth/login", json={"email": email, "password":"123456"})
    return r.json()["access_token"]

def test_push_pull():
    t=get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":2000000,"month":f"2030-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    eid=str(uuid.uuid4()); key=str(uuid.uuid4())
    r=client.post("/sync/push", json={"expenses":[{"id":eid,"jar_id":jid,"amount":99999,"idempotency_key":key}]}, headers=h)
    assert r.json()["expenses"][0]["status"]=="SYNCED"
    # duplicate
    r=client.post("/sync/push", json={"expenses":[{"id":str(uuid.uuid4()),"jar_id":jid,"amount":99999,"idempotency_key":key}]}, headers=h)
    assert r.json()["expenses"][0].get("duplicate")==True
    # pull should have it
    r=client.get("/sync/pull", headers=h)
    assert any(e["id"]==eid for e in r.json()["expenses"])
    # status
    r=client.get("/sync/status", headers=h)
    assert "last_sync" in r.json()

def test_retry_and_idempotency():
    t=get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":1000000,"month":f"2030-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    key=str(uuid.uuid4())
    eid=str(uuid.uuid4())
    # first push success
    client.post("/sync/push", json={"expenses":[{"id":eid,"jar_id":jid,"amount":50000,"idempotency_key":key}]}, headers=h)
    # retry same key should be idempotent not duplicate local delete
    r=client.post("/sync/push", json={"expenses":[{"id":str(uuid.uuid4()),"jar_id":jid,"amount":50000,"idempotency_key":key}]}, headers=h)
    assert r.json()["expenses"][0]["duplicate"]==True
    # verify only one expense with that key exists
    r=client.get("/sync/pull", headers=h)
    count=len([e for e in r.json()["expenses"] if e["idempotency_key"]==key])
    assert count==1

def test_conflict_last_write_wins():
    t=get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":1000000,"month":f"2030-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    client.post("/sync/push", json={"jars":[{"id":jid,"budget":2000000}]}, headers=h)
    r=client.get(f"/jars/{jid}", headers=h)
    assert r.json()["budget"]==2000000
    client.post("/sync/push", json={"jars":[{"id":jid,"budget":3000000}]}, headers=h)
    r=client.get(f"/jars/{jid}", headers=h)
    assert r.json()["budget"]==3000000

def test_not_delete_local_on_fail():
    t=get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":1000000,"month":f"2030-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    # push with invalid jar_id should fail but not affect valid one
    eid=str(uuid.uuid4())
    r=client.post("/sync/push", json={"expenses":[{"id":eid,"jar_id":"nonexistent","amount":10000,"idempotency_key":str(uuid.uuid4())}]}, headers=h)
    assert r.json()["expenses"][0]["status"]=="FAILED"
    # valid still syncs
    eid2=str(uuid.uuid4())
    r=client.post("/sync/push", json={"expenses":[{"id":eid2,"jar_id":jid,"amount":10000,"idempotency_key":str(uuid.uuid4())}]}, headers=h)
    assert r.json()["expenses"][0]["status"]=="SYNCED"
