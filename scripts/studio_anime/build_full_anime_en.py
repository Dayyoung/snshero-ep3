#!/usr/bin/env python3
"""
SNSHero Full-Length English Feature Animation Builder (EP01 - EP40)
Combines all 40 English 16:9 anime episodes with:
  1. Cinematic Intro:
     - Orchestral BGM (collection.mp3 crossfaded & loudnormed to -14 LUFS)
     - Opening title card with SNSHero English brand logo
     - 12 Major Novel Character introduction cards (Ken Burns artwork + sharp serif typography)
     - Closing Intro Production & IP License card (SNSHero.com)
  2. Context-Aware Episode Transitions (all 40 episode boundaries):
     - Location change -> Black interstitial title card with location & optional time-skip
     - Same location + time passage -> Black interstitial card ("Moments later...", etc.)
     - Same location + continuous action -> Smooth 0.6s video/audio xfade bridge
  3. Cinematic Ending:
     - Orchestral BGM (collection.mp3 crossfaded & loudnormed to -14 LUFS)
     - Epilogue title card ("THE END")
     - 14-cut crossfading montage of Kadan, Silia & companions across the 40-episode journey
     - Final Production & IP License card (SNSHero.com)
  4. Unified Master Subtitle (.srt) & Chapters Metadata (.json)

Usage:
  python3 scripts/studio_anime/build_full_anime_en.py
  python3 scripts/studio_anime/build_full_anime_en.py --force-rebuild
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[2]
STUDIO_DIR = REPO_ROOT / "output/studio_anime"
WORK_DIR = STUDIO_DIR / "_full_anime_en_build"
FINAL_MP4 = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4"
FINAL_SRT = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN.srt"
FINAL_CHAPTERS = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN_chapters.json"

LOGO_EN_PATH = REPO_ROOT / "public/hs-assets/brand/logo-en.webp"
BGM_PATH = REPO_ROOT / "public/hs-assets/snshero-audio/bgm/collection.mp3"

WIDTH = 1280
HEIGHT = 720
FPS = 24
XFADE_SEC = 0.65
DIRECT_XFADE_SEC = 0.60

FONT_SERIF_REG = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FONT_SERIF_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SERIF_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
FONT_BASKERVILLE = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
FONT_SANS = "/System/Library/Fonts/Avenir Next.ttc"


# ---------------------------------------------------------------------------
# Cast & Montage Definitions (all keyframes visually verified)
# ---------------------------------------------------------------------------

INTRO_CHARACTERS: List[Dict[str, str]] = [
    {
        "name": "KADAN",
        "role": "The Star-Breathing Swordsman",
        "image": "output/studio_anime/ep08_en/keyframes/EP08-CUT07_keyframe.png",
    },
    {
        "name": "SILIA",
        "role": "Heir of the Whispering Wind",
        "image": "output/studio_anime/ep08_en/keyframes/EP08-CUT20_keyframe.png",
    },
    {
        "name": "IGNIS",
        "role": "Commander of the White Flame",
        "image": "output/studio_anime/ep10_en/keyframes/EP10-CUT19_keyframe.png",
    },
    {
        "name": "RONDOL",
        "role": "Exiled Guardian of Mist Lake",
        "image": "output/studio_anime/ep16_en/keyframes/EP16-CUT22_keyframe.png",
    },
    {
        "name": "GRIMLI",
        "role": "Master Forgemaster of the Six",
        "image": "output/studio_anime/ep03_en/keyframes/EP03-CUT21_keyframe.png",
    },
    {
        "name": "GAWAIN",
        "role": "Sentinel of the Six Masters",
        "image": "output/studio_anime/ep02_en/keyframes/EP02-CUT17_keyframe.png",
    },
    {
        "name": "AILA",
        "role": "Shadow Archer of the Frontier",
        "image": "output/studio_anime/ep02_en/keyframes/EP02-CUT18_keyframe.png",
    },
    {
        "name": "ELIANA",
        "role": "Blade of the Northern Oath",
        "image": "output/studio_anime/ep03_en/keyframes/EP03-CUT02_keyframe.png",
    },
    {
        "name": "BALIAN",
        "role": "Fallen Paladin of the Silver Dagger",
        "image": "output/studio_anime/ep11_en/keyframes/EP11-CUT18_keyframe.png",
    },
    {
        "name": "HERCUL",
        "role": "Fugitive Knight of the Vow",
        "image": "output/studio_anime/ep01_en/keyframes/EP01-CUT04_keyframe.png",
    },
    {
        "name": "LEONAR",
        "role": "Master of the Jade Staff",
        "image": "output/studio_anime/ep13_en/keyframes/EP13-CUT18_keyframe.png",
    },
    {
        "name": "LUCIAN",
        "role": "High Chancellor of the Nine Shadows",
        "image": "output/studio_anime/ep10_en/keyframes/EP10-CUT06_keyframe.png",
    },
]

ENDING_MONTAGE: List[Dict[str, str]] = [
    {
        "caption": "Aleksandar — The Silver Dagger's Vow",
        "image": "output/studio_anime/ep01_en/keyframes/EP01-CUT08_keyframe.png",
    },
    {
        "caption": "Elwin — Mother of the Northern Frontier",
        "image": "output/studio_anime/ep01_en/keyframes/EP01-CUT21_keyframe.png",
    },
    {
        "caption": "A Childhood Forged in Winter Snow",
        "image": "output/studio_anime/ep04_en/keyframes/EP04-CUT02_keyframe.png",
    },
    {
        "caption": "King Fenrir — Sovereign of the Steppe",
        "image": "output/studio_anime/ep07_en/keyframes/EP07-CUT10_keyframe.png",
    },
    {
        "caption": "Paths Crossed Beneath Lighthaven's Dawn",
        "image": "output/studio_anime/ep10_en/keyframes/EP10-CUT23_keyframe.png",
    },
    {
        "caption": "Allies Bound by Mist and Steel",
        "image": "output/studio_anime/ep14_en/keyframes/EP14-CUT09_keyframe.png",
    },
    {
        "caption": "Leonar — Guardian of the Ancient Sanctum",
        "image": "output/studio_anime/ep14_en/keyframes/EP14-CUT03_keyframe.png",
    },
    {
        "caption": "Rondol — Captain of the Breeze Wing",
        "image": "output/studio_anime/ep17_en/keyframes/EP17-CUT07_keyframe.png",
    },
    {
        "caption": "Ignis — A Promise Kept in White Flame",
        "image": "output/studio_anime/ep27_en/keyframes/EP27-CUT08_keyframe.png",
    },
    {
        "caption": "Silia — The Wind That Refused a Crown",
        "image": "output/studio_anime/ep29_en/keyframes/EP29-CUT05_keyframe.png",
    },
    {
        "caption": "The Six Masters — Pillars of the Realm",
        "image": "output/studio_anime/ep34_en/keyframes/EP34-CUT10_keyframe.png",
    },
    {
        "caption": "One Final Toast with Old Companions",
        "image": "output/studio_anime/ep40_en/keyframes/EP40-CUT11_keyframe.png",
    },
    {
        "caption": "Returning Home to the Elwin Valley",
        "image": "output/studio_anime/ep40_en/keyframes/EP40-CUT18_keyframe.png",
    },
    {
        "caption": "Kadan & Silia — A World Worth Protecting",
        "image": "output/studio_anime/ep40_en/keyframes/EP40-CUT24_keyframe.png",
    },
]


# ---------------------------------------------------------------------------
# 40 Episode Transition Rules
#   kind: "location" | "time" | "direct"
# ---------------------------------------------------------------------------

EPISODE_TRANSITIONS: Dict[int, Dict[str, str]] = {
    1:  {"kind": "location", "eyebrow": "PROLOGUE · LOCATION", "title": "Elwin Village · Northern Frontier", "subtitle": "Beneath the Lighthaven Mountains"},
    2:  {"kind": "location", "eyebrow": "AFTER THE BLIZZARD", "title": "Ruins of Elwin Village", "subtitle": ""},
    3:  {"kind": "location", "eyebrow": "LOCATION", "title": "Mistfall Cliff", "subtitle": "Gateway to the Northern Wastes"},
    4:  {"kind": "location", "eyebrow": "SIX WINTERS LATER", "title": "Northern Steppe · Nomad Encampment", "subtitle": ""},
    5:  {"kind": "location", "eyebrow": "YEARS LATER", "title": "Northern Wildlands · Basalt Canyon", "subtitle": ""},
    6:  {"kind": "location", "eyebrow": "THREE YEARS LATER", "title": "Frozen Training Plateau", "subtitle": "Northern Wildlands"},
    7:  {"kind": "location", "eyebrow": "THREE YEARS LATER", "title": "Abandoned Cobalt Quarry", "subtitle": "Northern Steppe Frontier"},
    8:  {"kind": "location", "eyebrow": "JOURNEYING SOUTH", "title": "Southern Frontier Border Town", "subtitle": ""},
    9:  {"kind": "direct"},
    10: {"kind": "location", "eyebrow": "LOCATION", "title": "The Red Glass Palace · Lighthaven", "subtitle": ""},
    11: {"kind": "location", "eyebrow": "LOCATION", "title": "Subterranean Labor Prison No. 7", "subtitle": "Beneath Lighthaven"},
    12: {"kind": "time",     "title": "Moments later..."},
    13: {"kind": "location", "eyebrow": "HEADING EAST", "title": "Coastal Cedar Mountain Track", "subtitle": "Toward Whispering Wind Island"},
    14: {"kind": "direct"},
    15: {"kind": "time",     "title": "Later that night..."},
    16: {"kind": "time",     "title": "The following night..."},
    17: {"kind": "direct"},
    18: {"kind": "location", "eyebrow": "LOCATION", "title": "The Black Sanctum", "subtitle": "Beneath Whispering Wind Island"},
    19: {"kind": "location", "eyebrow": "LOCATION", "title": "The Sky Altar", "subtitle": "Summit of Whispering Wind Island"},
    20: {"kind": "direct"},
    21: {"kind": "location", "eyebrow": "ACROSS THE WESTERN SEA", "title": "Ruins of Seven Bridges Haven", "subtitle": ""},
    22: {"kind": "location", "eyebrow": "LOCATION", "title": "Siren Strait", "subtitle": ""},
    23: {"kind": "location", "eyebrow": "LOCATION", "title": "Mount Dragonhorn · Sea Cliffs", "subtitle": ""},
    24: {"kind": "direct"},
    25: {"kind": "location", "eyebrow": "RETURN TO THE CAPITAL", "title": "Grand Cathedral of Lighthaven", "subtitle": ""},
    26: {"kind": "location", "eyebrow": "LOCATION", "title": "Inner Palace Gates · Lighthaven", "subtitle": ""},
    27: {"kind": "time",     "title": "Moments later..."},
    28: {"kind": "location", "eyebrow": "AT MIDNIGHT", "title": "The Jade Council Hall", "subtitle": "Lighthaven Citadel"},
    29: {"kind": "location", "eyebrow": "THE NEXT MORNING", "title": "Lighthaven Palace Courtyard", "subtitle": ""},
    30: {"kind": "location", "eyebrow": "INTO THE BLACK MARSH", "title": "Fortress of the Four Gates", "subtitle": ""},
    31: {"kind": "location", "eyebrow": "LOCATION", "title": "The Quicksand River", "subtitle": "Approaching Lucian's Citadel"},
    32: {"kind": "location", "eyebrow": "LOCATION", "title": "The Silver Willow Garden", "subtitle": "Heart of the Black Marsh"},
    33: {"kind": "direct"},
    34: {"kind": "direct"},
    35: {"kind": "location", "eyebrow": "LOCATION", "title": "The Phantasm Colonnade", "subtitle": "High Above the Citadel Abyss"},
    36: {"kind": "location", "eyebrow": "LOCATION", "title": "The Starlight Archives", "subtitle": "Summit of the Black Citadel"},
    37: {"kind": "location", "eyebrow": "LOCATION", "title": "Lower Bastions · The Black Citadel", "subtitle": ""},
    38: {"kind": "direct"},
    39: {"kind": "time",     "title": "At daybreak..."},
    40: {"kind": "location", "eyebrow": "ONE MONTH LATER", "title": "Imperial Capital of Lighthaven", "subtitle": ""},
}


# ---------------------------------------------------------------------------
# Subprocess & Media Helpers
# ---------------------------------------------------------------------------

def run_cmd(cmd: List[str], capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    if capture:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return subprocess.run(cmd, check=check)


def probe_media(path: Path) -> Dict[str, Any]:
    out = run_cmd(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture=True,
        check=True,
    ).stdout
    return json.loads(out)


def get_duration(path: Path) -> float:
    info = probe_media(path)
    return float(info["format"]["duration"])


def ep_mp4_path(ep: int) -> Path:
    return STUDIO_DIR / f"ep{ep:02d}_en" / f"SNSHero_StudioAnime_EP{ep:02d}_EN_16x9.mp4"


def ep_srt_path(ep: int) -> Path:
    return STUDIO_DIR / f"ep{ep:02d}_en" / f"SNSHero_StudioAnime_EP{ep:02d}_EN.srt"


def load_font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size=size, index=index)
    except Exception:
        return ImageFont.load_default()


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: Tuple[int, int, int, int],
    tracking: int = 0,
) -> int:
    if tracking <= 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        x = (WIDTH - tw) // 2 - bbox[0]
        draw.text((x, y), text, font=font, fill=fill)
        return th
    widths = []
    max_h = 0
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=font)
        widths.append((ch, bb[2] - bb[0]))
        max_h = max(max_h, bb[3] - bb[1])
    total_w = sum(w for _, w in widths) + tracking * max(0, len(widths) - 1)
    cx = (WIDTH - total_w) // 2
    for ch, w in widths:
        draw.text((cx, y), ch, font=font, fill=fill)
        cx += w + tracking
    return max_h


# ---------------------------------------------------------------------------
# Pillow Card Renderers
# ---------------------------------------------------------------------------

def render_brand_card(
    out_png: Path,
    title: str,
    subtitle: str,
    footer_lines: List[str],
    include_logo: bool = True,
) -> None:
    """Render an atmospheric dark slate card with optional EN logo, gold rule, and crisp typography."""
    img = Image.new("RGBA", (WIDTH, HEIGHT), (8, 10, 16, 255))
    # Subtle radial warm glow at center
    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((240, 80, 1040, 620), fill=(36, 42, 64, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img, glow)

    draw = ImageDraw.Draw(img)

    # Outer subtle gold frame border
    draw.rectangle((42, 34, WIDTH - 42, HEIGHT - 34), outline=(186, 152, 78, 70), width=1)
    draw.rectangle((50, 42, WIDTH - 50, HEIGHT - 42), outline=(186, 152, 78, 35), width=1)

    y_cursor = 115
    if include_logo and LOGO_EN_PATH.is_file():
        logo = Image.open(LOGO_EN_PATH).convert("RGBA")
        target_w = 340
        target_h = int(logo.height * (target_w / logo.width))
        logo = logo.resize((target_w, target_h), Image.LANCZOS)
        img.paste(logo, ((WIDTH - target_w) // 2, 82), logo)
        y_cursor = 82 + target_h + 26
    else:
        y_cursor = 235

    f_title = load_font(FONT_BASKERVILLE, 46, index=1)  # Baskerville Bold or Regular
    f_sub = load_font(FONT_SERIF_ITALIC, 24)
    f_foot = load_font(FONT_SANS, 18, index=0)

    draw_centered_text(draw, y_cursor, title, f_title, (245, 236, 214, 255), tracking=4)
    y_cursor += 64

    # Gold hairline divider
    draw.line((WIDTH // 2 - 150, y_cursor, WIDTH // 2 + 150, y_cursor), fill=(212, 175, 55, 190), width=2)
    y_cursor += 24

    if subtitle:
        draw_centered_text(draw, y_cursor, subtitle, f_sub, (214, 200, 170, 235), tracking=1)
        y_cursor += 46

    y_foot = HEIGHT - 115 if len(footer_lines) <= 2 else HEIGHT - 135
    for line in footer_lines:
        draw_centered_text(draw, y_foot, line, f_foot, (176, 182, 196, 220), tracking=1)
        y_foot += 28

    img.convert("RGB").save(out_png, quality=95)


def render_character_overlay_png(out_png: Path, name: str, role: str, index_num: int, total_num: int) -> None:
    """Render transparent RGBA lower-third vignette + sharp serif name/role overlay."""
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Bottom gradient vignette for guaranteed text legibility
    for dy in range(250):
        alpha = int(225 * (dy / 249.0) ** 1.45)
        y = HEIGHT - 250 + dy
        draw.line((0, y, WIDTH, y), fill=(6, 8, 13, alpha))

    # Top subtle vignette
    for dy in range(70):
        alpha = int(120 * (1.0 - dy / 69.0))
        draw.line((0, dy, WIDTH, dy), fill=(6, 8, 13, alpha))

    f_eyebrow = load_font(FONT_SANS, 15, index=0)
    f_name = load_font(FONT_BASKERVILLE, 54, index=1)
    f_role = load_font(FONT_SERIF_ITALIC, 25)

    eyebrow = f"CHARACTER  {index_num:02d} / {total_num:02d}"
    draw.text((76, HEIGHT - 168), eyebrow, font=f_eyebrow, fill=(212, 175, 55, 220))
    draw.text((74, HEIGHT - 144), name, font=f_name, fill=(250, 245, 232, 255))
    draw.line((76, HEIGHT - 82, 340, HEIGHT - 82), fill=(212, 175, 55, 200), width=2)
    draw.text((76, HEIGHT - 70), role, font=f_role, fill=(216, 212, 200, 240))

    overlay.save(out_png)


def render_montage_overlay_png(out_png: Path, caption: str) -> None:
    """Render transparent RGBA bottom vignette + poetic epilogue caption."""
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for dy in range(190):
        alpha = int(215 * (dy / 189.0) ** 1.5)
        y = HEIGHT - 190 + dy
        draw.line((0, y, WIDTH, y), fill=(6, 8, 13, alpha))

    f_cap = load_font(FONT_SERIF_ITALIC, 27)
    draw.line((WIDTH // 2 - 120, HEIGHT - 95, WIDTH // 2 + 120, HEIGHT - 95), fill=(212, 175, 55, 160), width=1)
    draw_centered_text(draw, HEIGHT - 80, caption, f_cap, (242, 234, 216, 245), tracking=1)
    overlay.save(out_png)


def render_transition_card_png(
    out_png: Path,
    kind: str,
    title: str,
    eyebrow: str = "",
    subtitle: str = "",
) -> None:
    """Render pure-black interstitial title card for location change or time passage."""
    img = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    draw = ImageDraw.Draw(img)

    if kind == "time":
        f_time = load_font(FONT_SERIF_ITALIC, 44)
        draw_centered_text(draw, HEIGHT // 2 - 28, title, f_time, (236, 230, 214, 255), tracking=1)
    else:
        f_eye = load_font(FONT_SANS, 18, index=0)
        f_title = load_font(FONT_BASKERVILLE, 46, index=1)
        f_sub = load_font(FONT_SERIF_ITALIC, 25)

        center_y = HEIGHT // 2 - 34
        if eyebrow:
            draw_centered_text(draw, center_y - 46, eyebrow, f_eye, (212, 175, 55, 225), tracking=4)
        draw.line((WIDTH // 2 - 140, center_y - 14, WIDTH // 2 + 140, center_y - 14), fill=(212, 175, 55, 175), width=1)
        draw_centered_text(draw, center_y + 4, title, f_title, (248, 242, 226, 255), tracking=2)
        if subtitle:
            draw_centered_text(draw, center_y + 68, subtitle, f_sub, (186, 182, 172, 225), tracking=1)

    img.save(out_png, quality=95)


# ---------------------------------------------------------------------------
# Video & Audio Encoding Helpers (Matching EP01-EP40 Specs Exactly)
# ---------------------------------------------------------------------------

VIDEO_ENCODE_FLAGS = [
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level:v", "3.1",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", str(FPS),
    "-g", "48",
    "-video_track_timescale", "12288",
    "-colorspace", "smpte170m",
    "-color_trc", "iec61966-2-1",
    "-color_primaries", "bt709",
    "-color_range", "tv",
]

AUDIO_ENCODE_FLAGS = [
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
]


def prepare_looped_bgm(target_duration: float, out_wav: Path) -> None:
    """Create a seamless crossfaded orchestral BGM bed with fade-in/out and -14 LUFS loudness."""
    bgm_dur = get_duration(BGM_PATH)
    xf = 2.5
    # Calculate how many copies needed to cover target_duration
    step = max(5.0, bgm_dur - xf)
    copies = 1
    while (bgm_dur + (copies - 1) * step) < (target_duration + 2.0):
        copies += 1

    raw_wav = out_wav.with_suffix(".raw.wav")
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for _ in range(copies):
        cmd.extend(["-i", str(BGM_PATH)])

    fc_parts = []
    for i in range(copies):
        fc_parts.append(f"[{i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a{i}]")

    if copies == 1:
        merged_label = "[a0]"
    else:
        prev = "[a0]"
        for i in range(1, copies):
            out_lbl = f"[ax{i}]" if i < copies - 1 else "[amerged]"
            fc_parts.append(f"{prev}[a{i}]acrossfade=d={xf:.2f}:c1=tri:c2=tri{out_lbl}")
            prev = out_lbl
        merged_label = "[amerged]"

    fade_out_st = max(0.5, target_duration - 2.5)
    fc_parts.append(
        f"{merged_label}atrim=0:{target_duration:.4f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=1.2,afade=t=out:st={fade_out_st:.4f}:d=2.5[bgm]"
    )
    cmd.extend([
        "-filter_complex", ";".join(fc_parts),
        "-map", "[bgm]",
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
        str(raw_wav),
    ])
    run_cmd(cmd, check=True)

    # Two-pass loudnorm to -14 LUFS matching episodes
    m_res = run_cmd(
        ["ffmpeg", "-y", "-i", str(raw_wav), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture=True,
        check=False,
    )
    ln_filter = "loudnorm=I=-14:TP=-1.5:LRA=11"
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", m_res.stderr, re.DOTALL)
    if m:
        try:
            st = json.loads(m.group(0))
            if st.get("input_i") not in (None, "-inf", "inf"):
                ln_filter = (
                    f"loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
                    f"measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
                    f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:"
                    f"offset={st['target_offset']}"
                )
        except Exception:
            pass

    run_cmd(
        ["ffmpeg", "-y", "-v", "error", "-i", str(raw_wav), "-af", ln_filter, "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", str(out_wav)],
        check=True,
    )
    raw_wav.unlink(missing_ok=True)


def build_sequence_video(
    items: List[Dict[str, Any]],
    out_mp4: Path,
    seq_work: Path,
    fade_in_start: float = 0.7,
    fade_out_end: float = 1.0,
) -> float:
    """
    Build a crossfaded video sequence (Intro or Ending) with Ken Burns artwork + sharp overlays + BGM.
    Each item has:
      - type: "card" (static PNG) or "kenburns" (art_path + overlay_png)
      - duration: float
    Returns actual ffprobe duration.
    """
    seq_work.mkdir(parents=True, exist_ok=True)
    clip_paths: List[Path] = []

    for idx, item in enumerate(items):
        dur = float(item["duration"])
        frames = int(round(dur * FPS))
        cpath = seq_work / f"slide_{idx:02d}.mp4"
        if item["type"] == "card":
            cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-loop", "1", "-framerate", str(FPS), "-i", str(item["card_png"]),
                "-t", f"{dur:.4f}",
                "-vf", f"scale={WIDTH}:{HEIGHT},fps={FPS},format=yuv420p",
                "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
                str(cpath),
            ]
        else:
            # Animate artwork gently behind crisp static RGBA overlay
            zoom_dir = "in" if idx % 2 == 0 else "out"
            if zoom_dir == "in":
                z_expr = f"1.0+0.055*on/{max(1, frames - 1)}"
            else:
                z_expr = f"1.055-0.055*on/{max(1, frames - 1)}"
            fc = (
                f"[0:v]scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,"
                f"zoompan=z='{z_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS}[bg];"
                f"[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[v]"
            )
            cmd = [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(item["art_path"]),
                "-loop", "1", "-framerate", str(FPS), "-i", str(item["overlay_png"]),
                "-filter_complex", fc,
                "-map", "[v]",
                "-t", f"{dur:.4f}",
                "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
                str(cpath),
            ]
        run_cmd(cmd, check=True)
        clip_paths.append(cpath)

    # Chain slides with xfade
    durs = [get_duration(p) for p in clip_paths]
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for p in clip_paths:
        cmd.extend(["-i", str(p)])

    fc_parts = []
    cur_dur = durs[0]
    prev_lbl = "[0:v]"
    for i in range(1, len(clip_paths)):
        offset = max(0.0, cur_dur - XFADE_SEC)
        out_lbl = f"[vx{i}]" if i < len(clip_paths) - 1 else "[vx_all]"
        fc_parts.append(
            f"{prev_lbl}[{i}:v]xfade=transition=fade:duration={XFADE_SEC:.4f}:offset={offset:.4f}{out_lbl}"
        )
        cur_dur = offset + durs[i]
        prev_lbl = out_lbl

    fade_out_st = max(0.5, cur_dur - fade_out_end)
    fc_parts.append(
        f"{prev_lbl}fade=t=in:st=0:d={fade_in_start:.2f},fade=t=out:st={fade_out_st:.4f}:d={fade_out_end:.2f},format=yuv420p[vout]"
    )

    silent_video = seq_work / "video_only.mp4"
    cmd.extend([
        "-filter_complex", ";".join(fc_parts),
        "-map", "[vout]",
        "-r", str(FPS),
        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
        str(silent_video),
    ])
    run_cmd(cmd, check=True)

    actual_v_dur = get_duration(silent_video)
    bgm_wav = seq_work / "bgm_norm.wav"
    prepare_looped_bgm(actual_v_dur, bgm_wav)

    # Mux final sequence matching exact EP01-EP40 stream specs
    run_cmd(
        [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(silent_video),
            "-i", str(bgm_wav),
            "-map", "0:v:0", "-map", "1:a:0",
            *VIDEO_ENCODE_FLAGS,
            *AUDIO_ENCODE_FLAGS,
            "-shortest",
            "-movflags", "+faststart",
            str(out_mp4),
        ],
        check=True,
    )
    return get_duration(out_mp4)


def build_intro(out_mp4: Path, force: bool = False) -> float:
    if out_mp4.is_file() and not force:
        return get_duration(out_mp4)

    print("[1/5] Building Intro sequence...")
    seq_work = WORK_DIR / "intro"
    seq_work.mkdir(parents=True, exist_ok=True)

    items: List[Dict[str, Any]] = []

    # Opening title card
    opening_png = seq_work / "card_opening.png"
    render_brand_card(
        opening_png,
        title="THE CHRONICLES OF KADAN",
        subtitle="Full-Length Feature Animation · Episodes 1–40",
        footer_lines=["An Original Fantasy Saga from Elwin Village to the Black Citadel"],
        include_logo=True,
    )
    items.append({"type": "card", "card_png": opening_png, "duration": 4.2})

    # 12 Major Characters
    total_chars = len(INTRO_CHARACTERS)
    for idx, ch in enumerate(INTRO_CHARACTERS, start=1):
        art_p = REPO_ROOT / ch["image"]
        if not art_p.is_file():
            raise FileNotFoundError(f"Missing intro character keyframe: {art_p}")
        ov_png = seq_work / f"overlay_char_{idx:02d}.png"
        render_character_overlay_png(ov_png, ch["name"], ch["role"], idx, total_chars)
        items.append({"type": "kenburns", "art_path": art_p, "overlay_png": ov_png, "duration": 3.6})

    # Closing intro production & license card
    lic_png = seq_work / "card_intro_license.png"
    render_brand_card(
        lic_png,
        title="PRODUCED BY SNSHERO.COM",
        subtitle="Original Story, World & Animation",
        footer_lines=[
            "© SNSHero.com. All Rights Reserved.",
            "Official SNSHero Original Intellectual Property & Animation License · https://SNSHero.com",
        ],
        include_logo=True,
    )
    items.append({"type": "card", "card_png": lic_png, "duration": 4.4})

    dur = build_sequence_video(items, out_mp4, seq_work, fade_in_start=0.8, fade_out_end=1.0)
    print(f"      Intro ready: {dur:.2f}s -> {out_mp4.name}")
    return dur


def build_ending(out_mp4: Path, force: bool = False) -> float:
    if out_mp4.is_file() and not force:
        return get_duration(out_mp4)

    print("[4/5] Building Ending sequence...")
    seq_work = WORK_DIR / "ending"
    seq_work.mkdir(parents=True, exist_ok=True)

    items: List[Dict[str, Any]] = []

    epilogue_png = seq_work / "card_epilogue.png"
    render_brand_card(
        epilogue_png,
        title="THE END",
        subtitle="The Journey of Kadan & Silia · Episodes 1–40",
        footer_lines=["Thank You for Watching"],
        include_logo=False,
    )
    items.append({"type": "card", "card_png": epilogue_png, "duration": 3.6})

    for idx, m in enumerate(ENDING_MONTAGE, start=1):
        art_p = REPO_ROOT / m["image"]
        if not art_p.is_file():
            raise FileNotFoundError(f"Missing ending montage keyframe: {art_p}")
        ov_png = seq_work / f"overlay_montage_{idx:02d}.png"
        render_montage_overlay_png(ov_png, m["caption"])
        items.append({"type": "kenburns", "art_path": art_p, "overlay_png": ov_png, "duration": 3.6})

    lic_png = seq_work / "card_ending_license.png"
    render_brand_card(
        lic_png,
        title="PRODUCED BY SNSHERO.COM",
        subtitle="© SNSHero.com. All Rights Reserved.",
        footer_lines=[
            "Original Story, Characters & Feature Animation Exclusively Licensed by SNSHero.com",
            "Play & Explore the Full Universe at https://SNSHero.com",
        ],
        include_logo=True,
    )
    items.append({"type": "card", "card_png": lic_png, "duration": 5.2})

    dur = build_sequence_video(items, out_mp4, seq_work, fade_in_start=0.9, fade_out_end=1.4)
    print(f"      Ending ready: {dur:.2f}s -> {out_mp4.name}")
    return dur


def build_transition_clip(ep: int, spec: Dict[str, str], out_mp4: Path, force: bool = False) -> float:
    if out_mp4.is_file() and not force:
        return get_duration(out_mp4)

    tdir = WORK_DIR / "transitions"
    tdir.mkdir(parents=True, exist_ok=True)
    png_path = tdir / f"trans_ep{ep:02d}.png"
    kind = spec["kind"]
    dur = 3.0 if kind == "time" else 3.2
    render_transition_card_png(
        png_path,
        kind=kind,
        title=spec["title"],
        eyebrow=spec.get("eyebrow", ""),
        subtitle=spec.get("subtitle", ""),
    )
    fade_out_st = dur - 0.6
    vf = f"scale={WIDTH}:{HEIGHT},fps={FPS},fade=t=in:st=0:d=0.6,fade=t=out:st={fade_out_st:.2f}:d=0.6,format=yuv420p"
    run_cmd(
        [
            "ffmpeg", "-y", "-v", "error",
            "-loop", "1", "-framerate", str(FPS), "-i", str(png_path),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t", f"{dur:.4f}",
            "-vf", vf,
            *VIDEO_ENCODE_FLAGS,
            *AUDIO_ENCODE_FLAGS,
            "-shortest",
            str(out_mp4),
        ],
        check=True,
    )
    return get_duration(out_mp4)


def build_direct_chain(eps: List[int], out_mp4: Path, force: bool = False) -> Tuple[float, List[Tuple[int, float, float]]]:
    """
    Join a chain of consecutive 'direct'-transition episodes with 0.6s video xfade & audio acrossfade.
    Returns (chain_duration, [(ep, relative_start, ep_raw_duration), ...]).
    """
    raw_durs = [get_duration(ep_mp4_path(ep)) for ep in eps]
    offsets: List[Tuple[int, float, float]] = []
    cur = 0.0
    for idx, ep in enumerate(eps):
        offsets.append((ep, cur, raw_durs[idx]))
        if idx < len(eps) - 1:
            cur += raw_durs[idx] - DIRECT_XFADE_SEC

    if out_mp4.is_file() and not force:
        return get_duration(out_mp4), offsets

    print(f"      Crossfading direct chain EP{' -> EP'.join(f'{e:02d}' for e in eps)}...")
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for ep in eps:
        cmd.extend(["-i", str(ep_mp4_path(ep))])

    fc_parts = []
    # Normalize timestamps & audio format
    for i in range(len(eps)):
        fc_parts.append(f"[{i}:v]setpts=PTS-STARTPTS[v{i}]")
        fc_parts.append(f"[{i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{i}]")

    v_prev = "[v0]"
    a_prev = "[a0]"
    running_dur = raw_durs[0]
    for i in range(1, len(eps)):
        xf_off = max(0.0, running_dur - DIRECT_XFADE_SEC)
        v_out = f"[vx{i}]" if i < len(eps) - 1 else "[vout]"
        a_out = f"[ax{i}]" if i < len(eps) - 1 else "[aout]"
        fc_parts.append(f"{v_prev}[v{i}]xfade=transition=fade:duration={DIRECT_XFADE_SEC:.4f}:offset={xf_off:.4f}{v_out}")
        fc_parts.append(f"{a_prev}[a{i}]acrossfade=d={DIRECT_XFADE_SEC:.4f}:c1=tri:c2=tri{a_out}")
        running_dur = xf_off + raw_durs[i]
        v_prev = v_out
        a_prev = a_out

    cmd.extend([
        "-filter_complex", ";".join(fc_parts),
        "-map", "[vout]", "-map", "[aout]",
        *VIDEO_ENCODE_FLAGS,
        *AUDIO_ENCODE_FLAGS,
        "-movflags", "+faststart",
        str(out_mp4),
    ])
    run_cmd(cmd, check=True)
    return get_duration(out_mp4), offsets


# ---------------------------------------------------------------------------
# SRT Parser & Offset Shifter
# ---------------------------------------------------------------------------

def parse_srt_ts(ts: str) -> float:
    h, m, rest = ts.strip().split(":")
    s, ms = rest.replace(",", ".").split(".")
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0


def fmt_srt_ts(sec: float) -> str:
    sec = max(0.0, sec)
    ms_total = int(round(sec * 1000))
    ms = ms_total % 1000
    s_total = ms_total // 1000
    s = s_total % 60
    m_total = s_total // 60
    m = m_total % 60
    h = m_total // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def fmt_hms(sec: float) -> str:
    s_total = int(sec)
    h = s_total // 3600
    m = (s_total % 3600) // 60
    s = s_total % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def collect_shifted_srt_blocks(ep: int, ep_start: float, ep_dur: float) -> List[Tuple[float, float, str]]:
    p = ep_srt_path(ep)
    if not p.is_file():
        return []
    raw = p.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        return []
    blocks = re.split(r"\r?\n\r?\n+", raw)
    out: List[Tuple[float, float, str]] = []
    for blk in blocks:
        lines = [ln.rstrip() for ln in blk.splitlines()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        t1_s, t2_s = [x.strip() for x in lines[1].split("-->")]
        t1 = parse_srt_ts(t1_s)
        t2 = parse_srt_ts(t2_s)
        if t1 >= ep_dur:
            continue
        t2 = min(t2, ep_dur)
        text = "\n".join(lines[2:]).strip()
        if text:
            out.append((ep_start + t1, ep_start + t2, text))
    return out


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Build SNSHero Full-Length EN Feature Animation (EP01-EP40)")
    parser.add_argument("--force-rebuild", action="store_true", help="Regenerate cached intro/ending/transitions/chains")
    args = parser.parse_args()

    # Verify all 40 inputs exist
    missing = [ep for ep in range(1, 41) if not ep_mp4_path(ep).is_file()]
    if missing:
        print(f"ERROR: Missing episode MP4(s): {missing}", file=sys.stderr)
        return 1

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    force = args.force_rebuild

    # 1. Intro
    intro_mp4 = WORK_DIR / "00_intro_en.mp4"
    intro_dur = build_intro(intro_mp4, force=force)

    # 2. Transitions
    print("[2/5] Building episode transition cards...")
    trans_files: Dict[int, Tuple[Path, float]] = {}
    for ep in range(1, 41):
        spec = EPISODE_TRANSITIONS[ep]
        if spec["kind"] in ("location", "time"):
            tp = WORK_DIR / "transitions" / f"trans_ep{ep:02d}.mp4"
            td = build_transition_clip(ep, spec, tp, force=force)
            trans_files[ep] = (tp, td)

    # 3. Group episodes into standalone or direct-xfade chains
    print("[3/5] Grouping episodes & rendering direct xfade chains...")
    groups: List[List[int]] = []
    cur_group: List[int] = [1]
    for ep in range(2, 41):
        if EPISODE_TRANSITIONS[ep]["kind"] == "direct":
            cur_group.append(ep)
        else:
            groups.append(cur_group)
            cur_group = [ep]
    groups.append(cur_group)

    group_segments: List[Dict[str, Any]] = []
    chains_dir = WORK_DIR / "chains"
    chains_dir.mkdir(parents=True, exist_ok=True)

    for grp in groups:
        first_ep = grp[0]
        if len(grp) == 1:
            ep = grp[0]
            mp4 = ep_mp4_path(ep)
            dur = get_duration(mp4)
            group_segments.append({
                "eps": grp,
                "mp4": mp4,
                "dur": dur,
                "rel_offsets": [(ep, 0.0, dur)],
            })
        else:
            chain_name = f"chain_ep{grp[0]:02d}_ep{grp[-1]:02d}.mp4"
            chain_mp4 = chains_dir / chain_name
            dur, rel_offsets = build_direct_chain(grp, chain_mp4, force=force)
            group_segments.append({
                "eps": grp,
                "mp4": chain_mp4,
                "dur": dur,
                "rel_offsets": rel_offsets,
            })

    # 4. Ending
    ending_mp4 = WORK_DIR / "99_ending_en.mp4"
    ending_dur = build_ending(ending_mp4, force=force)

    # 5. Assemble concat list, compute timeline offsets, merge
    print("[5/5] Concatenating full feature animation, unified SRT & chapters...")
    concat_entries: List[Tuple[str, Path, float]] = []
    chapters: List[Dict[str, Any]] = []
    all_srt_blocks: List[Tuple[float, float, str]] = []

    cursor = 0.0
    concat_entries.append(("intro", intro_mp4, intro_dur))
    chapters.append({
        "id": "intro",
        "title": "Opening & Character Introductions",
        "start_sec": round(cursor, 3),
        "end_sec": round(cursor + intro_dur, 3),
        "timestamp": fmt_hms(cursor),
    })
    cursor += intro_dur

    for grp_seg in group_segments:
        first_ep = grp_seg["eps"][0]
        if first_ep in trans_files:
            tp, td = trans_files[first_ep]
            concat_entries.append((f"trans_ep{first_ep:02d}", tp, td))
            cursor += td

        seg_start = cursor
        concat_entries.append((f"grp_ep{grp_seg['eps'][0]:02d}", grp_seg["mp4"], grp_seg["dur"]))

        for ep, rel_start, ep_raw_dur in grp_seg["rel_offsets"]:
            sb_path = STUDIO_DIR / f"ep{ep:02d}_en" / f"storyboard_ep{ep:02d}_en.json"
            sb_title = f"Episode {ep:02d}"
            if sb_path.is_file():
                sb_title = json.loads(sb_path.read_text(encoding="utf-8")).get("episodeTitleEn", sb_title)
            ep_abs_start = seg_start + rel_start
            spec = EPISODE_TRANSITIONS[ep]
            chapters.append({
                "id": f"ep{ep:02d}",
                "episode": ep,
                "title": f"EP{ep:02d}: {sb_title}",
                "transition_in": spec["kind"],
                "transition_label": spec.get("title", "Direct Cut"),
                "start_sec": round(ep_abs_start, 3),
                "end_sec": round(ep_abs_start + ep_raw_dur, 3),
                "timestamp": fmt_hms(ep_abs_start),
            })
            all_srt_blocks.extend(collect_shifted_srt_blocks(ep, ep_abs_start, ep_raw_dur))

        cursor += grp_seg["dur"]

    concat_entries.append(("ending", ending_mp4, ending_dur))
    chapters.append({
        "id": "ending",
        "title": "Epilogue Montage & Credits (SNSHero.com)",
        "start_sec": round(cursor, 3),
        "end_sec": round(cursor + ending_dur, 3),
        "timestamp": fmt_hms(cursor),
    })
    cursor += ending_dur

    concat_txt = WORK_DIR / "concat_list.txt"
    with concat_txt.open("w", encoding="utf-8") as fh:
        for _, path, _ in concat_entries:
            escaped = str(path.resolve()).replace("'", "'\\''")
            fh.write(f"file '{escaped}'\n")

    run_cmd(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "concat", "-safe", "0", "-i", str(concat_txt),
            "-c", "copy",
            "-movflags", "+faststart",
            str(FINAL_MP4),
        ],
        check=True,
    )

    # Write unified SRT
    with FINAL_SRT.open("w", encoding="utf-8") as fh:
        for idx, (t1, t2, text) in enumerate(all_srt_blocks, start=1):
            fh.write(f"{idx}\n{fmt_srt_ts(t1)} --> {fmt_srt_ts(t2)}\n{text}\n\n")

    # Probe final master
    final_info = probe_media(FINAL_MP4)
    final_dur = float(final_info["format"]["duration"])
    v_stream = [s for s in final_info["streams"] if s["codec_type"] == "video"][0]
    a_stream = [s for s in final_info["streams"] if s["codec_type"] == "audio"][0]

    meta = {
        "title": "SNSHero: The Chronicles of Kadan — Full-Length Feature Animation (EP01–EP40, English)",
        "producer": "SNSHero.com",
        "license": "© SNSHero.com. All Rights Reserved.",
        "output_mp4": str(FINAL_MP4.relative_to(REPO_ROOT)),
        "output_srt": str(FINAL_SRT.relative_to(REPO_ROOT)),
        "expected_duration_sec": round(cursor, 3),
        "actual_duration_sec": round(final_dur, 3),
        "video_duration_sec": float(v_stream["duration"]),
        "audio_duration_sec": float(a_stream["duration"]),
        "resolution": f"{v_stream['width']}x{v_stream['height']}",
        "fps": v_stream["r_frame_rate"],
        "subtitle_count": len(all_srt_blocks),
        "chapters": chapters,
    }
    FINAL_CHAPTERS.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n=== FULL ANIME BUILD COMPLETE ===")
    print(f"MP4      : {FINAL_MP4} ({FINAL_MP4.stat().st_size / (1024**3):.2f} GB)")
    print(f"SRT      : {FINAL_SRT} ({len(all_srt_blocks)} cues)")
    print(f"Chapters : {FINAL_CHAPTERS} ({len(chapters)} chapters)")
    print(f"Duration : {final_dur:.2f}s ({final_dur/60:.2f} min) | V={float(v_stream['duration']):.2f}s A={float(a_stream['duration']):.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
