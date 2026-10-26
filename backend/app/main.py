from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import admin, auth, checklists

app = FastAPI(title="QOP")
app.include_router(auth.router)
app.include_router(checklists.router)
app.include_router(admin.router)

settings.upload_path.mkdir(parents=True, exist_ok=True)

# Frontend servido pelo próprio FastAPI (sem nginx por enquanto)
FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
