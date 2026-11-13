"""CodeVersion model — code_versions table owned by the versions slice (SPEC §6).

A version is immutable (D-04): no `onupdate`, no `updated_at`, no update path
in this slice. Only the retention cleanup deletes rows.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, desc, func
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class CodeVersion(Base):
    __tablename__ = "code_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid7)
    room_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(20), nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_code_versions_room_id_created_at", "room_id", desc("created_at")),
    )
