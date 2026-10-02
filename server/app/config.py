"""Paths and environment settings."""
from __future__ import annotations

import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("STREAMREALM_DATA_DIR", SERVER_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DEMO_PHOTO_DIR = DATA_DIR / "demo-photos"
GENERATED_DEMO_DIR = DEMO_PHOTO_DIR / "generated"
TILES_DIR = DATA_DIR / "tiles"
EXPERIMENT_DIR = DATA_DIR / "experiment"
CITIES_FILE = DATA_DIR / "cities.json"
DB_URL = os.environ.get("STREAMREALM_DB_URL", f"sqlite:///{(DATA_DIR / 'streamrealm.db').as_posix()}")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
# gpt-6-luna: OpenAI's most efficient current model with image input + structured outputs
# (developers.openai.com/api/docs/models, checked 2026-10). Override with OPENAI_MODEL, e.g. gpt-6.1-sol.
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-luna").strip()
AI_TIMEOUT_S = float(os.environ.get("AI_TIMEOUT_S", "8"))

# Set to "0" to start with an empty world (no bots).
SEED_DEMO = os.environ.get("STREAMREALM_SEED_DEMO", "1") != "0"
# Bots only live in this city; cities you add yourself start empty (all fog).
SEED_CITY = os.environ.get("STREAMREALM_SEED_CITY", "coimbra")

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

for d in (UPLOAD_DIR, GENERATED_DEMO_DIR, EXPERIMENT_DIR):
    d.mkdir(parents=True, exist_ok=True)
