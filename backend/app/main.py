"""FastAPI main application entrypoint."""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.core.db import init_db

settings = get_settings()

app = FastAPI(
    title="Unsung Hero API",
    description="Evidence-backed recognition for invisible and glue work",
    version="1.0.0",
)

# Enable CORS for local Angular dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup: initialize database tables
@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Mount all API endpoints under /api
app.include_router(api_router, prefix="/api")

# Serve built Angular frontend if available in dist/
dist_path = Path(settings.frontend_dist)
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="frontend")
