#!/usr/bin/env python3
"""
SNSHero Studio Anime — 9:16 Vertical YouTube Shorts + Dual (EN + KO) Subtitles Generator

Produces a 1080x1920 (9:16) YouTube Shorts version of an episode from the 16:9 master:
  - Ambient blurred & darkened 9:16 background (gblur=sigma=26, brightness=-0.25, saturation=0.8)
  - Full-width uncropped 16:9 hero video (1080x608) placed at x=0, y=540
  - Clean studio top header overlay (episode tag + EN & KO titles)
  - Burned-in crisp Dual Subtitles (EN white bold + KO warm gold #FFE082 bold) in the
    lower safe zone (y=1195..1480, above YouTube Shorts bottom UI), rendered with Pillow
    using verified macOS Apple SD Gothic Neo so Korean glyphs render with zero tofu boxes
  - Soft subtitle tracks muxed into the MP4 container (eng + kor mov_text)
  - Preserves -14 LUFS 48kHz stereo AAC audio intact
  - Extracts 2 visual QA preview frames, copies outputs to Desktop movie dir, and creates
    symlinks in dist/studio-anime/

Usage:
  python3 scripts/studio_anime/make_shorts_and_ko_sub.py --ep 1
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_COPY_DIR = Path("/Users/dayyoung/Desktop/내문서/movie")
DIST_SYMLINK_DIR = REPO_ROOT / "dist/studio-anime"

APPLE_SD_FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
# Verified AppleSDGothicNeo.ttc indices: 0=Regular, 4=SemiBold, 6=Bold, 14=ExtraBold
FONT_IDX_SEMIBOLD = 4
FONT_IDX_BOLD = 6
FONT_IDX_EXTRABOLD = 14

CANVAS_W = 1080
CANVAS_H = 1920
HERO_W = 1080
HERO_H = 608
HERO_Y = 540
SUB_BOX_Y = 1190
SUB_BOX_H = 310

EPISODE_TITLES_KO: Dict[int, str] = {
    1: "눈보라 아래 두 개의 맹세",
}


@dataclass
class SrtCue:
    index: int
    start_sec: float
    end_sec: float
    text: str
    is_italic: bool = False


def parse_srt_time(ts: str) -> float:
    m = re.match(r"(\d+):(\d+):(\d+),(\d+)", ts.strip())
    if not m:
        raise ValueError(f"Invalid SRT timestamp: {ts}")
    h, mn, s, ms = map(int, m.groups())
    return h * 3600 + mn * 60 + s + ms / 1000.0


def parse_srt(path: Path) -> List[SrtCue]:
    raw = path.read_text(encoding="utf-8").strip()
    blocks = re.split(r"\n\s*\n", raw)
    cues: List[SrtCue] = []
    for blk in blocks:
        lines = [ln.rstrip("\r") for ln in blk.strip().splitlines()]
        if len(lines) < 3:
            continue
        idx = int(lines[0].strip())
        times = lines[1].split("-->")
        start_s = parse_srt_time(times[0])
        end_s = parse_srt_time(times[1])
        body = "\n".join(lines[2:]).strip()
        is_italic = "<i>" in body and "</i>" in body
        clean_body = re.sub(r"</?i>", "", body).strip()
        cues.append(SrtCue(index=idx, start_sec=start_s, end_sec=end_s, text=clean_body, is_italic=is_italic))
    return cues


def load_font(size: int, index: int = FONT_IDX_BOLD) -> ImageFont.FreeTypeFont:
    if not Path(APPLE_SD_FONT_PATH).is_file():
        raise FileNotFoundError(f"Korean font not found: {APPLE_SD_FONT_PATH}")
    return ImageFont.truetype(APPLE_SD_FONT_PATH, size=size, index=index)


def draw_centered_multiline(
    draw: ImageDraw.ImageDraw,
    lines: List[str],
    font: ImageFont.FreeTypeFont,
    y_start: int,
    fill: Tuple[int, int, int, int],
    stroke_fill: Tuple[int, int, int, int] = (0, 0, 0, 240),
    stroke_width: int = 4,
    line_spacing: int = 10,
    canvas_w: int = CANVAS_W,
) -> int:
    y = y_start
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font, stroke_width=stroke_width)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (canvas_w - tw) // 2
        draw.text(
            (x, y),
            line,
            font=font,
            fill=fill,
            stroke_width=stroke_width,
            stroke_fill=stroke_fill,
        )
        y += th + line_spacing
    return y


def wrap_text_to_width(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
    stroke_width: int = 4,
) -> List[str]:
    result: List[str] = []
    for raw_line in text.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        bbox = draw.textbbox((0, 0), raw_line, font=font, stroke_width=stroke_width)
        if (bbox[2] - bbox[0]) <= max_width:
            result.append(raw_line)
            continue
        words = raw_line.split(" ")
        cur = ""
        for w in words:
            cand = f"{cur} {w}".strip()
            cb = draw.textbbox((0, 0), cand, font=font, stroke_width=stroke_width)
            if (cb[2] - cb[0]) <= max_width or not cur:
                cur = cand
            else:
                result.append(cur)
                cur = w
        if cur:
            result.append(cur)
    return result


def render_header_overlay(
    out_path: Path,
    ep_num: int,
    title_en: str,
    title_ko: str,
) -> None:
    """Render full-canvas 1080x1920 transparent RGBA header + subtle hero frame border."""
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Subtle gold hairline accents framing the 1080x608 center video at y=540..1148
    draw.rectangle([0, HERO_Y - 2, CANVAS_W, HERO_Y], fill=(255, 224, 130, 140))
    draw.rectangle([0, HERO_Y + HERO_H, CANVAS_W, HERO_Y + HERO_H + 2], fill=(255, 224, 130, 140))

    # Top header block (y = 330..505)
    font_badge = load_font(30, FONT_IDX_EXTRABOLD)
    font_en = load_font(46, FONT_IDX_EXTRABOLD)
    font_ko = load_font(34, FONT_IDX_BOLD)

    badge_text = f"SNSHERO  ·  EP{ep_num:02d}"
    bb = draw.textbbox((0, 0), badge_text, font=font_badge)
    bw = bb[2] - bb[0]
    bh = bb[3] - bb[1]
    pad_x, pad_y = 26, 10
    bx1 = (CANVAS_W - (bw + pad_x * 2)) // 2
    by1 = 328
    bx2 = bx1 + bw + pad_x * 2
    by2 = by1 + bh + pad_y * 2 + 4
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=8, fill=(14, 18, 28, 200), outline=(255, 224, 130, 180), width=2)
    draw.text((bx1 + pad_x, by1 + pad_y - 2), badge_text, font=font_badge, fill=(255, 224, 130, 255))

    y_next = draw_centered_multiline(
        draw,
        [title_en],
        font=font_en,
        y_start=by2 + 22,
        fill=(255, 255, 255, 255),
        stroke_fill=(0, 0, 0, 235),
        stroke_width=4,
        line_spacing=6,
    )
    draw_centered_multiline(
        draw,
        [title_ko],
        font=font_ko,
        y_start=y_next + 8,
        fill=(255, 224, 130, 245),
        stroke_fill=(0, 0, 0, 235),
        stroke_width=3,
        line_spacing=4,
    )

    img.save(out_path, format="PNG")


def render_dual_subtitle_png(
    out_path: Path,
    en_cue: SrtCue,
    ko_cue: SrtCue,
) -> None:
    """Render one 1080x310 RGBA dual-subtitle card (EN white bold + KO #FFE082 bold)."""
    img = Image.new("RGBA", (CANVAS_W, SUB_BOX_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font_en = load_font(38, FONT_IDX_BOLD)
    font_ko = load_font(40, FONT_IDX_EXTRABOLD)
    max_text_w = CANVAS_W - 120  # 60px margin each side

    en_lines = wrap_text_to_width(draw, en_cue.text, font_en, max_text_w, stroke_width=4)
    ko_lines = wrap_text_to_width(draw, ko_cue.text, font_ko, max_text_w, stroke_width=4)

    # Measure total block height to draw clean translucent backdrop
    en_heights = [draw.textbbox((0, 0), ln, font=font_en, stroke_width=4)[3] - draw.textbbox((0, 0), ln, font=font_en, stroke_width=4)[1] for ln in en_lines]
    ko_heights = [draw.textbbox((0, 0), ln, font=font_ko, stroke_width=4)[3] - draw.textbbox((0, 0), ln, font=font_ko, stroke_width=4)[1] for ln in ko_lines]
    en_widths = [draw.textbbox((0, 0), ln, font=font_en, stroke_width=4)[2] - draw.textbbox((0, 0), ln, font=font_en, stroke_width=4)[0] for ln in en_lines]
    ko_widths = [draw.textbbox((0, 0), ln, font=font_ko, stroke_width=4)[2] - draw.textbbox((0, 0), ln, font=font_ko, stroke_width=4)[0] for ln in ko_lines]

    en_block_h = sum(en_heights) + max(0, len(en_lines) - 1) * 10
    ko_block_h = sum(ko_heights) + max(0, len(ko_lines) - 1) * 10
    gap_between = 22
    total_h = en_block_h + gap_between + ko_block_h
    max_w = max(en_widths + ko_widths + [300])

    pad_x = 36
    pad_y = 22
    box_w = min(CANVAS_W - 56, max_w + pad_x * 2)
    box_h = min(SUB_BOX_H - 12, total_h + pad_y * 2)
    bx1 = (CANVAS_W - box_w) // 2
    by1 = max(6, (SUB_BOX_H - box_h) // 2)
    bx2 = bx1 + box_w
    by2 = by1 + box_h

    draw.rounded_rectangle(
        [bx1, by1, bx2, by2],
        radius=16,
        fill=(10, 12, 18, 172),
        outline=(255, 224, 130, 85),
        width=2,
    )

    en_fill = (232, 240, 255, 255) if en_cue.is_italic else (255, 255, 255, 255)
    ko_fill = (255, 224, 130, 255)  # Warm gold/cream #FFE082

    y_cur = by1 + pad_y
    y_after_en = draw_centered_multiline(
        draw,
        en_lines,
        font=font_en,
        y_start=y_cur,
        fill=en_fill,
        stroke_fill=(0, 0, 0, 240),
        stroke_width=4,
        line_spacing=10,
    )
    draw_centered_multiline(
        draw,
        ko_lines,
        font=font_ko,
        y_start=y_after_en - 10 + gap_between,
        fill=ko_fill,
        stroke_fill=(0, 0, 0, 240),
        stroke_width=4,
        line_spacing=10,
    )

    img.save(out_path, format="PNG")


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
    parser = argparse.ArgumentParser(description="Create 9:16 dual-subtitle YouTube Shorts and KO subtitle artifacts.")
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument("--copy-dir", type=str, default=str(DEFAULT_COPY_DIR), help="Desktop export directory")
    parser.add_argument("--preview-times", type=str, default="20,115", help="Comma-separated seconds for 2 QA preview frames")
    args = parser.parse_args()

    ep_num = args.ep
    ep_dir = REPO_ROOT / f"output/studio_anime/ep{ep_num:02d}_en"
    storyboard_path = ep_dir / f"storyboard_ep{ep_num:02d}_en.json"
    master_16x9 = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_16x9.mp4"
    en_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN.srt"
    ko_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_KO.srt"
    out_shorts = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_KO_Shorts_9x16.mp4"

    for req in (master_16x9, en_srt_path, ko_srt_path):
        if not req.is_file():
            print(f"[ERROR] Required file missing: {req}", file=sys.stderr)
            return 1

    title_en = f"Episode {ep_num}"
    if storyboard_path.is_file():
        sb = json.loads(storyboard_path.read_text(encoding="utf-8"))
        title_en = sb.get("episodeTitleEn", title_en)
    title_ko = EPISODE_TITLES_KO.get(ep_num, f"에피소드 {ep_num}")

    en_cues = parse_srt(en_srt_path)
    ko_cues = parse_srt(ko_srt_path)
    if len(en_cues) != len(ko_cues):
        print(f"[ERROR] Cue count mismatch: EN={len(en_cues)} vs KO={len(ko_cues)}", file=sys.stderr)
        return 1

    print(f"[shorts] Episode EP{ep_num:02d}: {title_en} / {title_ko}")
    print(f"[shorts] Master 16:9: {master_16x9}")
    print(f"[shorts] Dual subtitle cues: {len(en_cues)} (Font: {APPLE_SD_FONT_PATH})")

    tmp_dir = Path(tempfile.mkdtemp(prefix=f"snshero_ep{ep_num:02d}_shorts_"))
    try:
        header_png = tmp_dir / "header_1080x1920.png"
        render_header_overlay(header_png, ep_num, title_en, title_ko)

        sub_pngs: List[Tuple[Path, float, float]] = []
        for en_c, ko_c in zip(en_cues, ko_cues):
            p = tmp_dir / f"sub_{en_c.index:02d}.png"
            render_dual_subtitle_png(p, en_c, ko_c)
            sub_pngs.append((p, en_c.start_sec, en_c.end_sec))

        # Build FFmpeg command:
        #   Input 0: 16:9 master MP4
        #   Input 1: header_1080x1920.png
        #   Inputs 2..2+N-1: dual subtitle PNG overlays
        #   Input 2+N: EN.srt (soft subtitle track 0 = eng)
        #   Input 3+N: KO.srt (soft subtitle track 1 = kor)
        cmd: List[str] = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(master_16x9),
            "-i", str(header_png),
        ]
        for sp, _, _ in sub_pngs:
            cmd.extend(["-i", str(sp)])
        en_srt_idx = 2 + len(sub_pngs)
        ko_srt_idx = en_srt_idx + 1
        cmd.extend(["-i", str(en_srt_path), "-i", str(ko_srt_path)])

        filter_parts: List[str] = [
            # Split video into ambient blurred background + crisp center hero
            "[0:v]split=2[bg_src][fg_src]",
            # Ambient 9:16 blurred darkened background
            f"[bg_src]scale={CANVAS_W}:{CANVAS_H}:force_original_aspect_ratio=increase,"
            f"crop={CANVAS_W}:{CANVAS_H},"
            f"gblur=sigma=26,eq=brightness=-0.25:saturation=0.8,setsar=1[bg]",
            # Center uncropped 16:9 hero video (1080x608)
            f"[fg_src]scale={HERO_W}:{HERO_H}:flags=lanczos,setsar=1[fg]",
            # Compose hero onto background at x=0, y=540
            f"[bg][fg]overlay=0:{HERO_Y}[comp0]",
            # Overlay top header & hero hairline borders
            "[comp0][1:v]overlay=0:0[comp1]",
        ]

        prev_label = "[comp1]"
        for i, (_, st, et) in enumerate(sub_pngs):
            in_idx = 2 + i
            next_label = f"[sub{i}]" if i < len(sub_pngs) - 1 else "[vout]"
            filter_parts.append(
                f"{prev_label}[{in_idx}:v]overlay=0:{SUB_BOX_Y}:enable='between(t,{st:.3f},{et:.3f})'{next_label}"
            )
            prev_label = next_label

        cmd.extend([
            "-filter_complex", ";".join(filter_parts),
            "-map", "[vout]",
            "-map", "0:a:0",
            "-map", f"{en_srt_idx}:0",
            "-map", f"{ko_srt_idx}:0",
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
        ])

        print(f"[shorts] Rendering 1080x1920 9:16 dual-subtitle Shorts to {out_shorts}...")
        subprocess.run(cmd, check=True)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    # Extract 2 visual QA preview frames
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

    # Create symlinks in dist/studio-anime/ (without moving originals)
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
    print(f"[SUCCESS] KO SRT          : {ko_srt_path}")
    print(f"[SUCCESS] Preview Frames  : {[str(p) for p in preview_paths]}")
    print(f"[SUCCESS] Desktop Copies  : {copy_dir / out_shorts.name}, {copy_dir / ko_srt_path.name}")
    print(f"[SUCCESS] Dist Symlinks   : {DIST_SYMLINK_DIR / out_shorts.name}, {DIST_SYMLINK_DIR / ko_srt_path.name}")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    sys.exit(main())
