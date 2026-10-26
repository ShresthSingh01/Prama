import json
import logging
import time
from typing import Protocol, Dict, Any, Optional
import httpx
from backend.app.core.config import settings

import random
import threading

logger = logging.getLogger(__name__)

class TokenBucketRateLimiter:
    """
    Thread-safe Token Bucket Rate Limiter to protect against Google Gemini API rate limits (e.g. 15 RPM).
    Enforces smooth request spacing and a maximum request rate per minute.
    """
    def __init__(self, rpm: int = 15, max_burst: int = 1):
        self.rpm = max(1, rpm)
        self.rate = self.rpm / 60.0  # tokens per second
        self.max_tokens = float(max_burst)
        self.tokens = float(max_burst)
        self.last_refill = time.monotonic()
        self.min_interval = 60.0 / self.rpm  # e.g., 4.0s for 15 RPM
        self.last_request = 0.0
        self.lock = threading.Lock()

    def acquire(self) -> float:
        """
        Blocks until a token is available and minimum spacing is met.
        Returns the duration slept in seconds.
        """
        with self.lock:
            now = time.monotonic()
            
            # 1. Refill tokens based on elapsed time
            elapsed = now - self.last_refill
            self.tokens = min(self.max_tokens, self.tokens + elapsed * self.rate)
            self.last_refill = now
            
            sleep_needed = 0.0
            
            # 2. Check token capacity
            if self.tokens < 1.0:
                deficit = 1.0 - self.tokens
                sleep_needed = max(sleep_needed, deficit / self.rate)
                
            # 3. Minimum interval spacing between consecutive calls (prevents instantaneous burst)
            time_since_last = now - self.last_request
            if time_since_last < self.min_interval:
                spacing_delay = self.min_interval - time_since_last
                sleep_needed = max(sleep_needed, spacing_delay)
                
            if sleep_needed > 0:
                time.sleep(sleep_needed)
                now = time.monotonic()
                elapsed = now - self.last_refill
                self.tokens = min(self.max_tokens, self.tokens + elapsed * self.rate)
                self.last_refill = now
                
            # Consume 1 token
            self.tokens = max(0.0, self.tokens - 1.0)
            self.last_request = time.monotonic()
            return sleep_needed

class LLMClient(Protocol):
    """Protocol for LLM / SLM operations across extraction and generation."""
    def extract_json(self, prompt: str, schema: dict, text: str) -> dict:
        ...
        
    def generate(self, prompt: str, max_tokens: int = 200) -> str:
        ...
        
    def health(self) -> Dict[str, Any]:
        ...

class GeminiClient:
    """Online Google Gemini API client with schema-constrained JSON, token bucket rate limiter, and exponential backoff retry."""
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3-flash-preview",
        rpm_limit: int = 15,
        max_retries: int = 3,
        timeout: int = 30
    ):
        self.api_key = api_key
        self.model = model
        self.rpm_limit = rpm_limit
        self.max_retries = max_retries
        self.timeout = timeout
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        self.rate_limiter = TokenBucketRateLimiter(rpm=rpm_limit)
        # Fallback model in case primary model encounters transient 503 capacity issues
        self.backup_model = "gemini-3.1-flash-lite-preview" if "preview" in model else None

    def _execute_with_retry(self, fn):
        """Executes API call wrapped in rate-limiting and exponential backoff on 429/503."""
        self.rate_limiter.acquire()
        
        last_exception = None
        for attempt in range(self.max_retries + 1):
            try:
                return fn()
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                if status in (429, 503) and attempt < self.max_retries:
                    retry_after = e.response.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        backoff = float(retry_after) + 1.0
                    else:
                        base = 5.0 if status == 429 else 3.0
                        backoff = (base * (attempt + 1)) + random.uniform(0.5, 1.5)
                    reason = "Rate Limit (429)" if status == 429 else "Server Overloaded (503)"
                    logger.warning(
                        f"Gemini API {reason}. Backing off for {backoff:.2f}s (retry {attempt + 1}/{self.max_retries})..."
                    )
                    time.sleep(backoff)
                    last_exception = e
                    continue
                raise
            except (httpx.TimeoutException, httpx.ConnectError) as e:
                if attempt < self.max_retries:
                    backoff = (1.5 ** (attempt + 1)) + random.uniform(0.1, 0.5)
                    logger.warning(
                        f"Gemini API network error ({type(e).__name__}). Retrying in {backoff:.2f}s (retry {attempt + 1}/{self.max_retries})..."
                    )
                    time.sleep(backoff)
                    last_exception = e
                    continue
                raise
        if last_exception:
            raise last_exception

    def _post_generate(self, payload: dict, active_model: Optional[str] = None) -> dict:
        model_to_use = active_model or self.model
        url = f"{self.base_url}/models/{model_to_use}:generateContent"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json"
        }

        def _do_call():
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()

        try:
            return self._execute_with_retry(_do_call)
        except Exception as e:
            # If primary model failed and backup model is configured, try backup once
            if self.backup_model and model_to_use != self.backup_model:
                logger.info(f"Retrying request with backup Gemini model: {self.backup_model}")
                return self._post_generate(payload, active_model=self.backup_model)
            raise

    def extract_json(self, prompt: str, schema: dict, text: str) -> dict:
        full_prompt = (
            f"{prompt}\n\n"
            f"You MUST output valid JSON matching this schema: {json.dumps(schema)}\n\n"
            f"Input Document Text:\n```\n{text}\n```"
        )
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0}
            }
        }
        data = self._post_generate(payload)
        candidate = data.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        raw_content = "".join(p.get("text", "") for p in parts if "text" in p).strip()
        if not raw_content:
            raise ValueError(f"Empty extraction content received from Gemini: {candidate.get('finishReason')}")
        return json.loads(raw_content)

    def generate(self, prompt: str, max_tokens: int = 200) -> str:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": max(50, max_tokens),
                "thinkingConfig": {"thinkingBudget": 0}
            }
        }
        data = self._post_generate(payload)
        candidate = data.get("candidates", [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        raw_text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
        if not raw_text:
            raise ValueError(f"Empty text response from Gemini: {candidate.get('finishReason')}")
        return raw_text

    def health(self) -> Dict[str, Any]:
        try:
            url = f"{self.base_url}/models/{self.model}"
            headers = {"x-goog-api-key": self.api_key}
            t0 = time.time()
            with httpx.Client(timeout=5) as client:
                res = client.get(url, headers=headers)
                healthy = res.status_code == 200
                latency = round((time.time() - t0) * 1000, 1)
                return {
                    "provider": "gemini",
                    "model": self.model,
                    "healthy": healthy,
                    "status_code": res.status_code,
                    "latency_ms": latency,
                    "rpm_limit": self.rpm_limit,
                    "max_retries": self.max_retries
                }
        except Exception as e:
            return {"provider": "gemini", "model": self.model, "healthy": False, "error": str(e)}

class OllamaClient:
    """Local SLM client (Ollama/llama.cpp) exposed on internal network."""
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen2.5:3b", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def extract_json(self, prompt: str, schema: dict, text: str) -> dict:
        url = f"{self.base_url}/api/generate"
        full_prompt = (
            f"{prompt}\n\n"
            f"Schema: {json.dumps(schema)}\n\n"
            f"Text:\n{text}\n\n"
            f"Respond ONLY with valid JSON."
        )
        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.0}
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            return json.loads(resp.json().get("response", "{}"))

    def generate(self, prompt: str, max_tokens: int = 200) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": max_tokens}
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "").strip()

    def health(self) -> Dict[str, Any]:
        try:
            with httpx.Client(timeout=3) as client:
                res = client.get(f"{self.base_url}/api/tags")
                return {
                    "provider": "ollama",
                    "model": self.model,
                    "healthy": res.status_code == 200,
                    "base_url": self.base_url
                }
        except Exception as e:
            return {"provider": "ollama", "model": self.model, "healthy": False, "error": str(e)}

class NullClient:
    """Deterministic, safe fallback client used when offline or SLM_ENABLED=false."""
    def extract_json(self, prompt: str, schema: dict, text: str) -> dict:
        return {}

    def generate(self, prompt: str, max_tokens: int = 200) -> str:
        return "AI analysis unavailable (offline fallback)."

    def health(self) -> Dict[str, Any]:
        return {"provider": "null", "model": "none", "healthy": True, "note": "Deterministic fallback active"}

class HybridLLMClient:
    """
    Multi-provider LLM router:
    Primary: Online Google Gemini API (if GEMINI_API_KEY is configured).
    Fallback: Local SLM (Ollama).
    Ultimate Fallback: NullClient (ensures zero crash guarantee).
    """
    def __init__(self):
        self.gemini = GeminiClient(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            rpm_limit=settings.GEMINI_RPM_LIMIT,
            max_retries=settings.GEMINI_MAX_RETRIES,
            timeout=settings.SLM_TIMEOUT_SECONDS
        ) if settings.GEMINI_API_KEY else None
        self.ollama = OllamaClient(base_url=settings.SLM_BASE_URL, model=settings.SLM_MODEL, timeout=settings.SLM_TIMEOUT_SECONDS)
        self.null_client = NullClient()

    def _get_active_client(self) -> tuple:
        # ponytail: prioritize gemini if key present; fallback to ollama; then null
        if not settings.SLM_ENABLED:
            return self.null_client, "null"
        if settings.LLM_PROVIDER == "gemini" and self.gemini:
            return self.gemini, "gemini"
        if settings.LLM_PROVIDER == "ollama":
            return self.ollama, "ollama"
        if self.gemini:
            return self.gemini, "gemini"
        return self.ollama, "ollama"

    def extract_json(self, prompt: str, schema: dict, text: str) -> dict:
        client, name = self._get_active_client()
        try:
            return client.extract_json(prompt, schema, text)
        except Exception as e:
            logger.warning(f"Primary LLM client '{name}' failed extraction: {e}. Falling back.")
            if client is self.gemini:
                try:
                    return self.ollama.extract_json(prompt, schema, text)
                except Exception as oe:
                    logger.warning(f"Fallback Ollama also failed: {oe}. Using NullClient.")
            return self.null_client.extract_json(prompt, schema, text)

    def generate(self, prompt: str, max_tokens: int = 200) -> str:
        client, name = self._get_active_client()
        try:
            return client.generate(prompt, max_tokens=max_tokens)
        except Exception as e:
            logger.warning(f"Primary LLM client '{name}' failed generate: {e}. Falling back.")
            if client is self.gemini:
                try:
                    return self.ollama.generate(prompt, max_tokens=max_tokens)
                except Exception:
                    pass
            return self.null_client.generate(prompt, max_tokens=max_tokens)

    def health(self) -> Dict[str, Any]:
        if not settings.SLM_ENABLED:
            return {"active_provider": "null", "slm_enabled": False, "status": "disabled"}
        if self.gemini:
            g_health = self.gemini.health()
            if g_health.get("healthy"):
                return {"active_provider": "gemini", "details": g_health, "slm_enabled": True}
        o_health = self.ollama.health()
        if o_health.get("healthy"):
            return {"active_provider": "ollama", "details": o_health, "slm_enabled": True}
        return {"active_provider": "null", "details": self.null_client.health(), "slm_enabled": True, "warning": "All remote/local providers offline; running in safe deterministic fallback"}

# Singleton instance
_client_instance: Optional[HybridLLMClient] = None

def get_llm_client() -> HybridLLMClient:
    global _client_instance
    if _client_instance is None:
        _client_instance = HybridLLMClient()
    return _client_instance
