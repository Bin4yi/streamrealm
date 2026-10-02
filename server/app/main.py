"""StreamRealm API server."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlmodel import Session, select

from . import config
from .db import engine, init_db
from .models import Player
from .routes import dev, play, social, world
from .services.bots import seed_world


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        social.seed_quests(session)
    if config.SEED_DEMO:
        with Session(engine) as session:
            if not session.exec(select(Player).where(Player.is_bot == True)).first():  # noqa: E712
                seed_world(session)
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
app.include_router(play.router)
app.include_router(social.router)
app.include_router(dev.router)


@app.get("/health")
def health():
    return {"ok": True, "ai_mode": "ai" if config.ANTHROPIC_API_KEY else "heuristic"}
