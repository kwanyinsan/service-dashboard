from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import requests
import time

from models import PingHistory, Service, SessionLocal
from concurrent.futures import ThreadPoolExecutor

app = FastAPI(title="Service Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: dict = {}
CACHE_TTL_SECONDS = 2


class ServiceCreate(BaseModel):
    name: str
    url: str


class ServiceOut(BaseModel):
    id: int
    name: str
    url: str
    status: int | None
    latency: float | None
    last_checked: str | None

    class Config:
        from_attributes = True


class HistoryOut(BaseModel):
    id: int
    service_id: int
    latency: float | None
    status: int | None
    timestamp: str


# ── Helpers ──────────────────────────────────────────────────────────

def ping_service(url: str) -> dict:
    start = time.time()
    try:
        resp = requests.get(url, timeout=5)
    except requests.exceptions.RequestException:
        return {"status": None, "latency": None}

    latency = round((time.time() - start) * 1000, 2)
    return {"status": resp.status_code, "latency": latency}


def ping_with_cache(url: str) -> dict:
    now = datetime.utcnow()
    if url in _cache:
        cached = _cache[url]
        cached_time = datetime.fromisoformat(cached["timestamp"])
        if (now - cached_time) < timedelta(seconds=CACHE_TTL_SECONDS):
            # Cached results retain their original check timestamp.
            return cached

    result = ping_service(url)
    result["timestamp"] = now.isoformat()
    _cache[url] = result
    return result


# ── Routes ───────────────────────────────────────────────────────────

@app.get("/services", response_model=list[ServiceOut])
def list_services():
    db = SessionLocal()
    try:
        services = db.query(Service).all()
        out = []
        for s in services:
            out.append(ServiceOut(
                id=s.id,
                name=s.name,
                url=s.url,
                status=s.status,
                latency=s.latency,
                last_checked=s.last_checked.isoformat() if s.last_checked else None,
            ))
        return out
    finally:
        db.close()


@app.post("/services", response_model=ServiceOut)
def add_service(payload: ServiceCreate):
    db = SessionLocal()
    try:
        existing = db.query(Service).filter(Service.url == payload.url).first()
        if existing:
            raise HTTPException(status_code=400, detail="URL already exists")
        service = Service(name=payload.name, url=payload.url)
        db.add(service)
        db.commit()
        db.refresh(service)
        return ServiceOut(
            id=service.id,
            name=service.name,
            url=service.url,
            status=service.status,
            latency=service.latency,
            last_checked=None,
        )
    finally:
        db.close()


@app.delete("/services/{service_id}")
def delete_service(service_id: int):
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        # Remove history explicitly before deleting its service.
        db.query(PingHistory).filter(
            PingHistory.service_id == service_id
        ).delete(synchronize_session=False)

        db.delete(service)
        db.commit()
        return {"detail": "deleted"}
    finally:
        db.close()


@app.post("/services/{service_id}/check", response_model=ServiceOut)
def check_service(service_id: int):
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        result = ping_with_cache(service.url)

        service.status = result["status"]
        service.latency = result["latency"]
        service.last_checked = datetime.fromisoformat(result["timestamp"])

        db.add(PingHistory(
            service_id=service.id,
            latency=service.latency,
            status=service.status,
            timestamp=service.last_checked,
        ))

        db.commit()
        db.refresh(service)

        return ServiceOut(
            id=service.id,
            name=service.name,
            url=service.url,
            status=service.status,
            latency=service.latency,
            last_checked=result["timestamp"],
        )
    finally:
        db.close()


@app.post("/services/check-all")
def check_all_services():
    db = SessionLocal()
    try:
        services = db.query(Service).all()
        urls = [service.url for service in services]

        # HTTP requests run in workers; database writes stay in this thread.
        with ThreadPoolExecutor() as executor:
            ping_results = list(executor.map(ping_with_cache, urls))

        results = []
        for service, result in zip(services, ping_results):
            service.status = result["status"]
            service.latency = result["latency"]
            service.last_checked = datetime.fromisoformat(result["timestamp"])

            db.add(PingHistory(
                service_id=service.id,
                latency=service.latency,
                status=service.status,
                timestamp=service.last_checked,
            ))

            results.append(ServiceOut(
                id=service.id,
                name=service.name,
                url=service.url,
                status=service.status,
                latency=service.latency,
                last_checked=result["timestamp"],
            ))

        db.commit()
        return results
    finally:
        db.close()


@app.get("/services/{service_id}/history", response_model=list[HistoryOut])
def get_service_history(service_id: int):
    db = SessionLocal()
    try:
        service = db.query(Service).filter(Service.id == service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        # Cached checks can share timestamps, so order by record ID.
        history = (
            db.query(PingHistory)
            .filter(PingHistory.service_id == service_id)
            .order_by(PingHistory.id.desc())
            .limit(5)
            .all()
        )

        return [
            HistoryOut(
                id=entry.id,
                service_id=entry.service_id,
                latency=entry.latency,
                status=entry.status,
                timestamp=entry.timestamp.isoformat(),
            )
            for entry in history
        ]
    finally:
        db.close()
