"""StreamRealm API server."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .db import init_db
from .routes import world


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="StreamRealm API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=config.UPLOAD_DIR), name="uploads")
app.mount("/demo-photos", StaticFiles(directory=config.DEMO_PHOTO_DIR), name="demo-photos")
app.include_router(world.router)


@app.get("/health")
def health():
    return {"ok": True, "ai_mode": "ai" if config.ANTHROPIC_API_KEY else "heuristic"}
