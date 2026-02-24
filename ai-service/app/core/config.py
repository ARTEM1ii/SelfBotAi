from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "TelegramLLM AI Service"
    debug: bool = False
    port: int = 8000

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5433
    postgres_user: str = "telegramllm"
    postgres_password: str = "telegramllm_secret"
    postgres_db: str = "telegramllm"

    # OpenAI
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"

    # RAG
    chunk_size: int = 512
    chunk_overlap: int = 64
    top_k_results: int = 5
    embedding_dimensions: int = 1536

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
