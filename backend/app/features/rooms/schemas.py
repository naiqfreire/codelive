"""Rooms request/response schemas."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

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


class ByCodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    access_code: str
    language: Language
    status: Literal["active", "closed"]
    created_at: datetime
    updated_at: datetime


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    anonymous: bool = False
    nickname: str | None = Field(default=None, max_length=60)


class JoinInfo(BaseModel):
    room_id: uuid.UUID
    user_id: str
    role: Literal["owner", "viewer"]
    is_anonymous: bool
    nickname: str | None
    joined_at: datetime


class ListJoinedResponse(BaseModel):
    items: list[JoinInfo]
