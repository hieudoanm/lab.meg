"""Auth request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, field_validator

from app.schemas.common import UserPublic


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginResponse(BaseModel):
    user: UserPublic
    expires_at: str | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class PasswordResetRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class MeResponse(UserPublic):
    pass


class DevelopmentTokenRequest(BaseModel):
    email: str
    display_name: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class DevelopmentTokenResponse(BaseModel):
    access_token: str
    expires_at: str
    user: UserPublic
