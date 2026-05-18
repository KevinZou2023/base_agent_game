"""FastAPI entry point for the Xiangyunsha backend."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app import __version__
from app.api.routes import artwork as artwork_route
from app.api.routes import master as master_route
from app.api.routes import scoring as scoring_route
from app.api.routes import user_state as user_state_route
from app.config import settings
from app.storage.db import init_db
from app.utils.logger import logger


# ---------------------------------------------------------------------------
# Lifespan: initialize DB tables and storage dirs once at startup
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.chroma_path.mkdir(parents=True, exist_ok=True)
    settings.image_path.mkdir(parents=True, exist_ok=True)
    init_db()
    logger.info(
        "Backend ready: storage={} chroma={} sqlite={}",
        settings.storage_dir,
        settings.chroma_dir,
        settings.sqlite_path,
    )
    yield
    logger.info("Backend shutting down.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title="艺镜工坊 · 香云纱后端",
        version=__version__,
        description=(
            "AI Agent 驱动的香云纱非遗工坊后端。\n\n"
            "- **POST /api/v1/master/chat** — 师傅 Agent 对话\n"
            "- **POST /api/v1/artwork/generate** — AI 生成贴图\n"
            "- **GET /api/v1/scoring/{artwork_id}** — 多维评分与师傅点评\n"
            "- **GET/PUT /api/v1/user/{player_id}/state** — 玩家状态同步\n"
            "- **GET /static/images/{filename}** — 生成图静态资源\n"
        ),
        lifespan=lifespan,
    )

    # Rate limiting (60 req/min per IP by default; artwork generate stricter)
    limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": f"请求过于频繁: {exc.detail}", "code": "rate_limited"},
        )

    # CORS: open during dev so Unity / browser tests can hit it
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount static images directory
    settings.image_path.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/static/images",
        StaticFiles(directory=str(settings.image_path)),
        name="images",
    )

    # Routers
    app.include_router(master_route.router)
    app.include_router(artwork_route.router)
    app.include_router(scoring_route.router)
    app.include_router(user_state_route.router)

    # Global exception handler so unexpected errors return structured JSON
    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        if isinstance(exc, HTTPException):
            raise exc
        logger.exception("Unhandled error on {} {}: {}", request.method, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": f"internal server error: {exc}", "code": "internal_error"},
        )

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        return {
            "name": "艺镜工坊·香云纱后端",
            "version": __version__,
            "docs": "/docs",
        }

    return app


app = create_app()


__all__ = ["app", "create_app"]
