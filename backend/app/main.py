"""Application factory. Uvicorn loads ``app`` lazily so imports stay side-effect free."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException
from starlette.types import Scope

from app.config import Settings, validate_startup
from app.db import Database
from app.errors import register_exception_handlers
from app.routers import auth, backup, contexts, health, home, integrations, items, projects, search
from app.routers import settings as settings_router
from app.routers.auth import ensure_admin_user
from app.services.items import purge_expired_trash
from app.security import LoginRateLimiter, apply_security_headers, origin_is_allowed, resolve_password_hash

STATIC_DIR = Path("/app/static")
NO_CACHE_NAMES = frozenset({"sw.js", "registerSW.js", "manifest.webmanifest", "index.html"})
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


class SPAStaticFiles(StaticFiles):
    """Serve the built SPA. Unknown GET paths fall back to index.html, never /api."""

    async def get_response(self, path: str, scope: Scope):
        try:
            response = await super().get_response(path, scope)
            served = path
        except HTTPException as exc:
            if exc.status_code != 404 or path == "api" or path.startswith("api/"):
                raise
            response = await super().get_response("index.html", scope)
            served = "index.html"
        name = served.rsplit("/", 1)[-1]
        if served in {"", "."} or name in NO_CACHE_NAMES:
            response.headers["Cache-Control"] = "no-cache"
        elif served.startswith("assets/"):
            response.headers["Cache-Control"] = IMMUTABLE_CACHE
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = app.state.settings
    app.state.password_hash = resolve_password_hash(settings)
    database = Database(settings.database_path, settings.user_timezone)
    await database.connect()
    app.state.db = database
    await ensure_admin_user(database, settings.admin_username.strip(), app.state.password_hash)
    await purge_expired_trash(database)
    try:
        yield
    finally:
        await database.close()


async def security_middleware(request: Request, call_next):
    request.state.request_id = uuid4().hex
    settings: Settings = request.app.state.settings
    if origin_is_allowed(request.method, request.headers.get("origin"), settings.allowed_origin_list):
        response = await call_next(request)
    else:
        response = JSONResponse(
            status_code=403,
            content={"detail": "Origin is not allowed", "code": "bad_origin"},
        )
    response.headers["X-Request-ID"] = request.state.request_id
    apply_security_headers(response)
    return response


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings if settings is not None else Settings()
    validate_startup(resolved)
    app = FastAPI(title="Notes", lifespan=lifespan)
    app.state.settings = resolved
    app.state.rate_limiter = LoginRateLimiter()
    register_exception_handlers(app)
    app.middleware("http")(security_middleware)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(contexts.router)
    app.include_router(projects.router)
    app.include_router(items.router)
    app.include_router(search.router)
    app.include_router(home.router)
    app.include_router(settings_router.router)
    app.include_router(backup.router)
    app.include_router(integrations.router)
    if STATIC_DIR.is_dir():
        app.mount("/", SPAStaticFiles(directory=STATIC_DIR, html=True), name="spa")
    return app


def __getattr__(name: str) -> FastAPI:
    if name == "app":
        application = create_app()
        globals()["app"] = application
        return application
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
