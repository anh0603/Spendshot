from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.jar import Jar
from app.models.expense import Expense
import io
from PIL import Image

client = TestClient(app)

def get_user(email="exp_test@gmail.com"):
    client.post("/auth/register", json={"email": email, "password":"123456"})
    r = client.post("/auth/login", json={"email": email, "password":"123456"})
    return r.json()["access_token"], email

def test_create_expense():
    token,_ = get_user("exp_create@gmail.com")
    h={"Authorization": f"Bearer {token}"}
    # ensure jar
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(Expense).delete(); db.query(JarTransaction).delete(); db.query(Jar).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":2000000,"month":"2027-05"}, headers=h)
    jar_id=r.json()["id"]
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"120000", "category":"An uong", "idempotency_key":"idem1"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==200
    assert r.json()["amount"]==120000
    assert r.json()["category"]=="An uong"
    # check jar spent
    r=client.get(f"/jars/{jar_id}", headers=h)
    assert r.json()["spent"]==120000
    assert r.json()["remaining"]==1880000

def test_idempotency():
    token,_ = get_user("exp_idem@gmail.com")
    h={"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":1000000,"month":"2027-06"}, headers=h)
    jar_id=r.json()["id"]
    r1=client.post("/expenses", data={"jar_id": jar_id, "amount":"50000", "idempotency_key":"dupkey"}, headers={"Authorization": f"Bearer {token}"})
    r2=client.post("/expenses", data={"jar_id": jar_id, "amount":"50000", "idempotency_key":"dupkey"}, headers={"Authorization": f"Bearer {token}"})
    assert r1.json()["id"]==r2.json()["id"]
    r=client.get("/expenses", headers=h)
    assert len([e for e in r.json() if e["idempotency_key"]=="dupkey"])==1

def test_edit_delete():
    token,_ = get_user("exp_edit@gmail.com")
    h={"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":2000000,"month":"2027-07"}, headers=h)
    jar_id=r.json()["id"]
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"100000"}, headers={"Authorization": f"Bearer {token}"})
    eid=r.json()["id"]
    r=client.patch(f"/expenses/{eid}", json={"amount":200000}, headers=h)
    assert r.json()["amount"]==200000
    r=client.get(f"/jars/{jar_id}", headers=h)
    assert r.json()["spent"]==200000
    r=client.delete(f"/expenses/{eid}", headers=h)
    assert r.status_code==200
    r=client.get(f"/jars/{jar_id}", headers=h)
    assert r.json()["spent"]==0

def test_idor():
    t1,_=get_user("exp_idor1@gmail.com")
    t2,_=get_user("exp_idor2@gmail.com")
    h1={"Authorization": f"Bearer {t1}"}
    h2={"Authorization": f"Bearer {t2}"}
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":1000000,"month":"2027-08"}, headers=h1)
    jar_id=r.json()["id"]
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"50000"}, headers={"Authorization": f"Bearer {t1}"})
    eid=r.json()["id"]
    r=client.get(f"/expenses/{eid}", headers=h2)
    assert r.status_code==404
    r=client.delete(f"/expenses/{eid}", headers=h2)
    assert r.status_code==404
    r=client.patch(f"/expenses/{eid}", json={"amount":99999}, headers=h2)
    assert r.status_code==404

def test_photo_upload_validation():
    token,_ = get_user("exp_photo@gmail.com")
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":1000000,"month":"2027-09"}, headers={"Authorization": f"Bearer {token}"})
    jar_id=r.json()["id"]
    # valid jpeg
    img=Image.new('RGB',(200,200), color='blue')
    buf=io.BytesIO(); img.save(buf, format='JPEG'); buf.seek(0)
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"99000"}, files={"photo":("test.jpg", buf, "image/jpeg")}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==200
    assert "thumbnail" in r.json()
    # invalid mime
    buf2=io.BytesIO(b"not image")
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"10000"}, files={"photo":("test.txt", buf2, "text/plain")}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==400
    # optional category not required
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"10000"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==200
    assert r.json()["category"] is None

def test_require_photo_flag():
    # Mặc định (dev/test): không ảnh vẫn lưu được
    token,_ = get_user("exp_nophoto@gmail.com")
    h={"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":1000000,"month":"2027-12"}, headers=h)
    jar_id=r.json()["id"]
    r=client.post("/expenses", data={"jar_id": jar_id, "amount":"10000"}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code==200
    # Bật cờ production: không ảnh → 400, có ảnh → 200
    import app.routers.expenses as exp_router
    old = exp_router.settings.REQUIRE_PHOTO
    exp_router.settings.REQUIRE_PHOTO = True
    try:
        r=client.post("/expenses", data={"jar_id": jar_id, "amount":"10000"}, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code==400
        img=Image.new('RGB',(50,50), color='red')
        buf=io.BytesIO(); img.save(buf, format='JPEG'); buf.seek(0)
        r=client.post("/expenses", data={"jar_id": jar_id, "amount":"10000"}, files={"photo":("a.jpg", buf, "image/jpeg")}, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code==200
    finally:
        exp_router.settings.REQUIRE_PHOTO = old

def test_feed_3col():
    token,_ = get_user("exp_feed@gmail.com")
    h={"Authorization": f"Bearer {token}"}
    db=SessionLocal(); db.query(Expense).delete(); db.query(Jar).delete(); db.commit(); db.close()
    from app.models.jar_transaction import JarTransaction
    db=SessionLocal(); db.query(JarTransaction).delete(); db.commit(); db.close()
    r=client.post("/jars", json={"budget":5000000,"month":"2027-10"}, headers=h)
    jar_id=r.json()["id"]
    for i in range(6):
        client.post("/expenses", data={"jar_id": jar_id, "amount":str(10000*(i+1))}, headers={"Authorization": f"Bearer {token}"})
    r=client.get("/expenses", headers=h)
    assert len(r.json())==6
