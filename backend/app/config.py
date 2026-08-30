"""
Central configuration, loaded from environment variables (.env file).
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root:your_password@localhost:3306/herconnect"
    SECRET_KEY: str = "change-this-to-a-long-random-secret-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "uploads"
    SBERT_MODEL_NAME: str = "all-MiniLM-L6-v2"
    CROSS_ENCODER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    class Config:
        env_file = ".env"


settings = Settings()
