#!/usr/bin/env python3
"""
SNSHero Full-Length Feature Animation (EP01-EP40) 10-Language Dubbing Pipeline
--------------------------------------------------------------------------------
Reuses the lossless video stream (-c:v copy) of the finished English master:
  output/studio_anime/SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4
and builds 9 official localized dubs + unified SRTs:
  ko, ja, zh-Hans, zh-Hant, es, fr, de, id, vi

Features:
  - 719-cue alignment with SNSHero_Full_Anime_EP01_EP40_EN.srt, chapters JSON,
    and per-episode storyboard_epXX_en.json (speakerEn, audioMode, act).
  - 6 speaker archetypes mapped to distinct edge-tts Neural voices & pitches.
  - Official KO SRT reuse (719/719 matched) + Google Translate localization
    with proper-noun glossary normalization & caching for the remaining 8 languages.
  - Concurrent edge-tts synthesis with retry/backoff, atempo slot-fitting, and
    vocal RMS normalization.
  - Sample-accurate audio mixing: Intro & Ending BGM 100% preserved, non-speech
    sakuga/SFX untouched, speech windows ducked cleanly with per-episode Act BGM
    reconstructed at -20 dB.
  - Two-pass ffmpeg loudnorm=I=-14:TP=-1.5:LRA=11 + -c:v copy muxing.
  - Automatic per-language temp audio cleanup & full 10-language verification.

Usage:
  python3 scripts/studio_anime/build_full_anime_multilang_dub.py --langs ko
  python3 scripts/studio_anime/build_full_anime_multilang_dub.py
  python3 scripts/studio_anime/build_full_anime_multilang_dub.py --verify-only
"""

from __future__ import annotations

import argparse
import asyncio
import difflib
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import edge_tts
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
STUDIO_DIR = REPO_ROOT / "output/studio_anime"
WORK_DIR = STUDIO_DIR / "_full_anime_dub_build"

MASTER_MP4 = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN_16x9.mp4"
MASTER_SRT = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN.srt"
MASTER_CHAPTERS = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_EN_chapters.json"
VERIFY_JSON = STUDIO_DIR / "SNSHero_Full_Anime_EP01_EP40_10LANG_verify.json"

BGM_DIR = REPO_ROOT / "public/hs-assets/snshero-audio/bgm"
ALLOWED_BGM_NAMES = ("mulligan.mp3", "duel_1.mp3", "duel_2.mp3", "collection.mp3")
DEFAULT_ACT_BGM = {
    1: "mulligan.mp3",
    2: "duel_1.mp3",
    3: "collection.mp3",
}

SAMPLE_RATE = 48000
CHANNELS = 2
TARGET_VOCAL_RMS = 0.16
BGM_DUCK_GAIN = 0.10  # -20 dB
CROSSFADE_SEC = 0.12

LANG_ORDER: List[str] = [
    "ko",
    "ja",
    "zh-Hans",
    "zh-Hant",
    "es",
    "fr",
    "de",
    "id",
    "vi",
]

LANG_TAGS: Dict[str, str] = {
    "en": "EN",
    "ko": "KO",
    "ja": "JA",
    "zh-Hans": "ZH-HANS",
    "zh-Hant": "ZH-HANT",
    "es": "ES",
    "fr": "FR",
    "de": "DE",
    "id": "ID",
    "vi": "VI",
}

GT_CODES: Dict[str, str] = {
    "ja": "ja",
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
    "es": "es",
    "fr": "fr",
    "de": "de",
    "id": "id",
    "vi": "vi",
}

# 6 Voice Archetypes across all 54 storyboard speakers
SPEAKER_ARCHETYPE: Dict[str, str] = {
    "Narrator": "narrator",
    "Kadan": "male_lead",
    "Ignis": "male_lead",
    "Kaze": "male_lead",
    "Walker": "male_lead",
    "Robinyard": "male_lead",
    "Silia": "female_lead",
    "Aila": "female_lead",
    "Eliana": "female_lead",
    "Orphan Girl": "female_lead",
    "Refugee Child": "female_lead",
    "Phantom Sylphid": "female_lead",
    "Elwin": "female_mature",
    "Ysela": "female_mature",
    "Medusa Gorgo": "female_mature",
    "Lady Sylvia": "female_mature",
    "Titania": "female_mature",
    "Arachne": "female_mature",
    "Leonar": "elder_male",
    "Star Hermit": "elder_male",
    "Elder Ordo": "elder_male",
    "Elder Zephyr": "elder_male",
    "Emperor": "elder_male",
    "Senate Chancellor": "elder_male",
    "Aeolus": "elder_male",
    "Grimli": "elder_male",
    "Lucian": "male_deep",
    "Balian": "male_deep",
    "Hercul": "male_deep",
    "Gawain": "male_deep",
    "Rondol": "male_deep",
    "Aleksandar": "male_deep",
    "Fenrir": "male_deep",
    "King Fenrir": "male_deep",
    "Bogart": "male_deep",
    "Bargast": "male_deep",
    "Karnak": "male_deep",
    "Count Balthazar": "male_deep",
    "Death Knight Artus": "male_deep",
    "Sir Artus": "male_deep",
    "Assassin Leader": "male_deep",
    "Captain Torvald": "male_deep",
    "Commander Barto": "male_deep",
    "Crimson Envoy": "male_deep",
    "Gilgamesh": "male_deep",
    "Inquisitor Captain": "male_deep",
    "Royal Guard Officer": "male_deep",
    "Ursak": "male_deep",
    "Horse Thief": "male_deep",
    "Auctioneer": "male_deep",
    "Fisherman": "male_deep",
    "Grain Merchant": "male_deep",
    "Citizen": "male_deep",
}

VOICE_PROFILES: Dict[str, Dict[str, Tuple[str, str]]] = {
    "ko": {
        "male_lead": ("ko-KR-InJoonNeural", "+2Hz"),
        "male_deep": ("ko-KR-HyunsuMultilingualNeural", "-6Hz"),
        "elder_male": ("ko-KR-InJoonNeural", "-12Hz"),
        "narrator": ("ko-KR-HyunsuMultilingualNeural", "-3Hz"),
        "female_lead": ("ko-KR-SunHiNeural", "+3Hz"),
        "female_mature": ("ko-KR-SunHiNeural", "-5Hz"),
    },
    "ja": {
        "male_lead": ("ja-JP-KeitaNeural", "+2Hz"),
        "male_deep": ("ja-JP-KeitaNeural", "-8Hz"),
        "elder_male": ("ja-JP-KeitaNeural", "-13Hz"),
        "narrator": ("ja-JP-KeitaNeural", "-4Hz"),
        "female_lead": ("ja-JP-NanamiNeural", "+3Hz"),
        "female_mature": ("ja-JP-NanamiNeural", "-5Hz"),
    },
    "zh-Hans": {
        "male_lead": ("zh-CN-YunxiNeural", "+0Hz"),
        "male_deep": ("zh-CN-YunjianNeural", "-4Hz"),
        "elder_male": ("zh-CN-YunjianNeural", "-10Hz"),
        "narrator": ("zh-CN-YunyangNeural", "-2Hz"),
        "female_lead": ("zh-CN-XiaoyiNeural", "+0Hz"),
        "female_mature": ("zh-CN-XiaoxiaoNeural", "-4Hz"),
    },
    "zh-Hant": {
        "male_lead": ("zh-CN-YunxiNeural", "+0Hz"),
        "male_deep": ("zh-CN-YunjianNeural", "-4Hz"),
        "elder_male": ("zh-CN-YunjianNeural", "-10Hz"),
        "narrator": ("zh-CN-YunyangNeural", "-2Hz"),
        "female_lead": ("zh-TW-HsiaoChenNeural", "+2Hz"),
        "female_mature": ("zh-TW-HsiaoYuNeural", "-3Hz"),
    },
    "es": {
        "male_lead": ("es-MX-JorgeNeural", "+2Hz"),
        "male_deep": ("es-ES-AlvaroNeural", "-6Hz"),
        "elder_male": ("es-ES-AlvaroNeural", "-11Hz"),
        "narrator": ("es-ES-AlvaroNeural", "-2Hz"),
        "female_lead": ("es-MX-DaliaNeural", "+2Hz"),
        "female_mature": ("es-ES-ElviraNeural", "-4Hz"),
    },
    "fr": {
        "male_lead": ("fr-FR-RemyMultilingualNeural", "+2Hz"),
        "male_deep": ("fr-FR-HenriNeural", "-6Hz"),
        "elder_male": ("fr-FR-HenriNeural", "-11Hz"),
        "narrator": ("fr-FR-HenriNeural", "-2Hz"),
        "female_lead": ("fr-FR-EloiseNeural", "+0Hz"),
        "female_mature": ("fr-FR-DeniseNeural", "-3Hz"),
    },
    "de": {
        "male_lead": ("de-DE-ChristophNeural", "+2Hz"),
        "male_deep": ("de-DE-ChristophNeural", "-7Hz"),
        "elder_male": ("de-DE-ChristophNeural", "-12Hz"),
        "narrator": ("de-DE-ChristophNeural", "-3Hz"),
        "female_lead": ("de-DE-TanjaNeural", "+3Hz"),
        "female_mature": ("de-DE-TanjaNeural", "-5Hz"),
    },
    "id": {
        "male_lead": ("id-ID-ArdiNeural", "+2Hz"),
        "male_deep": ("id-ID-ArdiNeural", "-7Hz"),
        "elder_male": ("id-ID-ArdiNeural", "-12Hz"),
        "narrator": ("id-ID-ArdiNeural", "-3Hz"),
        "female_lead": ("id-ID-GadisNeural", "+3Hz"),
        "female_mature": ("id-ID-GadisNeural", "-5Hz"),
    },
    "vi": {
        "male_lead": ("vi-VN-NamMinhNeural", "+0Hz"),
        "male_deep": ("vi-VN-NamMinhNeural", "+0Hz"),
        "elder_male": ("vi-VN-NamMinhNeural", "+0Hz"),
        "narrator": ("vi-VN-NamMinhNeural", "+0Hz"),
        "female_lead": ("vi-VN-HoaiMyNeural", "+0Hz"),
        "female_mature": ("vi-VN-HoaiMyNeural", "+0Hz"),
    },
}

# Conservative proper-noun normalization glossary (fixes common MT drift)
PROPER_NOUN_FIXES: Dict[str, List[Tuple[str, str]]] = {
    "ja": [
        (r"ライトヘイブン", "ライトヘイヴン"),
        (r"カダン", "カダン"),
        (r"エルウィン", "エルウィン"),
        (r"シリア", "シリア"),
        (r"イグニス", "イグニス"),
        (r"ルシアン", "ルシアン"),
    ],
    "zh-Hans": [
        (r"卡丹", "卡丹"),
        (r"光之避风港|光明港", "莱特海文"),
        (r"埃尔温", "埃尔温"),
        (r"西莉亚", "西莉亚"),
        (r"伊格尼斯", "伊格尼斯"),
    ],
    "zh-Hant": [
        (r"光之避風港|光明港", "萊特海文"),
    ],
}


@dataclass
class AlignedCue:
    idx: int  # 1-based global cue index
    ep: int
    ep_cue_idx: int  # 0-based within episode
    start_sec: float
    end_sec: float
    raw_text_en: str
    clean_text_en: str
    is_narration: bool
    speaker_en: str
    archetype: str
    act: int


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


def strip_html(text: str) -> str:
    t = re.sub(r"</?i>", "", text, flags=re.IGNORECASE)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_srt_file(path: Path) -> List[Tuple[float, float, str]]:
    raw = path.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        return []
    blocks = re.split(r"\r?\n\r?\n+", raw)
    out: List[Tuple[float, float, str]] = []
    for blk in blocks:
        lines = [ln.rstrip() for ln in blk.splitlines()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        t1_s, t2_s = [x.strip() for x in lines[1].split("-->")]
        text = "\n".join(lines[2:]).strip()
        if text:
            out.append((parse_srt_ts(t1_s), parse_srt_ts(t2_s), text))
    return out


def normalize_for_match(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", strip_html(s).lower()).strip()


def load_aligned_cues() -> Tuple[List[AlignedCue], Dict[str, Any]]:
    chapters_meta = json.loads(MASTER_CHAPTERS.read_text(encoding="utf-8"))
    ep_ranges: List[Tuple[int, float, float]] = []
    for ch in chapters_meta["chapters"]:
        if "episode" in ch:
            ep_ranges.append((int(ch["episode"]), float(ch["start_sec"]), float(ch["end_sec"])))

    master_blocks = parse_srt_file(MASTER_SRT)
    if len(master_blocks) != 719:
        print(f"[WARN] Expected 719 cues in {MASTER_SRT.name}, got {len(master_blocks)}")

    # Group master cues by episode
    by_ep: Dict[int, List[Tuple[int, float, float, str]]] = {ep: [] for ep in range(1, 41)}
    for idx, (t1, t2, raw_txt) in enumerate(master_blocks, start=1):
        mid = 0.5 * (t1 + t2)
        ep_found = None
        for ep, s0, s1 in ep_ranges:
            if s0 - 0.5 <= mid <= s1 + 0.5:
                ep_found = ep
                break
        if ep_found is None:
            # Nearest episode fallback
            ep_found = min(ep_ranges, key=lambda r: abs(mid - 0.5 * (r[1] + r[2])))[0]
        by_ep[ep_found].append((idx, t1, t2, raw_txt))

    aligned: List[AlignedCue] = []
    for ep in range(1, 41):
        sb_path = STUDIO_DIR / f"ep{ep:02d}_en" / f"storyboard_ep{ep:02d}_en.json"
        sb = json.loads(sb_path.read_text(encoding="utf-8"))
        cuts = sb.get("cuts", sb.get("shots", []))
        speech_cuts = [
            c for c in cuts if c.get("audioMode") in ("character_dialogue", "offscreen_narration")
        ]

        ep_cues = by_ep[ep]
        cut_cursor = 0
        for ep_cue_idx, (global_idx, t1, t2, raw_txt) in enumerate(ep_cues):
            is_narr = "<i>" in raw_txt.lower()
            clean_en = strip_html(raw_txt)
            q_norm = normalize_for_match(clean_en)

            best_k = cut_cursor
            if len(ep_cues) == len(speech_cuts):
                best_k = ep_cue_idx
            else:
                # Monotonic similarity search forward (handles trimmed cuts like EP04)
                best_score = -1.0
                upper = min(len(speech_cuts), cut_cursor + 4)
                for k in range(cut_cursor, upper):
                    cand_txt = speech_cuts[k].get("dialogueEn") or speech_cuts[k].get("narrationEn") or ""
                    c_norm = normalize_for_match(cand_txt)
                    score = difflib.SequenceMatcher(None, q_norm, c_norm).ratio()
                    if score > best_score:
                        best_score = score
                        best_k = k
                cut_cursor = best_k + 1

            cut = speech_cuts[min(best_k, len(speech_cuts) - 1)]
            mode = cut.get("audioMode", "character_dialogue")
            speaker = (cut.get("speakerEn") or ("Narrator" if is_narr or mode == "offscreen_narration" else "Kadan")).strip()
            if is_narr or mode == "offscreen_narration":
                speaker = "Narrator"
                is_narr = True
            act = int(cut.get("act") or 1)
            archetype = "narrator" if is_narr else SPEAKER_ARCHETYPE.get(speaker, "male_deep")

            aligned.append(
                AlignedCue(
                    idx=global_idx,
                    ep=ep,
                    ep_cue_idx=ep_cue_idx,
                    start_sec=t1,
                    end_sec=t2,
                    raw_text_en=raw_txt,
                    clean_text_en=clean_en,
                    is_narration=is_narr,
                    speaker_en=speaker,
                    archetype=archetype,
                    act=act,
                )
            )

    return aligned, chapters_meta


# ---------------------------------------------------------------------------
# Translation & SRT Localization
# ---------------------------------------------------------------------------

def _gt_translate_raw(text: str, tl: str) -> str:
    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl=en&tl={urllib.parse.quote(tl)}&dt=t&q={urllib.parse.quote(text)}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return "".join(seg[0] for seg in (data[0] or []) if seg and seg[0])
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.0 * (attempt + 1))
    return text


def apply_glossary(lang: str, text: str) -> str:
    out = text.strip()
    for pat, repl in PROPER_NOUN_FIXES.get(lang, []):
        out = re.sub(pat, repl, out)
    return out


def wrap_localized_srt(text: str, lang: str, is_narration: bool) -> str:
    clean = re.sub(r"\s+", " ", strip_html(text)).strip()
    # Keep SRT readable on 2 lines if long
    if lang in ("ja", "zh-Hans", "zh-Hant"):
        if len(clean) > 22:
            mid = len(clean) // 2
            # Prefer splitting near punctuation
            split_idx = mid
            for offset in range(0, 8):
                for sign in (1, -1):
                    p = mid + sign * offset
                    if 6 < p < len(clean) - 4 and clean[p] in "、。，！？—… ":
                        split_idx = p + (0 if clean[p] == " " else 1)
                        break
                else:
                    continue
                break
            clean = clean[:split_idx].strip() + "\n" + clean[split_idx:].strip()
    else:
        if len(clean) > 44:
            words = clean.split(" ")
            if len(words) > 2:
                best_i = len(words) // 2
                best_diff = 10**9
                for i in range(1, len(words)):
                    a = " ".join(words[:i])
                    b = " ".join(words[i:])
                    diff = abs(len(a) - len(b))
                    if diff < best_diff:
                        best_diff = diff
                        best_i = i
                clean = " ".join(words[:best_i]) + "\n" + " ".join(words[best_i:])
    if is_narration:
        clean = f"<i>{clean}</i>"
    return clean


def get_localized_texts(lang: str, cues: List[AlignedCue]) -> List[str]:
    """Return 719 localized display texts (without outer <i> tags) cached per language."""
    cache_path = WORK_DIR / f"translations_{lang}.json"
    if cache_path.is_file():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        if isinstance(cached, list) and len(cached) == len(cues):
            return cached

    if lang == "ko":
        # Reuse existing 1:1 aligned KO SRTs across all 40 episodes
        ko_by_ep: Dict[int, List[str]] = {}
        for ep in range(1, 41):
            ko_srt = STUDIO_DIR / f"ep{ep:02d}_en" / f"SNSHero_StudioAnime_EP{ep:02d}_KO.srt"
            blocks = parse_srt_file(ko_srt)
            ko_by_ep[ep] = [strip_html(txt) for _, _, txt in blocks]
        texts = [ko_by_ep[c.ep][c.ep_cue_idx] for c in cues]
        cache_path.write_text(json.dumps(texts, ensure_ascii=False, indent=2), encoding="utf-8")
        return texts

    tl = GT_CODES[lang]
    texts: List[str] = [""] * len(cues)
    batch_size = 12
    sep = "\n@@SNSEP@@\n"

    for start in range(0, len(cues), batch_size):
        chunk = cues[start : start + batch_size]
        joined = sep.join(c.clean_text_en for c in chunk)
        try:
            translated = _gt_translate_raw(joined, tl)
            parts = re.split(r"\s*@@\s*SNSEP\s*@@\s*", translated)
            if len(parts) == len(chunk):
                for j, p in enumerate(parts):
                    texts[start + j] = apply_glossary(lang, p)
                time.sleep(0.15)
                continue
        except Exception:
            pass

        # Fallback: line-by-line within this batch
        for j, c in enumerate(chunk):
            tr = _gt_translate_raw(c.clean_text_en, tl)
            texts[start + j] = apply_glossary(lang, tr)
            time.sleep(0.12)

        if (start // batch_size) % 10 == 0:
            print(f"      [{lang}] translated {min(start + batch_size, len(cues))}/{len(cues)} cues...")

    cache_path.write_text(json.dumps(texts, ensure_ascii=False, indent=2), encoding="utf-8")
    return texts


def write_localized_srt(lang: str, cues: List[AlignedCue], texts: List[str]) -> Path:
    tag = LANG_TAGS[lang]
    out_srt = STUDIO_DIR / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"
    with out_srt.open("w", encoding="utf-8") as fh:
        for c, txt in zip(cues, texts):
            body = wrap_localized_srt(txt, lang, c.is_narration)
            fh.write(f"{c.idx}\n{fmt_srt_ts(c.start_sec)} --> {fmt_srt_ts(c.end_sec)}\n{body}\n\n")
    return out_srt


# ---------------------------------------------------------------------------
# Concurrent edge-tts Synthesis & Slot-Fit Audio Normalization
# ---------------------------------------------------------------------------

def _download_gtts_vi(text: str, mp3_path: Path) -> None:
    """Fallback free Google Translate TTS for Vietnamese cues rejected by edge-tts."""
    words = text.split()
    chunks: List[str] = []
    cur: List[str] = []
    for w in words:
        cand = " ".join(cur + [w])
        if len(cand) > 170 and cur:
            chunks.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        chunks.append(" ".join(cur))
    if not chunks:
        chunks = [text[:170]]

    audio_bytes = bytearray()
    for ch in chunks:
        url = (
            "https://translate.google.com/translate_tts"
            f"?ie=UTF-8&tl=vi&client=tw-ob&q={urllib.parse.quote(ch)}"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            audio_bytes.extend(resp.read())
    if len(audio_bytes) < 200:
        raise RuntimeError(f"Google TTS returned empty audio for: {text[:60]}")
    mp3_path.write_bytes(bytes(audio_bytes))


async def _synth_one_tts(
    sem: asyncio.Semaphore,
    lang: str,
    cue: AlignedCue,
    text: str,
    voice: str,
    pitch: str,
    mp3_path: Path,
    pace_sec: float = 0.0,
) -> None:
    if mp3_path.is_file() and mp3_path.stat().st_size > 800:
        return
    clean_tts = re.sub(r"\s+", " ", strip_html(text)).strip()
    if not clean_tts:
        clean_tts = "..."

    male_shift_marker = mp3_path.with_suffix(".male_shift")
    is_male_archetype = cue.archetype in ("male_lead", "male_deep", "elder_male", "narrator")

    async with sem:
        last_exc: Optional[Exception] = None
        # 1. Try primary voice (1 fast attempt for degraded vi-VN-NamMinhNeural, 3 otherwise)
        primary_attempts = 1 if (lang == "vi" and voice == "vi-VN-NamMinhNeural") else 3
        for attempt in range(primary_attempts):
            use_pitch = pitch if attempt == 0 else "+0Hz"
            try:
                comm = edge_tts.Communicate(clean_tts, voice=voice, rate="+0%", pitch=use_pitch)
                await asyncio.wait_for(comm.save(str(mp3_path)), timeout=18.0)
                if mp3_path.is_file() and mp3_path.stat().st_size > 200:
                    if male_shift_marker.is_file():
                        male_shift_marker.unlink()
                    if pace_sec > 0.0:
                        await asyncio.sleep(pace_sec)
                    return
            except Exception as exc:
                last_exc = exc
                if mp3_path.is_file() and mp3_path.stat().st_size < 200:
                    mp3_path.unlink(missing_ok=True)
                await asyncio.sleep(0.5 * (2**attempt))

        # 2. Fallback for vi-VN-NamMinhNeural -> vi-VN-HoaiMyNeural (+ male pitch-shift marker)
        if lang == "vi" and voice == "vi-VN-NamMinhNeural":
            for attempt in range(2):
                try:
                    comm = edge_tts.Communicate(clean_tts, voice="vi-VN-HoaiMyNeural", rate="+0%", pitch="+0Hz")
                    await asyncio.wait_for(comm.save(str(mp3_path)), timeout=18.0)
                    if mp3_path.is_file() and mp3_path.stat().st_size > 200:
                        male_shift_marker.write_text("1", encoding="utf-8")
                        return
                except Exception as exc:
                    last_exc = exc
                    if mp3_path.is_file() and mp3_path.stat().st_size < 200:
                        mp3_path.unlink(missing_ok=True)
                    await asyncio.sleep(0.6 * (2**attempt))

        # 3. Final safety net for vi -> Google Translate TTS
        if lang == "vi":
            try:
                await asyncio.wait_for(asyncio.to_thread(_download_gtts_vi, clean_tts, mp3_path), timeout=20.0)
                if is_male_archetype:
                    male_shift_marker.write_text("1", encoding="utf-8")
                return
            except Exception as exc:
                last_exc = exc

        raise RuntimeError(f"TTS failed cue {cue.idx} ({voice}): {last_exc}") from last_exc


async def synthesize_all_tts(
    lang: str,
    cues: List[AlignedCue],
    texts: List[str],
    tts_dir: Path,
) -> List[Path]:
    tts_dir.mkdir(parents=True, exist_ok=True)
    profiles = VOICE_PROFILES[lang]
    sem = asyncio.Semaphore(6 if lang == "vi" else 10)
    pace_sec = 0.0
    mp3_paths: List[Path] = []
    done_count = 0
    total_count = len(cues)

    async def _wrapped(c: AlignedCue, txt: str, voice: str, pitch: str, mp3_p: Path) -> None:
        nonlocal done_count
        await _synth_one_tts(sem, lang, c, txt, voice, pitch, mp3_p, pace_sec=pace_sec)
        done_count += 1
        if done_count % 100 == 0 or done_count == total_count:
            print(f"      [{lang}] TTS progress: {done_count}/{total_count}", flush=True)

    tasks = []
    for c, txt in zip(cues, texts):
        voice, pitch = profiles[c.archetype]
        mp3_p = tts_dir / f"cue_{c.idx:04d}.mp3"
        mp3_paths.append(mp3_p)
        tasks.append(_wrapped(c, txt, voice, pitch, mp3_p))

    t0 = time.time()
    await asyncio.gather(*tasks)
    print(f"      [{lang}] edge-tts synthesized {len(mp3_paths)} clips in {time.time() - t0:.1f}s", flush=True)
    return mp3_paths


def decode_and_fit_cue(mp3_path: Path, slot_dur: float) -> np.ndarray:
    """Decode MP3 to 48kHz stereo float32, speed up cleanly if > slot_dur, normalize RMS."""
    male_shift = mp3_path.with_suffix(".male_shift").is_file()
    shift_prefix = "aresample=48000,asetrate=48000*0.817,aresample=48000,atempo=1.224," if male_shift else ""
    base_af = f"{shift_prefix}silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB"

    raw = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(mp3_path),
            "-af", base_af,
            "-f", "s16le", "-acodec", "pcm_s16le", "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS),
            "pipe:1",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    ).stdout

    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if samples.size == 0:
        return np.zeros((0, 2), dtype=np.float32)
    stereo = samples.reshape(-1, 2)
    dur = stereo.shape[0] / SAMPLE_RATE

    if dur > slot_dur and slot_dur > 0.3:
        factor = min(1.38, dur / slot_dur)
        if factor > 1.02:
            raw2 = subprocess.run(
                [
                    "ffmpeg", "-v", "error", "-i", str(mp3_path),
                    "-af", f"{base_af},atempo={factor:.4f}",
                    "-f", "s16le", "-acodec", "pcm_s16le", "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS),
                    "pipe:1",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
            ).stdout
            s2 = np.frombuffer(raw2, dtype=np.int16).astype(np.float32) / 32768.0
            if s2.size > 0:
                stereo = s2.reshape(-1, 2)

    max_n = int(round(slot_dur * SAMPLE_RATE))
    if stereo.shape[0] > max_n and max_n > int(0.1 * SAMPLE_RATE):
        stereo = stereo[:max_n].copy()
        fade_n = min(max_n, int(0.04 * SAMPLE_RATE))
        fade = np.linspace(1.0, 0.0, fade_n, dtype=np.float32)[:, None]
        stereo[-fade_n:] *= fade

    # RMS normalize active speech (ignore near-silence)
    energy = np.sqrt(np.mean(stereo**2, axis=1))
    active = stereo[energy > 0.015]
    if active.size > 200:
        rms = float(np.sqrt(np.mean(active**2)))
        if rms > 1e-4:
            gain = min(3.5, TARGET_VOCAL_RMS / rms)
            stereo *= gain

    # Soft peak safety
    peak = float(np.max(np.abs(stereo))) if stereo.size else 0.0
    if peak > 0.90:
        stereo *= 0.90 / peak

    # Micro 12ms fade-in/out to prevent boundary clicks
    micro = min(stereo.shape[0] // 4, int(0.012 * SAMPLE_RATE))
    if micro > 4:
        stereo[:micro] *= np.linspace(0.0, 1.0, micro, dtype=np.float32)[:, None]
        stereo[-micro:] *= np.linspace(1.0, 0.0, micro, dtype=np.float32)[:, None]

    return stereo


# ---------------------------------------------------------------------------
# Audio Bed Extraction & Per-Episode Act BGM Reconstruction
# ---------------------------------------------------------------------------

def ensure_master_wav() -> Tuple[Path, int]:
    master_wav = WORK_DIR / "master_en_48k.wav"
    if not master_wav.is_file():
        print("[prep] Extracting 48kHz stereo PCM from EN master MP4...")
        run_cmd(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(MASTER_MP4),
                "-vn", "-c:a", "pcm_s16le", "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS),
                str(master_wav),
            ],
            check=True,
        )
    with wave.open(str(master_wav), "rb") as wf:
        nframes = wf.getnframes()
    return master_wav, nframes


def load_bgm_library() -> Dict[str, np.ndarray]:
    lib: Dict[str, np.ndarray] = {}
    for name in ALLOWED_BGM_NAMES:
        p = BGM_DIR / name
        raw = subprocess.run(
            [
                "ffmpeg", "-v", "error", "-i", str(p),
                "-f", "s16le", "-acodec", "pcm_s16le", "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS),
                "pipe:1",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        ).stdout
        arr = (np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0).reshape(-1, 2)
        lib[name] = arr
    return lib


def get_ep_act_bgm_name(ep: int, act: int) -> str:
    act_json = STUDIO_DIR / f"ep{ep:02d}_en" / "act_bgm.json"
    if act_json.is_file():
        raw_map = json.loads(act_json.read_text(encoding="utf-8"))
        for k, v in raw_map.items():
            if int(str(k).lower().replace("act", "").strip()) == act:
                fname = Path(str(v)).name
                if fname == "tavern_hub.mp3":
                    return "mulligan.mp3"
                if fname in ALLOWED_BGM_NAMES:
                    return fname
    return DEFAULT_ACT_BGM.get(act, "mulligan.mp3")


def sample_looped_bgm(bgm_arr: np.ndarray, start_sample: int, length: int) -> np.ndarray:
    n = bgm_arr.shape[0]
    idx = (np.arange(length, dtype=np.int64) + start_sample) % n
    return bgm_arr[idx]


def mix_language_audio(
    lang: str,
    master_wav: Path,
    total_frames: int,
    cues: List[AlignedCue],
    mp3_paths: List[Path],
    bgm_lib: Dict[str, np.ndarray],
) -> Path:
    mix_wav = WORK_DIR / f"mix_{lang}.wav"
    print(f"      [{lang}] Decoding, slot-fitting, and mixing 719 cues onto 48kHz bed...")

    # Load master PCM into writable float/int16 buffer (1.08 GB int16)
    with wave.open(str(master_wav), "rb") as wf:
        pcm_bytes = wf.readframes(total_frames)
    master_i16 = np.frombuffer(pcm_bytes, dtype=np.int16).reshape(-1, 2).copy()

    # Build continuous speech suppression envelope [0..1] across timeline
    env = np.zeros(total_frames, dtype=np.float32)
    fade_n = int(round(CROSSFADE_SEC * SAMPLE_RATE))

    cue_placements: List[Tuple[int, np.ndarray, str]] = []
    for i, (c, mp3_p) in enumerate(zip(cues, mp3_paths)):
        next_start = cues[i + 1].start_sec if i + 1 < len(cues) else c.end_sec + 5.0
        slot_dur = max(1.0, min(c.end_sec - c.start_sec, next_start - c.start_sec - 0.08))
        dub_arr = decode_and_fit_cue(mp3_p, slot_dur)

        s0 = max(0, int(round(c.start_sec * SAMPLE_RATE)))
        actual_end_s = min(total_frames, s0 + max(dub_arr.shape[0], int(round((c.end_sec - c.start_sec) * SAMPLE_RATE))))
        # Fade envelope spans [s0 - fade_n, actual_end_s + fade_n]
        w0 = max(0, s0 - fade_n)
        w1 = min(total_frames, actual_end_s + fade_n)

        win = np.ones(w1 - w0, dtype=np.float32)
        in_len = s0 - w0
        if in_len > 0:
            t_in = np.linspace(0.0, np.pi, in_len, dtype=np.float32)
            win[:in_len] = 0.5 * (1.0 - np.cos(t_in))
        out_len = w1 - actual_end_s
        if out_len > 0:
            t_out = np.linspace(0.0, np.pi, out_len, dtype=np.float32)
            win[-out_len:] = 0.5 * (1.0 + np.cos(t_out))

        env[w0:w1] = np.maximum(env[w0:w1], win)
        bgm_name = get_ep_act_bgm_name(c.ep, c.act)
        cue_placements.append((s0, dub_arr, bgm_name))

    # Process only contiguous active regions (env > 0) so Intro, Ending, and non-speech stay bit-identical
    active_mask = env > 1e-5
    diff = np.diff(active_mask.astype(np.int8), prepend=0, append=0)
    starts = np.where(diff == 1)[0]
    ends = np.where(diff == -1)[0]

    # Map each active window to an output float buffer of just that region
    region_bufs: List[Tuple[int, int, np.ndarray]] = []
    for rs, re_idx in zip(starts, ends):
        orig_f = master_i16[rs:re_idx].astype(np.float32) / 32768.0
        e_slice = env[rs:re_idx, None]
        buf = orig_f * (1.0 - e_slice)
        region_bufs.append((int(rs), int(re_idx), buf))

    # Add reconstructed clean Act BGM (-20dB) weighted by env + dubbed speech
    # Use a pointer into region_bufs since cues are strictly sorted by s0
    reg_idx = 0
    for rs, re_idx, buf in region_bufs:
        # Find cues overlapping [rs, re_idx] for BGM selection
        # Dominant BGM for region = first overlapping cue's Act BGM
        bgm_name = "mulligan.mp3"
        for s0, dub_arr, bname in cue_placements:
            if s0 < re_idx and (s0 + max(dub_arr.shape[0], SAMPLE_RATE)) > rs:
                bgm_name = bname
                break
        bgm_slice = sample_looped_bgm(bgm_lib[bgm_name], rs, re_idx - rs)
        e_slice = env[rs:re_idx, None]
        buf += bgm_slice * (BGM_DUCK_GAIN * e_slice)

    for s0, dub_arr, _ in cue_placements:
        if dub_arr.shape[0] == 0:
            continue
        s1 = min(total_frames, s0 + dub_arr.shape[0])
        while reg_idx < len(region_bufs) and region_bufs[reg_idx][1] <= s0:
            reg_idx += 1
        # Place into any overlapping region buffers
        k = reg_idx
        while k < len(region_bufs) and region_bufs[k][0] < s1:
            rs, re_idx, buf = region_bufs[k]
            ov0 = max(s0, rs)
            ov1 = min(s1, re_idx)
            if ov1 > ov0:
                buf[ov0 - rs : ov1 - rs] += dub_arr[ov0 - s0 : ov1 - s0]
            k += 1

    # Write modified active regions back into master_i16 with soft peak safety
    for rs, re_idx, buf in region_bufs:
        np.clip(buf, -0.98, 0.98, out=buf)
        master_i16[rs:re_idx] = np.round(buf * 32767.0).astype(np.int16)

    with wave.open(str(mix_wav), "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(master_i16.tobytes())

    return mix_wav


# ---------------------------------------------------------------------------
# 2-Pass Loudnorm + -c:v copy Muxing + Verification
# ---------------------------------------------------------------------------

def measure_loudnorm(wav_or_mp4: Path, ss: Optional[float] = None, dur: Optional[float] = None) -> Dict[str, Any]:
    cmd = ["ffmpeg", "-y"]
    if ss is not None:
        cmd.extend(["-ss", f"{ss:.3f}"])
    if dur is not None:
        cmd.extend(["-t", f"{dur:.3f}"])
    cmd.extend(["-i", str(wav_or_mp4), "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"])
    res = run_cmd(cmd, capture=True, check=False)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", res.stderr, re.DOTALL)
    if not m:
        raise RuntimeError(f"loudnorm measurement failed on {wav_or_mp4}: {res.stderr[-400:]}")
    return json.loads(m.group(0))


def mux_with_loudnorm(lang: str, mix_wav: Path, out_mp4: Path) -> Dict[str, Any]:
    print(f"      [{lang}] Loudness Pass 1 (measuring 94-min track)...")
    stats = measure_loudnorm(mix_wav)
    ln_filter = (
        f"loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
        f"measured_I={stats['input_i']}:"
        f"measured_TP={stats['input_tp']}:"
        f"measured_LRA={stats['input_lra']}:"
        f"measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}"
    )
    print(
        f"      [{lang}] Pass 2 + -c:v copy muxing -> {out_mp4.name} "
        f"(input_i={stats['input_i']} LUFS, input_tp={stats['input_tp']} dBTP)..."
    )
    tmp_out = out_mp4.with_suffix(".tmp.mp4")
    run_cmd(
        [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(MASTER_MP4),
            "-i", str(mix_wav),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy",
            "-af", ln_filter,
            "-c:a", "aac", "-b:a", "192k", "-ar", str(SAMPLE_RATE), "-ac", str(CHANNELS),
            "-shortest", "-movflags", "+faststart",
            str(tmp_out),
        ],
        check=True,
    )
    tmp_out.replace(out_mp4)
    return stats


def verify_single_output(lang: str, chapters_meta: Dict[str, Any]) -> Dict[str, Any]:
    tag = LANG_TAGS[lang]
    mp4_path = STUDIO_DIR / f"SNSHero_Full_Anime_EP01_EP40_{tag}_16x9.mp4"
    srt_path = STUDIO_DIR / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"

    if not mp4_path.is_file():
        raise FileNotFoundError(f"Missing MP4: {mp4_path}")
    if not srt_path.is_file():
        raise FileNotFoundError(f"Missing SRT: {srt_path}")

    info = probe_media(mp4_path)
    v_streams = [s for s in info["streams"] if s["codec_type"] == "video"]
    a_streams = [s for s in info["streams"] if s["codec_type"] == "audio"]
    assert len(v_streams) == 1 and len(a_streams) == 1, f"Unexpected stream count in {mp4_path}"
    v = v_streams[0]
    a = a_streams[0]

    v_dur = float(v["duration"])
    a_dur = float(a["duration"])
    va_diff = abs(v_dur - a_dur)
    assert v["codec_name"] == "h264" and int(v["width"]) == 1280 and int(v["height"]) == 720, "Video spec mismatch"
    assert a["codec_name"] == "aac" and int(a["sample_rate"]) == 48000 and int(a["channels"]) == 2, "Audio spec mismatch"
    assert va_diff < 1.0, f"V/A drift {va_diff:.3f}s >= 1.0s"

    srt_blocks = parse_srt_file(srt_path)
    assert len(srt_blocks) == 719, f"SRT cue count {len(srt_blocks)} != 719"

    # Spot-check loudness on Intro (0..43s), Main early (60..240s), Main mid (2800..2920s), Ending (5607..5655s)
    ending_start = float(chapters_meta["chapters"][-1]["start_sec"])
    spot_intro = measure_loudnorm(mp4_path, ss=0.0, dur=42.5)
    spot_main_1 = measure_loudnorm(mp4_path, ss=60.0, dur=180.0)
    spot_main_2 = measure_loudnorm(mp4_path, ss=2800.0, dur=120.0)
    spot_ending = measure_loudnorm(mp4_path, ss=ending_start, dur=48.0)

    def _f(d: Dict[str, Any], key: str) -> float:
        return float(d[key])

    # Verify no clipping across all spot checks
    max_tp = max(
        _f(spot_intro, "input_tp"),
        _f(spot_main_1, "input_tp"),
        _f(spot_main_2, "input_tp"),
        _f(spot_ending, "input_tp"),
    )
    assert max_tp <= -0.5, f"True peak clipping detected: {max_tp:.2f} dBTP"

    result = {
        "lang": lang,
        "tag": tag,
        "mp4": str(mp4_path.relative_to(REPO_ROOT)),
        "size_gb": round(mp4_path.stat().st_size / (1024**3), 3),
        "srt": str(srt_path.relative_to(REPO_ROOT)),
        "srt_cues": len(srt_blocks),
        "video_codec": f"{v['codec_name']} ({v.get('profile')})",
        "resolution": f"{v['width']}x{v['height']}",
        "fps": v["r_frame_rate"],
        "audio_codec": f"{a['codec_name']} {a['sample_rate']}Hz {a['channels']}ch",
        "video_duration_sec": round(v_dur, 3),
        "audio_duration_sec": round(a_dur, 3),
        "va_diff_sec": round(va_diff, 4),
        "loudness_spots": {
            "intro_lufs": _f(spot_intro, "input_i"),
            "main_early_lufs": _f(spot_main_1, "input_i"),
            "main_mid_lufs": _f(spot_main_2, "input_i"),
            "ending_lufs": _f(spot_ending, "input_i"),
            "max_true_peak_dbtp": max_tp,
        },
        "status": "PASS",
    }
    return result


def build_language(
    lang: str,
    cues: List[AlignedCue],
    chapters_meta: Dict[str, Any],
    master_wav: Path,
    total_frames: int,
    bgm_lib: Dict[str, np.ndarray],
    force: bool,
    keep_cache: bool,
) -> Dict[str, Any]:
    tag = LANG_TAGS[lang]
    out_mp4 = STUDIO_DIR / f"SNSHero_Full_Anime_EP01_EP40_{tag}_16x9.mp4"
    out_srt = STUDIO_DIR / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"

    if out_mp4.is_file() and out_srt.is_file() and not force:
        print(f"[{lang}] Existing MP4 & SRT found; verifying (--force to rebuild)...")
        return verify_single_output(lang, chapters_meta)

    print(f"\n=== [{lang} -> {tag}] Starting dubbing build ===")
    texts = get_localized_texts(lang, cues)
    write_localized_srt(lang, cues, texts)
    print(f"      [{lang}] Wrote {out_srt.name} ({len(texts)} cues)")

    tts_dir = WORK_DIR / f"tts_{lang}"
    mp3_paths = asyncio.run(synthesize_all_tts(lang, cues, texts, tts_dir))
    mix_wav = mix_language_audio(lang, master_wav, total_frames, cues, mp3_paths, bgm_lib)
    mux_with_loudnorm(lang, mix_wav, out_mp4)
    res = verify_single_output(lang, chapters_meta)
    print(
        f"      [{lang}] VERIFIED PASS | size={res['size_gb']}GB | V/A diff={res['va_diff_sec']}s | "
        f"main_lufs={res['loudness_spots']['main_early_lufs']} / {res['loudness_spots']['main_mid_lufs']} | "
        f"TP={res['loudness_spots']['max_true_peak_dbtp']} dBTP"
    )

    if not keep_cache:
        if mix_wav.is_file():
            mix_wav.unlink()
        if tts_dir.is_dir():
            shutil.rmtree(tts_dir, ignore_errors=True)
        print(f"      [{lang}] Cleaned temp TTS & mix WAV cache.")

    return res


def main() -> int:
    parser = argparse.ArgumentParser(description="Build 9 localized dubs of SNSHero Full Anime EP01-EP40")
    parser.add_argument(
        "--langs",
        default=",".join(LANG_ORDER),
        help="Comma-separated target language codes (default: all 9)",
    )
    parser.add_argument("--force", action="store_true", help="Rebuild even if MP4/SRT already exist")
    parser.add_argument("--keep-cache", action="store_true", help="Keep per-language TTS & mix WAV temp files")
    parser.add_argument("--verify-only", action="store_true", help="Verify all 10 official languages only")
    args = parser.parse_args()

    for req_p in (MASTER_MP4, MASTER_SRT, MASTER_CHAPTERS):
        if not req_p.is_file():
            print(f"ERROR: Missing master artifact: {req_p}", file=sys.stderr)
            return 1

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    cues, chapters_meta = load_aligned_cues()
    print(f"Loaded {len(cues)} aligned cues across EP01–EP40.")

    if args.verify_only:
        all_langs = ["en"] + LANG_ORDER
        report = []
        for lg in all_langs:
            r = verify_single_output(lg, chapters_meta)
            report.append(r)
            print(
                f"[VERIFY {r['tag']:7s}] {r['size_gb']:.3f} GB | {r['srt_cues']} cues | "
                f"V/A diff={r['va_diff_sec']}s | intro={r['loudness_spots']['intro_lufs']} "
                f"main={r['loudness_spots']['main_early_lufs']}/{r['loudness_spots']['main_mid_lufs']} "
                f"end={r['loudness_spots']['ending_lufs']} LUFS | TP={r['loudness_spots']['max_true_peak_dbtp']}"
            )
        VERIFY_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Saved verification report -> {VERIFY_JSON}")
        return 0

    selected = [x.strip() for x in args.langs.split(",") if x.strip()]
    for lg in selected:
        if lg not in LANG_ORDER:
            print(f"ERROR: Unsupported language '{lg}'. Choose from: {LANG_ORDER}", file=sys.stderr)
            return 1

    master_wav, total_frames = ensure_master_wav()
    bgm_lib = load_bgm_library()

    results = []
    for lg in selected:
        res = build_language(
            lang=lg,
            cues=cues,
            chapters_meta=chapters_meta,
            master_wav=master_wav,
            total_frames=total_frames,
            bgm_lib=bgm_lib,
            force=args.force,
            keep_cache=args.keep_cache,
        )
        results.append(res)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
