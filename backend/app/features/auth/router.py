"""Auth HTTP routes. Public router (register) + protected router (me)."""
import structlog
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth import service
from app.features.auth.public import get_current_user, require_authenticated
from app.features.auth.schemas import LoginRequest, RegisterRequest, UserOut
from app.shared.config import Settings, get_settings
from app.shared.database import get_session
from app.shared.errors import ErrorCode
from app.shared.security import SESSION_COOKIE_NAME, issue_session

log = structlog.get_logger()

public_router = APIRouter()
protected_router = APIRouter(dependencies=[Depends(require_authenticated)])


@public_router.post("/register", status_code=201, response_model=UserOut)
async def register(
    data: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    user = await service.register(session, data)
    log.info("user_registered", user_id=str(user.id))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        issue_session(settings.SESSION_SECRET.get_secret_value(), user.id),
        max_age=None,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    return user


@public_router.post("/login", response_model=UserOut)
async def login(
    data: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    user = await service.authenticate(session, data.email, data.password)
    if user is None:
        log.info("login_failed")
        raise HTTPException(status_code=401, detail=ErrorCode.INVALID_CREDENTIALS)
    log.info("login_succeeded", user_id=str(user.id))
    response.set_cookie(
        SESSION_COOKIE_NAME,
        issue_session(settings.SESSION_SECRET.get_secret_value(), user.id),
        max_age=None,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    return user


@protected_router.get("/me", response_model=UserOut)
async def me(user=Depends(get_current_user)):
    return user


@protected_router.post("/logout", status_code=204)
async def logout(
    response: Response,
    user=Depends(get_current_user),
):
    log.info("logout", user_id=str(user.id))
    response.delete_cookie(
        SESSION_COOKIE_NAME, path="/", secure=True, httponly=True, samesite="lax"
    )
    return None
