from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    database_url: str
    secret_key: str
    access_token_days: int = 7
    upload_dir: str = "../uploads_v2"

    @property
    def upload_path(self) -> Path:
        return (BASE_DIR / self.upload_dir).resolve()


settings = Settings()
