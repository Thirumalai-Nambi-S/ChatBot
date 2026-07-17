# Leviathan / Silvy Chatbot — Frontend + Python Backend

This is the same chatbot you had before (plain HTML/CSS/JS UI, Groq → OpenRouter → Gemini
fallback chain, image attachments, chat history sidebar, cursor-trail glow, etc.), just
split into two independent projects that talk to each other over HTTP:

```
chatbot-project/
├── backend/          FastAPI server — owns the API keys, calls Groq/OpenRouter/Gemini
│   ├── app.py
│   ├── providers.py
│   ├── requirements.txt
│   ├── .env            (your real keys — already filled in from your old script.js)
│   └── .env.example
└── frontend/          Plain static site — unchanged UI/UX, no build step
    ├── index.html
    ├── style.css
    ├── script.js
    └── images/
```

## Why split it up this way

In the original single-file version, your Groq/OpenRouter/Gemini API keys were sitting
in plain text inside `script.js` — anyone who opened devtools on the live site could copy
them straight out. Moving the provider calls to a backend fixes that: the browser now only
ever talks to *your* server, and your server holds the real keys.

**Important:** because those keys were already shipped to the browser in the version you
uploaded, treat them as already exposed. I carried them over into `backend/.env` so the
app works immediately, but you should rotate (regenerate) all three keys in the Groq,
OpenRouter, and Google AI Studio dashboards once you're set up, then drop the new ones
into `.env`.

## How it works

1. Frontend collects your message (+ optional image), keeps the same `chatHistory` in
   `localStorage` it always did, and POSTs the whole conversation to the backend:
   `POST /api/chat` with `{ "history": [...] }`.
2. Backend tries **Groq → OpenRouter → Gemini** in order — identical logic to before,
   just server-side now (`backend/providers.py`).
3. Backend streams the reply back as Server-Sent Events (`chunk`, `reset`, `done`, `error`),
   and the frontend paints it into the chat bubble live, word by word — same feel as before.
   If a provider fails partway through, the bubble clears and the next provider takes over,
   exactly like the old fallback behavior.

## Running it locally

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Check it's alive: open http://127.0.0.1:8000/api/health — should return `{"status":"ok"}`.

Your keys already live in `backend/.env`. If you ever need to change them, edit that file
(never commit it — see `.gitignore` note below) using `.env.example` as the template.

### 2. Frontend

The frontend is just static files — no build step, no npm install. Serve it with any
static server, e.g.:

```bash
cd frontend
python -m http.server 5500
```

Then open http://127.0.0.1:5500 in your browser.

(Opening `index.html` directly via `file://` also works with `fetch`, but a real local
server avoids occasional browser quirks with `file://` origins — recommended.)

### 3. Point the frontend at your backend

In `frontend/script.js`, near the top:

```js
const API_BASE_URL = "http://127.0.0.1:8000";
```

Change this if your backend runs on a different port or, later, a real domain once deployed.

## Deploying

- **Backend**: deploy `backend/` anywhere that runs Python (Render, Railway, Fly.io, a VPS
  with `uvicorn`/`gunicorn`, etc.). Set `GROQ_API_KEY`, `OPENROUTER_API_KEY`, and
  `GEMINI_API_KEY` as environment variables on that platform — don't upload `.env` itself.
- **Frontend**: deploy `frontend/` as a static site (Netlify, Vercel, GitHub Pages, S3, etc.).
- Update `API_BASE_URL` in `script.js` to your backend's real URL, and tighten the CORS
  `allow_origins` list in `backend/app.py` from `["*"]` to your actual frontend domain.

## Login / Sign up (Supabase Auth)

The frontend now has email/password auth via Supabase, styled to match the rest of the app:

- `frontend/login.html` — log in
- `frontend/signup.html` — create an account
- `frontend/supabase-client.js` — shared Supabase client (holds the project URL + publishable/anon key)

`index.html` is open to guests — it no longer redirects anyone away. Instead, two separate icon
buttons sit fixed in the top-right corner: **Log in** and **Sign up**, each linking straight to
its own page. Once a session exists, `index.html` swaps those two buttons out for the user's
email address and a **Log out** button, in the same top-right spot (this happens automatically
via `supabaseClient.auth.getSession()` / `onAuthStateChange()` on page load). `login.html` and
`signup.html` each also have a back arrow (top-left) to return to the chat without logging in.

**Note on the Supabase key:** the "publishable" key in `supabase-client.js` is meant to be
public — it's not a secret like the Groq/OpenRouter/Gemini keys in `backend/.env`. Supabase's
Row Level Security policies (configured in your Supabase dashboard) are what actually protect
your data, not keeping this key hidden.

**Email confirmation:** by default, a new Supabase project requires users to click a
confirmation link in their email before they can log in. `signup.html` handles both cases
(instant session vs. "check your email"). You can turn confirmation off in
Supabase → Authentication → Providers → Email if you want signups to log straight in.

**Heads up:** right now the FastAPI backend (`/api/chat`) doesn't check who's calling it —
the Supabase login only gates the *frontend page*, not the API itself. Anyone who finds your
backend URL could call `/api/chat` directly. If you want the backend to actually require a
logged-in Supabase user, that's a follow-up (verifying the Supabase JWT on each request) —
just ask if you'd like that added.

## What stayed exactly the same

- All UI/UX: theme toggle, sidebar chat history, markdown rendering, image attachments,
  suggestion cards, cursor-trail glow, stop-generating button.
- Chat sessions still live in the browser's `localStorage` — the backend is stateless and
  has no database; it only proxies a single request/response per turn.
- The custom scripted replies (`getCustomReply` in `script.js`) still run entirely in the
  browser, same as before — only real AI calls go through the backend.
- Same provider order and same "only fall back on actual failure" behavior.

## .gitignore reminder

If you put this in git, ignore the real `.env`:

```
backend/.env
backend/venv/
backend/__pycache__/
```
