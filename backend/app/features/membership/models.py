"""RoomMember model — room_members table owned by the membership slice.

nickname is the spectator alias, NULL for the owner (D-08).
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class RoomMember(Base):
    __tablename__ = "room_members"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid7)
    room_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    anonymous_session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(60), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_members_room_user"),
        UniqueConstraint("room_id", "anonymous_session_id", name="uq_room_members_room_anon"),
        CheckConstraint("role IN ('owner','viewer')", name="role_valid"),
        CheckConstraint(
            "(is_anonymous AND user_id IS NULL AND anonymous_session_id IS NOT NULL) "
            "OR (NOT is_anonymous AND user_id IS NOT NULL AND anonymous_session_id IS NULL)",
            name="identity_consistent",
        ),
        CheckConstraint(
            "NOT is_anonymous OR (nickname IS NOT NULL AND btrim(nickname) <> '')",
            name="nickname_required",
        ),
    )
