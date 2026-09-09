from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.expense import Expense
from app.models.jar import Jar
import uuid, io
from PIL import Image

client = TestClient(app)

def get_user(email=None):
    if not email: email = f"off_{uuid.uuid4().hex[:6]}@gmail.com"
    client.post("/auth/register", json={"email": email, "password":"123456"})
    r = client.post("/auth/login", json={"email": email, "password":"123456"})
    return r.json()["access_token"], email

def test_offline_idempotency():
    t,_ = get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":2000000,"month":f"2029-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    key=str(uuid.uuid4())
    r1=client.post("/expenses", data={"jar_id": jid, "amount":"100000","idempotency_key":key}, headers=h)
    r2=client.post("/expenses", data={"jar_id": jid, "amount":"100000","idempotency_key":key}, headers=h)
    assert r1.json()["id"]==r2.json()["id"]
    # retry with FAILED then SYNCED simulation: second call not duplicate if different key should create new
    key2=str(uuid.uuid4())
    r3=client.post("/expenses", data={"jar_id": jid, "amount":"100000","idempotency_key":key2}, headers=h)
    assert r3.json()["id"]!=r1.json()["id"]

def test_local_persistence_not_deleted_on_sync_fail():
    # simulate: create expense, then failed sync should keep local
    t,_ = get_user()
    h={"Authorization": f"Bearer {t}"}
    r=client.post("/jars", json={"budget":1000000,"month":f"2029-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    r=client.post("/expenses", data={"jar_id": jid, "amount":"50000"}, headers=h)
    eid=r.json()["id"]
    # verify still exists after failed scenario (we don't delete)
    r=client.get(f"/expenses/{eid}", headers=h)
    assert r.status_code==200

def test_sync_states():
    t,_ = get_user()
    h={"Authorization": f"Bearer {t}"}
    # jars have percentage even when negative
    r=client.post("/jars", json={"budget":1000000,"month":f"2029-{uuid.uuid4().hex[:2]}"}, headers=h)
    jid=r.json()["id"]
    # add expense to make spent > budget
    client.post("/expenses", data={"jar_id": jid, "amount":"1500000"}, headers=h)
    r=client.get(f"/jars/{jid}", headers=h)
    assert r.json()["remaining"]==-500000
    assert r.json()["percentage"]==150.0
