"""Rooms request/response schemas."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_serializer

Language = Literal["python", "java", "c", "php", "javascript"]


class CreateRoomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Language


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    access_code: str
    language: Language
    status: Literal["active", "closed"]
    created_at: datetime

    @field_serializer("id")
    def serialize_id(self, value):
        return str(value)
