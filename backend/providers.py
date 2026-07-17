"""
Provider chain: Groq (primary) -> OpenRouter (secondary) -> Gemini (last resort).

Each provider function is an async generator that yields text chunks as they
stream in from the upstream API. Raising an exception signals "this provider
failed, move on to the next one" — mirroring the original client-side logic
in script.js.
"""
import json
import os

import httpx
from dotenv import load_dotenv

# Load .env here too (not just in app.py) — this module reads os.getenv()
# at import time below, so the .env file must be loaded before that happens,
# regardless of which file gets imported/executed first.
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "openai/gpt-oss-120b"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openrouter/free"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:streamGenerateContent?alt=sse"
)

# A single fixed timeout (the old value was 60s total) kills long responses
# mid-stream once they pass it — that looked exactly like "chat cuts off
# partway", because the code would then quietly fall back to the next
# provider and restart from scratch. Keep connect/write short, let read run long.
REQUEST_TIMEOUT = httpx.Timeout(connect=10.0, write=10.0, pool=10.0, read=180.0)


def build_chat_messages(history: list[dict]) -> list[dict]:
    """Flatten Gemini-style history into OpenAI-style chat messages.
    Groq/OpenRouter are text-only here, so any inline_data (image) is dropped.
    """
    messages = []
    for entry in history:
        role = "assistant" if entry.get("role") == "model" else "user"
        text = next((p.get("text") for p in entry.get("parts", []) if p.get("text")), "")
        messages.append({"role": role, "content": text})
    return messages


def build_gemini_contents(history: list[dict]) -> list[dict]:
    """Older turns don't need their image bytes resent — only the most
    recent entry keeps its inline_data, matching the original behavior.
    """
    contents = []
    last_index = len(history) - 1
    for i, entry in enumerate(history):
        if i == last_index:
            contents.append(entry)
        else:
            parts = [p for p in entry.get("parts", []) if "inline_data" not in p]
            contents.append({"role": entry.get("role"), "parts": parts})
    return contents


async def stream_openai_compatible(url: str, api_key: str, model: str, label: str, history: list[dict]):
    if not api_key:
        raise RuntimeError(f"{label} API key is not configured on the server.")

    payload = {
        "model": model,
        "messages": build_chat_messages(history),
        "stream": True,
        "max_tokens": 4096,
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        async with client.stream("POST", url, json=payload, headers=headers) as response:
            if response.status_code != 200:
                body = await response.aread()
                try:
                    err = json.loads(body).get("error", {}).get("message")
                except Exception:
                    err = None
                raise RuntimeError(err or f"{label} request failed ({response.status_code})")

            buffer = ""
            async for raw_line in response.aiter_lines():
                line = raw_line.strip()
                if not line.startswith("data:"):
                    continue
                json_str = line[5:].strip()
                if not json_str or json_str == "[DONE]":
                    continue
                try:
                    parsed = json.loads(json_str)
                except json.JSONDecodeError:
                    continue
                if parsed.get("error"):
                    raise RuntimeError(parsed["error"].get("message") or f"{label} API error")
                chunk = parsed.get("choices", [{}])[0].get("delta", {}).get("content")
                if chunk:
                    yield chunk


async def stream_from_groq(history: list[dict]):
    async for chunk in stream_openai_compatible(GROQ_API_URL, GROQ_API_KEY, GROQ_MODEL, "Groq", history):
        yield chunk


async def stream_from_openrouter(history: list[dict]):
    async for chunk in stream_openai_compatible(
        OPENROUTER_API_URL, OPENROUTER_API_KEY, OPENROUTER_MODEL, "OpenRouter", history
    ):
        yield chunk


async def stream_from_gemini(history: list[dict]):
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is not configured on the server.")

    payload = {
        "contents": build_gemini_contents(history),
        "generationConfig": {"maxOutputTokens": 4096},
    }
    headers = {"x-goog-api-key": GEMINI_API_KEY}

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        async with client.stream("POST", GEMINI_API_URL, json=payload, headers=headers) as response:
            if response.status_code != 200:
                body = await response.aread()
                try:
                    err = json.loads(body).get("error", {}).get("message")
                except Exception:
                    err = None
                raise RuntimeError(err or f"Gemini request failed ({response.status_code})")

            block_reason = ""
            buffer = ""
            async for raw_chunk in response.aiter_text():
                buffer += raw_chunk
                events = buffer.split("\n\n")
                buffer = events.pop()  # keep incomplete trailing event for next read

                for event_str in events:
                    lines = [l[5:].strip() for l in event_str.split("\n") if l.startswith("data:")]
                    json_str = "".join(lines)
                    if not json_str:
                        continue
                    try:
                        parsed = json.loads(json_str)
                    except json.JSONDecodeError:
                        continue
                    if parsed.get("error"):
                        raise RuntimeError(parsed["error"].get("message") or "Gemini API error")
                    candidates = parsed.get("candidates", [{}])
                    chunk = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
                    if chunk:
                        yield chunk
                    reason = parsed.get("promptFeedback", {}).get("blockReason")
                    finish_reason = candidates[0].get("finishReason")
                    if not reason and finish_reason and finish_reason != "STOP":
                        reason = finish_reason
                    if reason:
                        block_reason = reason

            if block_reason:
                # Only relevant if we never yielded anything — surfaced by caller.
                pass


PROVIDERS = [
    {"name": "Groq", "run": stream_from_groq},
    {"name": "OpenRouter", "run": stream_from_openrouter},
    {"name": "Gemini", "run": stream_from_gemini},
]
