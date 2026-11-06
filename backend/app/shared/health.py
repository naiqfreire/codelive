"""GET /api/health — engine probe, deliberately NOT via Depends(get_session)."""
import asyncio

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.shared.database import get_engine

router = APIRouter()


@router.get("/health")
async def health():
    try:
        async with asyncio.timeout(2):
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "db": "unavailable"})
    return JSONResponse(status_code=200, content={"status": "ok", "db": "ok"})
