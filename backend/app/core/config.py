from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Asistencias Solete API"
    secret_key: str = "change-me-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    database_url: str = "sqlite:///./app.db"


settings = Settings()
