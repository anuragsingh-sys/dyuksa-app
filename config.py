"""LLM provider configuration. Defaults to Groq free tier."""

from __future__ import annotations
import os
from dataclasses import dataclass

_PRESETS = {
    "groq":      ("https://api.groq.com/openai/v1",  "llama-3.3-70b-versatile", "GROQ_API_KEY"),
    "openai":    ("https://api.openai.com/v1",        "gpt-4o-mini",             "OPENAI_API_KEY"),
    "anthropic": ("https://api.anthropic.com/v1/",   "claude-sonnet-4-6",       "ANTHROPIC_API_KEY"),
}

PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()
_base_url, _model, _key_env = _PRESETS.get(PROVIDER, _PRESETS["groq"])


@dataclass(frozen=True)
class Settings:
    provider: str          = PROVIDER
    base_url: str          = os.getenv("LLM_BASE_URL", _base_url)
    api_key: str | None    = os.getenv(_key_env) or os.getenv("LLM_API_KEY")
    orchestrator_model: str = os.getenv("ORCHESTRATOR_MODEL", _model)
    worker_model: str      = os.getenv("WORKER_MODEL", _model)
    max_tokens: int        = int(os.getenv("MAX_TOKENS", "2048"))
    temperature: float     = float(os.getenv("TEMPERATURE", "0.3"))
    parallel: bool         = os.getenv("PARALLEL", "0") == "1"


settings = Settings()
