from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    imap_host: str = "imap.example.com"
    imap_port: int = 993
    imap_user: str = ""
    imap_password: str = ""
    imap_inbox_folder: str = "INBOX"
    imap_sent_folder: str = "Sent"

    poll_interval_seconds: int = 60

    database_url: str = "postgresql+asyncpg://mdm:mdm@localhost:5432/mdm"

    age_yellow_hours: int = 24
    age_orange_hours: int = 48
    age_red_hours: int = 72

    closed_strip_days: int = 7
    wall_refresh_seconds: int = 30

    # ERP (agenda e relatórios de intervenção). Com utilizador definido, /erp pede utilizador e palavra-passe.
    erp_utilizador: str = ""
    erp_palavra_passe: str = ""
    # Cabeçalho dos relatórios de intervenção.
    empresa_nome: str = "MDM Assistência Técnica"
    empresa_nome_legal: str = "M.D.M. - Manuel Domingos Melancia, Lda"
    empresa_nif: str = "502 644 761"
    empresa_morada: str = "Alameda dos Oceanos 108 A, Edifício Vila do Oriente, 1990-426 Lisboa"
    empresa_telefone: str = "218 935 050"
    empresa_email: str = "mdmassistencia@gmail.com"
    empresa_alvara: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
