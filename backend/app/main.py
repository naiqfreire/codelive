"""Composition root: FastAPI instance, /api prefix, middleware wiring."""

import os

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.features.auth import router as auth
from app.features.live_code import router as live_code
from app.features.rooms import router as rooms
from app.shared import health
from app.shared.asyncio_policy import ensure_selector_event_loop
from app.shared.config import get_settings
from app.shared.errors import register_handlers
from app.shared.logging import configure_logging
from app.shared.middleware import OriginCheckMiddleware, RequestContextMiddleware

# Must run before uvicorn creates its event loop: on Windows psycopg (async)
# cannot use the default ProactorEventLoop.
ensure_selector_event_loop()

configure_logging(os.getenv("LOG_LEVEL", "INFO"))

app = FastAPI(title="CodeLive API", version="0.1.0", docs_url="/docs", openapi_url="/openapi.json")
app.add_middleware(OriginCheckMiddleware, allowed_origins=get_settings().ALLOWED_ORIGINS)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_handlers(app)

api = APIRouter(prefix="/api")
api.include_router(health.router)
api.include_router(auth.public_router, prefix="/auth")
api.include_router(auth.protected_router, prefix="/auth")
api.include_router(rooms.router, prefix="/rooms")
api.include_router(rooms.public_router, prefix="/rooms")
api.include_router(live_code.router, prefix="/ws")
app.include_router(api)
