# 🤖 ChatBot v2 — AI-Powered Multi-Provider Conversational Assistant

<p align="center">

![Version](https://img.shields.io/badge/Version-v2.0-blue)
![Python](https://img.shields.io/badge/Python-3.10+-yellow)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green)
![HTML5](https://img.shields.io/badge/Frontend-HTML5-orange)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

</p>

---

## 📌 Overview

**ChatBot v2** is the complete redesign of my original chatbot application.

Version 2 introduces a secure Python backend, multi-provider AI support, user authentication, streaming responses, improved UI, and a scalable architecture while maintaining the smooth user experience from Version 1.

Unlike Version 1, where AI API keys were exposed inside frontend JavaScript, Version 2 securely stores all AI providers on the backend using FastAPI.

---

# 🚀 What's New in Version 2

### 🔥 New Architecture

- FastAPI Backend
- Static Frontend
- Secure API communication
- Environment-based configuration
- Scalable project structure

---

### 🤖 AI Providers

Supports automatic fallback between multiple LLM providers.

Provider Order:

```
Groq
   ↓
OpenRouter
   ↓
Google Gemini
```

If one provider fails, the chatbot automatically switches to the next provider without interrupting the conversation.

---

### 🔐 Authentication

Integrated with **Supabase Authentication**

Features:

- Email Signup
- Email Login
- Session Management
- Logout
- Authentication State Detection

---

### 💬 Chat Features

- Real-time AI Responses
- Streaming Text Generation
- Markdown Rendering
- Image Upload Support
- Chat History
- Local Storage Sessions
- Stop Generation Button
- AI Suggestions

---

### 🎨 User Interface

- Responsive Design
- Dark Mode
- Modern Chat Layout
- Cursor Glow Effect
- Animated Interface
- Mobile Friendly

---

## 📁 Project Structure

```
ChatBot/

│
├── backend/
│   ├── app.py
│   ├── providers.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .env (ignored)
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── style.css
│   ├── script.js
│   ├── supabase-client.js
│   └── images/
│
├── README.md
└── LICENSE
```

---

# 🛠 Tech Stack

## Frontend

- HTML5
- CSS3
- JavaScript (ES6)

---

## Backend

- Python
- FastAPI
- Uvicorn

---

## Authentication

- Supabase Auth

---

## AI Providers

- Groq
- OpenRouter
- Google Gemini

---

## Deployment

Frontend

- Netlify
- Vercel
- GitHub Pages

Backend

- Render
- Railway
- Fly.io
- VPS

---

# ⚙️ Installation

## 1 Clone Repository

```bash
git clone https://github.com/Thirumalai-Nambi-S/ChatBot.git

cd ChatBot
```

---

## 2 Backend Setup

Navigate to backend

```bash
cd backend
```

Create virtual environment

### Windows

```bash
python -m venv venv

venv\Scripts\activate
```

### macOS/Linux

```bash
python3 -m venv venv

source venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

---

## 3 Environment Variables

Create

```
backend/.env
```

Example

```env
GROQ_API_KEY=YOUR_GROQ_KEY

OPENROUTER_API_KEY=YOUR_OPENROUTER_KEY

GEMINI_API_KEY=YOUR_GEMINI_KEY
```

Never upload this file.

---

## 4 Start Backend

```bash
uvicorn app:app --reload --port 8000
```

Backend URL

```
http://127.0.0.1:8000
```

Health Check

```
http://127.0.0.1:8000/api/health
```

---

## 5 Frontend

Open another terminal

```bash
cd frontend

python -m http.server 5500
```

Visit

```
http://127.0.0.1:5500
```

---

# 🔑 Supabase Setup

Create a project in Supabase.

Enable Email Authentication.

Copy

- Project URL

- Publishable (Anon) Key

Paste them into

```
frontend/supabase-client.js
```

Example

```javascript
const SUPABASE_URL = "YOUR_PROJECT_URL";

const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
```

---

# 🌐 Deployment

## Backend

Deploy

```
backend/
```

to

- Render

or

- Railway

Set environment variables

```
GROQ_API_KEY

OPENROUTER_API_KEY

GEMINI_API_KEY
```

---

## Frontend

Deploy

```
frontend/
```

to

- Netlify

or

- Vercel

Update

```
API_BASE_URL
```

inside

```
script.js
```

---

# 📷 Screenshots

Add screenshots here.

Example

```
screenshots/

home.png

login.png

signup.png

chat.png
```

---

# 🔄 Version History

## Version 2.0 (Current)

- Complete project redesign
- FastAPI backend
- Secure API architecture
- Supabase Authentication
- Streaming responses
- Multi-provider AI fallback
- Improved UI
- Better project structure
- Environment variables
- Production-ready architecture

---

## Version 1.0

- Static HTML/CSS/JavaScript chatbot
- Frontend-only implementation
- Direct AI API integration
- Basic conversational interface

---

# 🔒 Security

This project follows security best practices.

- API keys are stored in environment variables.
- `.env` is excluded from Git.
- Secrets are never committed.
- Authentication handled through Supabase.

---

# 📈 Future Improvements

- Voice Chat
- File Upload Analysis
- Database Chat History
- User Profiles
- Conversation Export
- AI Agent Selection
- Admin Dashboard
- Mobile App
- Docker Support
- CI/CD Pipeline

---

# 👨‍💻 Author

**Thirumalai Nambi S**

Final Year Artificial Intelligence & Data Science Student

Aspiring AI Engineer • Data Scientist • Full Stack Developer

GitHub

https://github.com/Thirumalai-Nambi-S

---

# 📄 License

This project is licensed under the MIT License.

---

# ⭐ Support

If you found this project useful,

⭐ Star the repository

🍴 Fork it

🛠 Contribute

📢 Share it

---

## Version

Current Release

**ChatBot v2.0**