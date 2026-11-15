"""Login, registration, and password payloads."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

_USERNAME = re.compile(r"[A-Za-z0-9._-]+\Z")


class LoginRequest(BaseModel):
    username: str = Field(max_length=320)
    password: str = Field(max_length=1024)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=8, max_length=1024)
    code: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def username_characters(cls, value: str) -> str:
        if _USERNAME.fullmatch(value) is None:
            raise ValueError("Use letters, numbers, dots, hyphens, or underscores")
        return value


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=8, max_length=1024)


class AuthUser(BaseModel):
    username: str
