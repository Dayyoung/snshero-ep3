#!/usr/bin/env python3
"""
SNSHero Studio Anime — Full-Bleed 9:16 Vertical YouTube Shorts + Soft Dual Subtitles (EN + KO)

Produces a 100% full-bleed 1080x1920 (9:16) YouTube Shorts version of an episode from the 16:9 master:
  - Full-screen 9:16 center crop (zero top/bottom padding or blur bars):
      scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1
  - ZERO on-screen text (no header, no burned-in subtitles — 100% clean anime visuals)
  - Soft subtitle tracks muxed into the MP4 container (EN.srt as eng + KO.srt as kor, mov_text)
  - Preserves -14 LUFS 48kHz stereo AAC audio intact (-c:a copy)
  - Extracts visual QA preview frames, copies outputs to Desktop movie dir, and maintains
    symlinks in dist/studio-anime/

Usage:
  python3 scripts/studio_anime/make_shorts_and_ko_sub.py --ep 1
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_COPY_DIR = Path("/Users/dayyoung/Desktop/내문서/movie")
DIST_SYMLINK_DIR = REPO_ROOT / "dist/studio-anime"

CANVAS_W = 1080
CANVAS_H = 1920


def probe_video(path: Path) -> Dict:
    res = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    return json.loads(res.stdout)


def create_symlink_force(target: Path, link_path: Path) -> None:
    link_path.parent.mkdir(parents=True, exist_ok=True)
    if link_path.is_symlink() or link_path.exists():
        link_path.unlink()
    link_path.symlink_to(target.resolve())


def main() -> int:
    parser = argparse.ArgumentParser(description="Create full-bleed 9:16 text-free YouTube Shorts with soft EN+KO subtitles.")
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument("--copy-dir", type=str, default=str(DEFAULT_COPY_DIR), help="Desktop export directory")
    parser.add_argument("--preview-times", type=str, default="20,115", help="Comma-separated seconds for QA preview frames")
    args = parser.parse_args()

    ep_num = args.ep
    ep_dir = REPO_ROOT / f"output/studio_anime/ep{ep_num:02d}_en"
    master_16x9 = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_16x9.mp4"
    en_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN.srt"
    ko_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_KO.srt"
    out_shorts = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_KO_Shorts_9x16.mp4"

    for req in (master_16x9, en_srt_path, ko_srt_path):
        if not req.is_file():
            print(f"[ERROR] Required file missing: {req}", file=sys.stderr)
            return 1

    print(f"[shorts] Episode EP{ep_num:02d}: Full-bleed {CANVAS_W}x{CANVAS_H} (9:16), ZERO on-screen text, soft EN+KO subtitles")
    print(f"[shorts] Master 16:9: {master_16x9}")

    vf = f"scale={CANVAS_W}:{CANVAS_H}:force_original_aspect_ratio=increase:flags=lanczos,crop={CANVAS_W}:{CANVAS_H},setsar=1"

    cmd: List[str] = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(master_16x9),
        "-i", str(en_srt_path),
        "-i", str(ko_srt_path),
        "-map", "0:v:0",
        "-map", "0:a:0",
        "-map", "1:0",
        "-map", "2:0",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", "24",
        "-c:a", "copy",
        "-c:s", "mov_text",
        "-metadata:s:s:0", "language=eng",
        "-metadata:s:s:0", "title=English",
        "-metadata:s:s:1", "language=kor",
        "-metadata:s:s:1", "title=Korean",
        "-movflags", "+faststart",
        str(out_shorts),
    ]

    print(f"[shorts] Rendering full-bleed 9:16 Shorts to {out_shorts}...")
    subprocess.run(cmd, check=True)

    # Extract visual QA preview frames
    preview_secs = [float(x.strip()) for x in args.preview_times.split(",") if x.strip()]
    preview_paths: List[Path] = []
    for idx, sec in enumerate(preview_secs, 1):
        p_out = ep_dir / f"shorts_preview_{idx}.png"
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-ss", f"{sec:.2f}",
                "-i", str(out_shorts),
                "-frames:v", "1",
                str(p_out),
            ],
            check=True,
        )
        preview_paths.append(p_out)

    # Copy to Desktop movie directory
    copy_dir = Path(args.copy_dir).expanduser()
    copy_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ko_srt_path, copy_dir / ko_srt_path.name)
    shutil.copy2(out_shorts, copy_dir / out_shorts.name)

    # Ensure symlinks in dist/studio-anime/ point to the originals
    create_symlink_force(ko_srt_path, DIST_SYMLINK_DIR / ko_srt_path.name)
    create_symlink_force(out_shorts, DIST_SYMLINK_DIR / out_shorts.name)

    # Probe final output
    info = probe_video(out_shorts)
    dur = float(info["format"]["duration"])
    size_bytes = out_shorts.stat().st_size
    v_stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    a_stream = next(s for s in info["streams"] if s["codec_type"] == "audio")
    s_streams = [s for s in info["streams"] if s["codec_type"] == "subtitle"]

    print("=" * 68)
    print(f"[SUCCESS] 9:16 Shorts MP4 : {out_shorts}")
    print(f"[SUCCESS] Resolution      : {v_stream['width']}x{v_stream['height']} @{v_stream['r_frame_rate']} ({v_stream['codec_name']}/{v_stream['pix_fmt']})")
    print(f"[SUCCESS] Audio           : {a_stream['codec_name']} {a_stream['sample_rate']}Hz {a_stream['channels']}ch")
    print(f"[SUCCESS] Soft Subtitles  : {len(s_streams)} tracks ({[s.get('tags', {}).get('language') for s in s_streams]})")
    print(f"[SUCCESS] Duration / Size : {dur:.2f}s | {size_bytes / (1024 * 1024):.2f} MB ({size_bytes:,} bytes)")
    print(f"[SUCCESS] Preview Frames  : {[str(p) for p in preview_paths]}")
    print(f"[SUCCESS] Desktop Copies  : {copy_dir / out_shorts.name}, {copy_dir / ko_srt_path.name}")
    print(f"[SUCCESS] Dist Symlinks   : {DIST_SYMLINK_DIR / out_shorts.name}, {DIST_SYMLINK_DIR / ko_srt_path.name}")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    sys.exit(main())
