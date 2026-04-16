from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import yt_dlp
import os
import uuid
import json
import asyncio
from urllib.parse import quote
import requests
import zipfile
import shutil
import mimetypes
from typing import Any, Dict, Optional
import re

app = FastAPI(title="SnapClone Professional API")

# --- PROXY CONFIGURATION ---
GLOBAL_PROXY = "http://36.137.90.163:8081" 


# Mount static files for the frontend
app.mount("/static", StaticFiles(directory="static"), name="static")

# Progress storage for SSE
# format: { batch_id: { status: "running", percent: 0, speed: "", eta: "", current_item: 0, total: 0, msg: "" } }
progress_data: Dict[str, dict] = {}
# Get absolute best quality and merge into mp4 container
BEST_VIDEO_FORMAT = "bestvideo+bestaudio/best"
TEMP_DOWNLOAD_SUFFIXES = (".part", ".temp", ".tmp", ".ytdl")


def build_video_ydl_opts(
    *,
    download: bool,
    outtmpl: Optional[str] = None,
    progress_hooks: Optional[list] = None,
    restrict_filenames: bool = False,
) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "format": BEST_VIDEO_FORMAT,
        "merge_output_format": "mp4",
        "http_headers": {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        }
    }
    
    if GLOBAL_PROXY:
        opts["proxy"] = GLOBAL_PROXY

    if download:
        if not outtmpl:
            raise ValueError("outtmpl is required when download=True")
        opts["outtmpl"] = outtmpl
        if progress_hooks:
            opts["progress_hooks"] = progress_hooks
            opts["nocolor"] = True
        if restrict_filenames:
            opts["restrictfilenames"] = True
    else:
        opts["extract_flat"] = False
        opts["skip_download"] = True

    return opts


def is_temp_download_file(filename: str) -> bool:
    return filename.startswith(".") or filename.endswith(TEMP_DOWNLOAD_SUFFIXES)


def find_downloaded_media_file(dl_dir: str, file_id: str, info: dict) -> Optional[str]:
    for key in ("filepath", "_filename"):
        path = info.get(key)
        if path and os.path.exists(path) and not is_temp_download_file(os.path.basename(path)):
            return path

    for requested in info.get("requested_downloads") or []:
        for key in ("filepath", "_filename"):
            path = requested.get(key)
            if path and os.path.exists(path) and not is_temp_download_file(os.path.basename(path)):
                return path

    preferred_exts = []
    if info.get("ext"):
        preferred_exts.append(info["ext"].lstrip("."))
    for requested in info.get("requested_downloads") or []:
        ext = requested.get("ext")
        if ext:
            preferred_exts.append(ext.lstrip("."))

    seen_exts = set()
    for ext in preferred_exts:
        if ext in seen_exts:
            continue
        seen_exts.add(ext)
        candidate = os.path.join(dl_dir, f"{file_id}.{ext}")
        if os.path.exists(candidate):
            return candidate

    prefix = f"{file_id}."
    candidates = []
    for entry in os.scandir(dl_dir):
        if not entry.is_file():
            continue
        if not entry.name.startswith(prefix) or is_temp_download_file(entry.name):
            continue
        candidates.append(entry.path)

    if not candidates:
        return None

    candidates.sort(key=os.path.getmtime, reverse=True)
    return candidates[0]


def build_download_name(title: str, ext: str) -> str:
    safe_title = "".join(ch for ch in title if ch.isalnum() or ch in " -_").strip() or "download"
    return f"{safe_title}{ext.lower()}"


def guess_media_type(path: str) -> str:
    media_type, _ = mimetypes.guess_type(path)
    return media_type or "application/octet-stream"


def media_quality_key(media_format: dict) -> tuple:
    return (
        media_format.get("quality") or -1,
        media_format.get("height") or -1,
        media_format.get("width") or -1,
        media_format.get("fps") or -1,
        media_format.get("tbr") or -1,
        media_format.get("filesize") or media_format.get("filesize_approx") or -1,
    )


def pick_best_stream_url(info_dict: dict) -> str:
    direct_url = info_dict.get("url", "")
    if direct_url and info_dict.get("vcodec") != "none":
        return direct_url

    formats = info_dict.get("formats") or []
    av_formats = [
        fmt for fmt in formats
        if fmt.get("url") and fmt.get("vcodec") != "none" and fmt.get("acodec") != "none"
    ]
    if av_formats:
        return max(av_formats, key=media_quality_key).get("url", "")

    video_formats = [fmt for fmt in formats if fmt.get("url") and fmt.get("vcodec") != "none"]
    if video_formats:
        return max(video_formats, key=media_quality_key).get("url", "")

    return direct_url

@app.get("/api/proxy-image")
async def proxy_image(url: str, download: bool = False):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
        
        # Youtube specific tweak
        if "ytimg.com" in url or "ggpht.com" in url or "youtube.com" in url:
            # Sometimes no referer is better for YT images
            pass
        else:
            if "instagram.com" in url:
                headers['Referer'] = "https://www.instagram.com/"
            elif "facebook.com" in url:
                headers['Referer'] = "https://www.facebook.com/"
            elif "bilibili.com" in url:
                headers['Referer'] = "https://www.bilibili.com/"
            
        resp = requests.get(url, headers=headers, timeout=20, stream=True)
        resp.raise_for_status()
        
        content_type = resp.headers.get('Content-Type', 'image/jpeg')
        headers_to_return = {'Content-Type': content_type}
        
        if download:
            ext = mimetypes.guess_extension(content_type) or ".jpg"
            # Use UTF-8 filename encoding
            filename = "thumbnail" + ext
            headers_to_return['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return StreamingResponse(
            resp.iter_content(chunk_size=8192), 
            headers=headers_to_return
        )
    except Exception as e:
        print(f"Proxy error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

class URLRequest(BaseModel):
    url: str

@app.post("/api/extract")
def extract_media_info(request: URLRequest):
    ydl_opts = build_video_ydl_opts(download=False)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(request.url, download=False)
            title = info_dict.get('title', 'Unknown_Title')
            
            # Find the best thumbnail by width
            thumbnails = info_dict.get('thumbnails', [])
            if thumbnails:
                # Sort by width descending
                best_thumb = sorted(
                    [t for t in thumbnails if t.get('width')], 
                    key=lambda x: x['width'], 
                    reverse=True
                )
                thumbnail = best_thumb[0]['url'] if best_thumb else thumbnails[-1]['url']
            else:
                thumbnail = info_dict.get('thumbnail', '')
            
            direct_url = pick_best_stream_url(info_dict)
            
            return {
                "success": True,
                "title": title,
                "thumbnail": thumbnail,
                "url": direct_url,
                "original_url": request.url
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

def remove_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

def remove_dir(path: str):
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass

@app.get("/api/download")
def download_best_quality(url: str, background_tasks: BackgroundTasks):
    dl_dir = "downloads"
    os.makedirs(dl_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    outtmpl = os.path.join(dl_dir, f"{file_id}.%(ext)s")
    ydl_opts = build_video_ydl_opts(download=True, outtmpl=outtmpl)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = find_downloaded_media_file(dl_dir, file_id, info)
            if not filename:
                raise FileNotFoundError("Downloaded file not found")
            
            title = info.get('title') or info.get('id') or 'download'
            final_ext = os.path.splitext(filename)[1].lower()
            download_name = build_download_name(title, final_ext)
            encoded_title = quote(download_name.encode('utf-8'))
            media_type = guess_media_type(filename)
            
            background_tasks.add_task(remove_file, filename)
            return FileResponse(
                path=filename,
                media_type=media_type,
                headers={'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_title}"}
            )
    except Exception as e:
        return {"success": False, "error": str(e)}

# --- BATCH PROGRESS SSE LOGIC ---

@app.get("/api/progress/{batch_id}")
async def get_progress(batch_id: str):
    async def event_generator():
        while True:
            data = progress_data.get(batch_id)
            if not data:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break
            
            yield f"data: {json.dumps(data)}\n\n"
            
            if data['status'] in ['completed', 'error']:
                # Allow one last send then clean up
                await asyncio.sleep(2)
                if batch_id in progress_data:
                    del progress_data[batch_id]
                break
            await asyncio.sleep(0.5) # Update frequency
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/batch-videos")
async def start_batch_videos(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()
    urls = [line.strip() for line in content.decode('utf-8').splitlines() if line.strip()]
    if not urls: return {"success": False, "error": "No URLs found"}
    
    batch_id = str(uuid.uuid4())
    progress_data[batch_id] = {
        "status": "preparing", "percent": 0, "speed": "0 KB/s", "eta": "--:--",
        "current_item": 0, "total": len(urls), "msg": "Initializing...", "zip_url": None
    }
    
    background_tasks.add_task(run_batch_video_download, batch_id, urls)
    return {"success": True, "batch_id": batch_id}

def run_batch_video_download(batch_id: str, urls: list):
    dl_dir = "downloads"
    os.makedirs(dl_dir, exist_ok=True)
    batch_dir = os.path.join(dl_dir, f"batch_{batch_id}")
    os.makedirs(batch_dir, exist_ok=True)
    zip_path = os.path.join(dl_dir, f"videos_{batch_id}.zip")

    def progress_hook(d):
        if d['status'] == 'downloading':
            # Current video percentage
            downloaded = d.get('downloaded_bytes', 0)
            total = d.get('total_bytes') or d.get('total_bytes_estimate')
            video_percent = (downloaded / total * 100) if total else 0
            
            # Overall batch percentage
            current_idx = progress_data[batch_id]['current_item'] # 1-based
            total_urls = len(urls)
            overall_percent = ((current_idx - 1) / total_urls * 100) + (video_percent / total_urls)
            
            # Helper to strip ANSI escape codes (those "mysterious numbers")
            def clean_str(s):
                if not s: return ""
                return re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])').sub('', s).strip()

            progress_data[batch_id].update({
                "status": "downloading",
                "percent": max(progress_data[batch_id].get("percent", 0), round(overall_percent, 1)),
                "speed": clean_str(d.get('_speed_str', 'N/A')),
                "eta": clean_str(d.get('_eta_str', '--:--')),
                "msg": f"Downloading video {current_idx}/{total_urls}"
            })

    ydl_opts = build_video_ydl_opts(
        download=True,
        outtmpl=os.path.join(batch_dir, '%(title)s_%(id)s.%(ext)s'),
        progress_hooks=[progress_hook],
        restrict_filenames=True,
    )

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            for index, url in enumerate(urls):
                progress_data[batch_id]['current_item'] = index + 1
                progress_data[batch_id]['msg'] = f"Processing {index+1}/{len(urls)}..."
                try:
                    ydl.download([url])
                except: continue
        
        progress_data[batch_id]['status'] = 'zipping'
        progress_data[batch_id]['msg'] = 'Packing files into ZIP...'
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as zipf:
            for root, _, files in os.walk(batch_dir):
                for f in files:
                    if is_temp_download_file(f):
                        continue
                    zipf.write(os.path.join(root, f), f)
        
        progress_data[batch_id].update({
            "status": "completed",
            "percent": 100,
            "msg": "All tasks finished!",
            "zip_url": f"/api/batch-result/{batch_id}"
        })
        remove_dir(batch_dir)
    except Exception as e:
        progress_data[batch_id].update({"status": "error", "msg": str(e)})
        remove_dir(batch_dir)

@app.get("/api/batch-result/{batch_id}")
def get_batch_result(batch_id: str, background_tasks: BackgroundTasks):
    zip_path_v = os.path.join("downloads", f"videos_{batch_id}.zip")
    zip_path_t = os.path.join("downloads", f"thumbnails_{batch_id}.zip")
    zip_path = zip_path_v if os.path.exists(zip_path_v) else zip_path_t
    
    if os.path.exists(zip_path):
        background_tasks.add_task(remove_file, zip_path)
        return FileResponse(zip_path, media_type="application/zip", filename="batch_download.zip")
    raise HTTPException(status_code=404, detail="File not found")

@app.post("/api/batch-thumbnails")
async def start_batch_thumbnails(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    content = await file.read()
    urls = [line.strip() for line in content.decode('utf-8').splitlines() if line.strip()]
    if not urls: return {"success": False, "error": "No URLs found"}
    
    batch_id = str(uuid.uuid4())
    progress_data[batch_id] = {
        "status": "preparing", "percent": 0, "speed": "N/A", "eta": "--:--",
        "current_item": 0, "total": len(urls), "msg": "Initializing...", "zip_url": None
    }
    
    background_tasks.add_task(run_batch_thumbnail_download, batch_id, urls)
    return {"success": True, "batch_id": batch_id}

def run_batch_thumbnail_download(batch_id: str, urls: list):
    dl_dir = "downloads"
    os.makedirs(dl_dir, exist_ok=True)
    zip_path = os.path.join(dl_dir, f"thumbnails_{batch_id}.zip")
    total_urls = len(urls)
    
    try:
        common_opts = {
            'quiet': True, 
            'extract_flat': False,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
            }
        }
        if GLOBAL_PROXY:
            common_opts["proxy"] = GLOBAL_PROXY
            
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            with yt_dlp.YoutubeDL(common_opts) as ydl:
                for index, url in enumerate(urls):
                    current_idx = index + 1
                    progress_data[batch_id].update({
                        "status": "downloading",
                        "current_item": current_idx,
                        "percent": round((index / total_urls) * 100, 1),
                        "msg": f"Fetching thumbnail {current_idx}/{total_urls}..."
                    })
                    try:
                        info = ydl.extract_info(url, download=False)
                        thumbnails = info.get('thumbnails', [])
                        thumb_url = thumbnails[-1]['url'] if thumbnails else info.get('thumbnail')
                        if thumb_url:
                            resp = requests.get(thumb_url, timeout=10)
                            if resp.status_code == 200:
                                ext = thumb_url.split('.')[-1]
                                if len(ext) > 4 or '?' in ext: ext = 'jpg'
                                safe_title = "".join(x for x in info.get('title', 'thumb') if x.isalnum() or x in " -_")
                                zipf.writestr(f"{safe_title}_{index}.{ext}", resp.content)
                    except: continue
        
        progress_data[batch_id].update({
            "status": "completed",
            "percent": 100,
            "msg": "All thumbnails finished!",
            "zip_url": f"/api/batch-result/{batch_id}"
        })
    except Exception as e:
        progress_data[batch_id].update({"status": "error", "msg": str(e)})

/{batch_id}"
        })
    except Exception as e:
        progress_data[batch_id].update({"status": "error", "msg": str(e)})
pdate({"status": "error", "msg": str(e)})
