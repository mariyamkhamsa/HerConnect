"""
Central configuration, loaded from environment variables (.env file).
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root:root@localhost:3306/herconnect"
    SECRET_KEY: str = "change-this-to-a-long-random-secret-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "uploads"
    SBERT_MODEL_NAME: str = "all-MiniLM-L6-v2"
    CROSS_ENCODER_MODEL_NAME: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # --- Password reset / outgoing e-mail -------------------------------------------------
    # Where the reset link in the e-mail points (the React app).
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    PASSWORD_RESET_EXPIRE_MINUTES: int = 30
    # E-mail delivery is OFF until SMTP_HOST and SMTP_FROM are set (see .env.example).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True   # STARTTLS (port 587)
    SMTP_USE_SSL: bool = False  # implicit TLS (port 465); takes precedence over STARTTLS
    # Development convenience: with no SMTP configured, print the reset link in the backend
    # console instead of e-mailing it. Set to false in any real deployment.
    PASSWORD_RESET_LOG_LINK_WITHOUT_SMTP: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
