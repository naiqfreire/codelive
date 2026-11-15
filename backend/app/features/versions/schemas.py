"""Versions request/response schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_serializer


class VersionOut(BaseModel):
    """D-07: hash-only version metadata — the full list carries no content.

    Exactly the five published keys: ``id``, ``created_at``,
    ``content_hash``, ``language``, ``author_id`` (nullable for job-written
    rows). ``content`` is never a field in this model.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    content_hash: str
    language: str
    author_id: uuid.UUID | None

    @field_serializer("id")
    def serialize_id(self, value):
        return str(value)

    @field_serializer("author_id")
    def serialize_author_id(self, value):
        return str(value) if value is not None else None


class RestoreResponse(BaseModel):
    """D-08: the restored content, its hash and the NEW version's identity.

    Byte-for-byte equal to the ``snapshot`` frame broadcast after the
    restore commit — one representation, two delivery paths.
    """

    content: str
    content_hash: str
    id: uuid.UUID
    created_at: datetime

    @field_serializer("id")
    def serialize_id(self, value):
        return str(value)
