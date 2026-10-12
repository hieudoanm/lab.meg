"""Application configuration.

Every setting is sourced from the environment with the ``MEG_`` prefix
(see deployment docs §4.3). Production mode refuses insecure defaults.
"""

from __future__ import annotations

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MEG_", env_file=".env", extra="ignore")

    app_env: Literal["development", "staging", "production"] = "development"
    auth_mode: Literal["development", "oidc"] = "development"
    api_prefix: str = "/api/v1"
    auto_migrate: bool = True

    database_url: str = "postgresql+psycopg://meglab:meglab@localhost:5433/meglab"
    redis_url: str = "redis://localhost:6380/0"
    celery_broker_url: str | None = None

    session_secret: str = "dev-session-secret-change-me"
    jwt_secret: str = "dev-jwt-secret-change-me"
    auth_cookie_name: str = "meg-lab_session"
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_cookie_secure: bool | None = None
    auth_cookie_domain: str | None = None

    auth_provider_issuer: str | None = None
    auth_provider_discovery_url: str | None = None
    auth_provider_client_id: str | None = None
    auth_provider_client_secret: str | None = None
    auth_provider_scopes: str = "openid profile email"

    storage_backend: Literal["s3", "file"] = "file"
    storage_data_dir: str = "./data/storage"
    s3_endpoint: str | None = None
    s3_bucket: str = "meglab"
    s3_region: str = "us-east-1"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None
    s3_signed_url_ttl_seconds: int = 900
    public_base_url: str = "http://localhost:8000"

    mne_worker_image: str = "meg-lab-mne:0.1.0"

    max_upload_bytes: int = 2 * 1024**3
    max_recording_duration_s: float = 3600.0
    max_channel_count: int = 1024
    max_signal_samples: int = 200_000
    max_signal_window_s: float = 600.0

    run_cpu_limit: float = 4.0
    run_memory_limit_mb: int = 8192
    run_disk_limit_mb: int = 20_480
    run_timeout_seconds: int = 3600
    max_concurrent_runs_per_user: int = 4

    page_default_limit: int = 20
    page_max_limit: int = 100

    upload_session_ttl_seconds: int = 86_400
    session_ttl_seconds: int = 7 * 24 * 3600
    reset_token_ttl_seconds: int = 3600
    idempotency_ttl_seconds: int = 24 * 3600

    sample_enabled: bool = True
    log_level: str = "INFO"

    @field_validator("celery_broker_url", mode="before")
    @classmethod
    def default_broker(cls, v: str | None, info) -> str | None:  # noqa: ARG003
        return v

    @field_validator("auth_cookie_secure", mode="before")
    @classmethod
    def default_cookie_secure(cls, v: bool | None, info: object) -> bool | None:
        if v is not None:
            return v
        return None

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def effective_cookie_secure(self) -> bool:
        if self.auth_cookie_secure is not None:
            return self.auth_cookie_secure
        return self.is_production

    def require_production_hardening(self) -> None:
        """Reject insecure configuration in production (deployment §4.3)."""
        if not self.is_production:
            return
        if self.auth_mode != "oidc":
            raise RuntimeError("MEG_AUTH_MODE=oidc is required when MEG_APP_ENV=production")
        if not self.auth_provider_issuer or not self.auth_provider_client_id:
            raise RuntimeError("OIDC provider configuration is required in production")
        for name, value in (
            ("MEG_SESSION_SECRET", self.session_secret),
            ("MEG_JWT_SECRET", self.jwt_secret),
        ):
            if not value or value.startswith("dev-"):
                raise RuntimeError(f"{name} must be a strong, non-default secret in production")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.require_production_hardening()
    return _settings


def reset_settings_cache() -> None:
    global _settings
    _settings = None
