"""Login and session payloads."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(max_length=320)
    password: str = Field(max_length=1024)


class AuthUser(BaseModel):
    username: str
