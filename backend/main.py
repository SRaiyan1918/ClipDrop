"""
ClipDrop Backend — FastAPI + yt-dlp
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import yt_dlp
import uuid
import os
import asyncio
import json
from typing import Optional
from collections import defaultdict

app = FastAPI(title="ClipDrop API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = "/tmp/clipdrop"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# In-memory job store
jobs: dict = {}

# ── Models ────────────────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"          # best | 1080 | 720 | 480 | audio
    format: str = "video"          # video | audio | playlist

class InfoRequest(BaseModel):
    url: str

# ── Quality Map ───────────────────────────────────────────────────────────────

QUALITY_MAP = {
    "best":  "bestvideo+bestaudio/best",
    "1080":  "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720":   "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480":   "bestvideo[height<=480]+bestaudio/best[height<=480]",
    "audio": "bestaudio/best",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_ydl_opts(job_id: str, request: DownloadRequest) -> dict:
    is_audio    = request.format == "audio" or request.quality == "audio"
    is_playlist = request.format == "playlist"
    fmt         = QUALITY_MAP.get(request.quality, "bestvideo+bestaudio/best")

    if is_playlist:
        tmpl = os.path.join(DOWNLOAD_DIR, job_id,
                            "%(playlist_title)s/%(playlist_index)s - %(title)s.%(ext)s")
    else:
        tmpl = os.path.join(DOWNLOAD_DIR, job_id, "%(title)s.%(ext)s")

    opts = {
        "outtmpl": tmpl,
        "format": "bestaudio/best" if is_audio else fmt,
        "noplaylist": not is_playlist,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "progress_hooks": [lambda d: _progress_hook(d, job_id)],
    }

    if not is_playlist:
        opts["merge_output_format"] = "mp4"

    if is_audio:
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }]

    return opts

def _progress_hook(d: dict, job_id: str):
    if job_id not in jobs:
        return
    if d["status"] == "downloading":
        jobs[job_id]["progress"] = float(
            d.get("_percent_str", "0%").strip().replace("%", "") or 0)
        jobs[job_id]["speed"]    = d.get("_speed_str", "")
        jobs[job_id]["eta"]      = d.get("_eta_str", "")
        jobs[job_id]["status"]   = "downloading"
    elif d["status"] == "finished":
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"]   = "processing"

def _do_download(job_id: str, request: DownloadRequest):
    try:
        out_dir = os.path.join(DOWNLOAD_DIR, job_id)
        os.makedirs(out_dir, exist_ok=True)
        opts = get_ydl_opts(job_id, request)

        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([request.url])

        # Find downloaded file(s)
        files = []
        for root, _, fnames in os.walk(out_dir):
            for f in fnames:
                files.append(os.path.join(root, f))

        jobs[job_id]["status"] = "done"
        jobs[job_id]["files"]  = files
        jobs[job_id]["progress"] = 100

    except yt_dlp.utils.DownloadError as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"app": "ClipDrop", "status": "running"}

@app.post("/info")
def get_info(req: InfoRequest):
    """Fetch video metadata without downloading."""
    try:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "nocheckcertificate": True,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
            return {
                "title":     info.get("title", "Unknown"),
                "uploader":  info.get("uploader", "Unknown"),
                "duration":  info.get("duration", 0),
                "thumbnail": info.get("thumbnail", ""),
                "platform":  info.get("extractor_key", "Unknown"),
                "view_count":info.get("view_count", 0),
                "is_playlist": info.get("_type") == "playlist",
                "entries_count": len(info.get("entries", [])) if info.get("_type") == "playlist" else 1,
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/download")
def start_download(req: DownloadRequest, bg: BackgroundTasks):
    """Start async download job, returns job_id."""
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "speed": "",
        "eta": "",
        "files": [],
        "error": "",
        "url": req.url,
    }
    bg.add_task(_do_download, job_id, req)
    return {"job_id": job_id}

@app.get("/status/{job_id}")
def job_status(job_id: str):
    """Poll job progress."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/file/{job_id}")
def download_file(job_id: str):
    """Stream the downloaded file to browser."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    job = jobs[job_id]
    if job["status"] != "done" or not job["files"]:
        raise HTTPException(status_code=400, detail="File not ready")
    filepath = job["files"][0]
    filename = os.path.basename(filepath)
    return FileResponse(
        filepath,
        media_type="application/octet-stream",
        filename=filename,
    )

@app.delete("/job/{job_id}")
def cleanup_job(job_id: str):
    """Cleanup job files."""
    if job_id in jobs:
        import shutil
        out_dir = os.path.join(DOWNLOAD_DIR, job_id)
        if os.path.exists(out_dir):
            shutil.rmtree(out_dir)
        del jobs[job_id]
    return {"deleted": job_id}
