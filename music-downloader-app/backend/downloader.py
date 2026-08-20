import os
import sys
import subprocess
import glob
import shutil
import zipfile
import uuid
import yt_dlp

BASE_DOWNLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))
os.makedirs(BASE_DOWNLOAD_DIR, exist_ok=True)

def process_download(url: str) -> str:
    """
    MAX-SPEED Download Engine:
    - 8 Concurrent Workers / Fragment Streams
    - Fast 128k audio extraction (drastically reduces file size and encoding time)
    - Zero-CPU ZIP bundling (ZIP_STORED) to eliminate CPU bottleneck on Pentium chips
    """
    job_id = str(uuid.uuid4())[:8]
    job_dir = os.path.join(BASE_DOWNLOAD_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)

    url_lower = url.lower()

    if "spotify.com" in url_lower:
        # Max performance flags for spotdl: 8 threads, 128k bitrate, fast matching
        cmd = [
            sys.executable, "-m", "spotdl",
            "--threads", "8",
            "--bitrate", "128k",
            "--output", job_dir,
            url
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            cmd_fallback = [
                sys.executable, "-m", "spotdl",
                "--threads", "8",
                "--bitrate", "128k",
                url
            ]
            subprocess.run(cmd_fallback, cwd=job_dir, check=True)
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(job_dir, '%(title)s.%(ext)s'),
            'concurrent_fragment_downloads': 8,
            'buffersize': 1024 * 64,
            'http_chunk_size': 10485760,  # 10MB chunks for fast I/O
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128',
            }],
            'quiet': False,
            'no_warnings': True,
            'ignoreerrors': True,  # Keep downloading remaining songs if one fails
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    else:
        raise ValueError("Unsupported platform. Please provide a valid YouTube or Spotify link.")

    # Locate generated mp3 files
    mp3_files = glob.glob(os.path.join(job_dir, "**", "*.mp3"), recursive=True) + glob.glob(os.path.join(job_dir, "*.mp3"))
    mp3_files = list(set(mp3_files))

    if not mp3_files:
        raise RuntimeError("No audio files were generated. Please verify the link and try again.")

    # Single track: Return MP3 directly
    if len(mp3_files) == 1:
        return mp3_files[0]

    # Full playlist: Zero-compression ZIP_STORED (Instant packing without CPU stall)
    zip_path = os.path.join(job_dir, f"playlist_fast_{job_id}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_STORED) as zipf:
        for file in mp3_files:
            zipf.write(file, arcname=os.path.basename(file))

    return zip_path

def cleanup_file_and_parent(file_path: str):
    """Safely cleans up temporary files after delivery."""
    try:
        if os.path.exists(file_path):
            parent_dir = os.path.dirname(file_path)
            if os.path.commonpath([parent_dir, BASE_DOWNLOAD_DIR]) == BASE_DOWNLOAD_DIR and parent_dir != BASE_DOWNLOAD_DIR:
                shutil.rmtree(parent_dir, ignore_errors=True)
            else:
                os.remove(file_path)
    except Exception:
        pass

