"""Application settings loaded from .env."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API keys
    dashscope_api_key: str = Field(default="", alias="DASHSCOPE_API_KEY")
    deepseek_api_key: str = Field(default="", alias="DEEPSEEK_API_KEY")

    # Server
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_env: str = Field(default="dev", alias="APP_ENV")

    # Storage paths (resolved relative to PROJECT_ROOT)
    storage_dir: str = Field(default="storage", alias="STORAGE_DIR")
    chroma_dir: str = Field(default="storage/chroma", alias="CHROMA_DIR")
    image_dir: str = Field(default="storage/images", alias="IMAGE_DIR")
    sqlite_path: str = Field(default="storage/feiyi.db", alias="SQLITE_PATH")

    # Models
    llm_model: str = Field(default="qwen-plus", alias="LLM_MODEL")
    embedding_model: str = Field(default="text-embedding-v3", alias="EMBEDDING_MODEL")
    image_model: str = Field(default="wanx-v1", alias="IMAGE_MODEL")

    @property
    def project_root(self) -> Path:
        return PROJECT_ROOT

    @property
    def chroma_path(self) -> Path:
        return PROJECT_ROOT / self.chroma_dir

    @property
    def image_path(self) -> Path:
        return PROJECT_ROOT / self.image_dir

    @property
    def sqlite_uri(self) -> str:
        db = PROJECT_ROOT / self.sqlite_path
        return f"sqlite:///{db.as_posix()}"


settings = Settings()
