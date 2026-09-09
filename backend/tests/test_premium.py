from fastapi.testclient import TestClient
from app.main import app
import io
from PIL import Image

client = TestClient(app)

def get_user(email):
    client.post("/auth/register", json={"email": email, "password":"123456"})
    r = client.post("/auth/login", json={"email": email, "password":"123456"})
    return r.json()["access_token"]

def test_gallery_free_blocked():
    import uuid as _uuid
    t = get_user(f"gf_{_uuid.uuid4().hex[:6]}@gmail.com")
    h={"Authorization": f"Bearer {t}"}
    m=f"2028-{_uuid.uuid4().hex[:2]}"
    r=client.post("/jars", json={"budget":1000000,"month":m}, headers=h)
    jid=r.json()["id"]
    buf=io.BytesIO(); Image.new('RGB',(50,50),color='red').save(buf, format='JPEG'); buf.seek(0)
    r=client.post("/expenses", data={"jar_id": jid, "amount":"10000","source":"gallery"}, files={"photo":("a.jpg",buf,"image/jpeg")}, headers=h)
    assert r.status_code==403

def test_gallery_premium_allowed():
    import uuid as _uuid
    t = get_user(f"gp_{_uuid.uuid4().hex[:6]}@gmail.com")
    h={"Authorization": f"Bearer {t}"}
    client.post("/subscription/upgrade", headers=h)
    m=f"2028-{_uuid.uuid4().hex[:2]}"
    r=client.post("/jars", json={"budget":1000000,"month":m}, headers=h)
    jid=r.json()["id"]
    buf=io.BytesIO(); Image.new('RGB',(50,50),color='blue').save(buf, format='JPEG'); buf.seek(0)
    r=client.post("/expenses", data={"jar_id": jid, "amount":"10000","source":"gallery"}, files={"photo":("a.jpg",buf,"image/jpeg")}, headers=h)
    assert r.status_code==200

def test_camera_free_allowed():
    import uuid as _uuid
    t = get_user(f"gc_{_uuid.uuid4().hex[:6]}@gmail.com")
    h={"Authorization": f"Bearer {t}"}
    m=f"2028-{_uuid.uuid4().hex[:2]}"
    r=client.post("/jars", json={"budget":1000000,"month":m}, headers=h)
    jid=r.json()["id"]
    buf=io.BytesIO(); Image.new('RGB',(50,50),color='green').save(buf, format='JPEG'); buf.seek(0)
    r=client.post("/expenses", data={"jar_id": jid, "amount":"10000","source":"camera"}, files={"photo":("a.jpg",buf,"image/jpeg")}, headers=h)
    assert r.status_code==200

def test_ads():
    import uuid as _uuid
    email = f"ads_{_uuid.uuid4().hex[:6]}@gmail.com"
    t = get_user(email)
    h={"Authorization": f"Bearer {t}"}
    r=client.get("/ads/config", headers=h)
    assert r.json()["enabled"]==True
    client.post("/subscription/upgrade", headers=h)
    r=client.get("/ads/config", headers=h)
    assert r.json()["enabled"]==False
    assert r.json()["nativeEvery"]==0

def test_premium_upgrade():
    import uuid as _uuid
    email = f"up_{_uuid.uuid4().hex[:6]}@gmail.com"
    t = get_user(email)
    h={"Authorization": f"Bearer {t}"}
    r=client.get("/subscription/me", headers=h)
    assert r.json()["plan"]=="FREE"
    r=client.post("/subscription/upgrade", headers=h)
    assert r.status_code==200
    r=client.get("/subscription/me", headers=h)
    assert r.json()["plan"]=="PREMIUM"
    assert r.json()["gallery"]==True
