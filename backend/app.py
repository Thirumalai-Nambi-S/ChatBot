"""
FastAPI backend for the Leviathan / Silvy chatbot.

Keeps the exact same provider fallback chain as the original client-side
script.js (Groq -> OpenRouter -> Gemini), but now the API keys live on the
server instead of in the browser. Streams the reply back to the frontend
over Server-Sent Events so the UI can keep painting text live, word by word,
exactly like before.
"""
import json

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from providers import PROVIDERS

app = FastAPI(title="Leviathan Chatbot API")

# Wide-open CORS for local/dev use since the frontend is now a separate
# static project (possibly served from file://, a different port, or a
# different host). Tighten this to your real frontend origin in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(request: Request):
    """
    Body: { "history": [ {"role": "user"|"model", "parts": [{"text": "..."}, {"inline_data": {...}}]} , ... ] }
    The last entry in `history` is the new user turn (mirrors chatHistory in script.js).

    Response: text/event-stream with events:
      - chunk : {"text": "..."}        one piece of streamed text
      - reset : {}                     a provider failed mid-stream; frontend should clear the bubble and keep waiting
      - done  : {"text": "...", "provider": "Groq"}   final full text + which provider answered
      - error : {"message": "..."}     every provider failed
    """
    body = await request.json()
    history = body.get("history", [])

    async def event_stream():
        errors = []
        for provider in PROVIDERS:
            full_text = ""
            try:
                async for chunk in provider["run"](history):
                    full_text += chunk
                    yield sse("chunk", {"text": chunk})

                if full_text:
                    yield sse("done", {"text": full_text, "provider": provider["name"]})
                    return
                else:
                    raise RuntimeError(f"{provider['name']} returned an empty response.")
            except Exception as exc:
                errors.append(f"{provider['name']}: {exc}")
                if full_text:
                    # We already streamed partial text to the client from this
                    # provider before it failed — tell the frontend to clear
                    # the bubble before the next provider starts from scratch.
                    yield sse("reset", {})
                continue

        yield sse("error", {"message": "All providers failed — " + " | ".join(errors)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
