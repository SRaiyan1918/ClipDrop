# 📥 ClipDrop — Full Stack Video Downloader

React (Vite) + FastAPI + yt-dlp

---

## 🗂 Project Structure

```
clipdrop/
├── backend/
│   ├── main.py           ← FastAPI server
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── index.css
```

---

## 🚀 Run Locally

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## ☁️ Deploy Free

### Backend → Render.com (Free)
1. GitHub pe push karo
2. render.com → New Web Service
3. Root: `backend/`
4. Build: `pip install -r requirements.txt`
5. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend → Vercel (Free)
1. vercel.com → Import repo
2. Root: `frontend/`
3. Framework: Vite
4. Env var: `VITE_API_URL=https://your-render-url.onrender.com`

---

## ✅ Features
- YouTube, Instagram, TikTok, Twitter, Facebook, Vimeo + 1000 sites
- Video quality: Best, 1080p, 720p, 480p
- Audio MP3 extraction
- Playlist support
- Live progress bar
- Video preview (title, thumbnail, duration)
- Dark cyber UI
