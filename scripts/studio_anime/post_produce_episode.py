#!/usr/bin/env python3
"""
SNSHero Studio Anime — Post-Production & Audio Mastering Pipeline
Transforms raw Veo 6-second clips into a studio-grade 16:9 anime episode with:
  - Anti-cutoff tight-cut trimming:
      * 0.15s start trim on all cuts
      * 0.05s tail trim on character_dialogue & offscreen_narration (prevents speech cutoff)
      * 0.15s tail trim on sakuga_action cuts (snappy anime pacing)
  - Uniform 1280x720, 24fps, yuv420p, 48kHz stereo normalization
  - Snappy hard cuts within Acts + 0.25s xfade/acrossfade between Acts
  - Per-Act & episode-customizable orchestral BGM with 1.5s crossfades between Acts:
      * Act I  (Atmosphere / Village / Oath): tavern_hub.mp3
      * Act II (Betrayal / Combat / Sakuga):  duel_1.mp3
      * Act III (Aftermath / Emotional Vow):  collection.mp3
      (Customizable via --act-bgm-json, per-episode act_bgm.json, or single-track --bgm)
  - Dynamic BGM ducking (-20dB under dialogue/narration, -14dB during sakuga_action)
  - Two-pass YouTube loudness normalization (loudnorm=I=-14:TP=-1.5:LRA=11)
  - Frame-accurate English SRT subtitles (text-free video master)
  - Desktop export copy & youtube_upload_ready.json metadata with auto-chapters

Usage:
  python3 scripts/studio_anime/post_produce_episode.py --ep 1 --dry-run
  python3 scripts/studio_anime/post_produce_episode.py --ep 1
  python3 scripts/studio_anime/post_produce_episode.py --ep 1 --act-bgm-json path/to/act_bgm.json
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
BGM_DIR = REPO_ROOT / "public/hs-assets/snshero-audio/bgm"

DEFAULT_ACT_BGM_MAP: Dict[int, Path] = {
    1: BGM_DIR / "tavern_hub.mp3",   # Act I: Atmosphere / Village / Oath
    2: BGM_DIR / "duel_1.mp3",       # Act II: Betrayal / Combat / Sakuga
    3: BGM_DIR / "collection.mp3",   # Act III: Aftermath / Emotional Vow
}
FALLBACK_BGM_CANDIDATES = [
    BGM_DIR / "duel_1.mp3",
    BGM_DIR / "duel_2.mp3",
    BGM_DIR / "collection.mp3",
    BGM_DIR / "tavern_hub.mp3",
]
DEFAULT_COPY_DIR = Path("/Users/dayyoung/Desktop/내문서/movie")
BGM_ACT_CROSSFADE_SEC = 1.5


@dataclass
class ClipInfo:
    cut_number: int
    cut_code: str
    act: int
    audio_mode: str
    speaker_en: str
    dialogue_en: str
    transition_out: str
    raw_path: Path
    raw_duration: float
    has_audio: bool
    trim_start: float
    trim_end: float
    trimmed_duration: float
    timeline_start: float = 0.0
    timeline_end: float = 0.0
    norm_path: Optional[Path] = None


def run_cmd(cmd: List[str], capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    if capture:
        return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=check)
    return subprocess.run(cmd, check=check)


def probe_media(path: Path) -> Dict[str, Any]:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_format",
        "-show_streams",
        "-of", "json",
        str(path),
    ]
    res = run_cmd(cmd, capture=True, check=True)
    return json.loads(res.stdout)


def get_duration_and_audio(path: Path) -> Tuple[float, bool]:
    info = probe_media(path)
    duration = float(info.get("format", {}).get("duration", 0.0))
    streams = info.get("streams", [])
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    if duration <= 0.0:
        for s in streams:
            if s.get("duration"):
                duration = max(duration, float(s["duration"]))
    return duration, has_audio


def find_fallback_bgm() -> Optional[Path]:
    for cand in FALLBACK_BGM_CANDIDATES:
        if cand.is_file() and cand.stat().st_size > 10_000:
            return cand
    return None


def resolve_audio_path(raw: str) -> Path:
    p = Path(raw).expanduser()
    if not p.is_absolute():
        p = (REPO_ROOT / p).resolve()
    return p


def resolve_act_bgm_map(
    ep_dir: Path,
    no_bgm: bool,
    single_bgm_arg: Optional[str],
    act_bgm_json_arg: Optional[str],
) -> Dict[int, Path]:
    """
    Resolve per-Act BGM tracks. Priority:
      1. --no-bgm -> {}
      2. --bgm <single_path> -> applies that single track to all Acts (1, 2, 3...)
      3. --act-bgm-json <path> (or auto-detected ep_dir/act_bgm.json)
      4. Built-in mood defaults per Act (tavern_hub / duel_1 / collection)
    """
    if no_bgm:
        return {}

    if single_bgm_arg:
        p = resolve_audio_path(single_bgm_arg)
        if not p.is_file():
            raise FileNotFoundError(f"Specified --bgm file not found: {p}")
        return {0: p}  # sentinel 0 = single track for entire episode

    json_path: Optional[Path] = None
    if act_bgm_json_arg:
        json_path = resolve_audio_path(act_bgm_json_arg)
        if not json_path.is_file():
            raise FileNotFoundError(f"Specified --act-bgm-json file not found: {json_path}")
    elif (ep_dir / "act_bgm.json").is_file():
        json_path = ep_dir / "act_bgm.json"

    resolved: Dict[int, Path] = {}
    if json_path:
        raw_map = json.loads(json_path.read_text(encoding="utf-8"))
        for k, v in raw_map.items():
            act_id = int(str(k).lower().replace("act", "").strip())
            p = resolve_audio_path(str(v))
            if not p.is_file():
                raise FileNotFoundError(f"BGM file for Act {act_id} in {json_path} not found: {p}")
            resolved[act_id] = p

    # Fill missing defaults for Acts 1..3
    for act_id, default_path in DEFAULT_ACT_BGM_MAP.items():
        if act_id not in resolved and default_path.is_file() and default_path.stat().st_size > 10_000:
            resolved[act_id] = default_path

    if not resolved:
        fb = find_fallback_bgm()
        if fb:
            resolved[0] = fb

    return resolved


def compute_act_bgm_segments(
    clips: List[ClipInfo],
    total_duration: float,
    act_bgm_map: Dict[int, Path],
) -> List[Tuple[int, Path, float, float]]:
    """
    Compute contiguous Act spans [(act_id, bgm_path, start_sec, end_sec), ...] covering [0, total_duration].
    Adjacent Acts sharing the exact same BGM file are merged into one continuous span.
    """
    if not act_bgm_map or not clips or total_duration <= 0.0:
        return []

    if 0 in act_bgm_map:
        return [(0, act_bgm_map[0], 0.0, total_duration)]

    fallback = find_fallback_bgm()
    raw_spans: List[Tuple[int, Path, float, float]] = []

    for idx, clip in enumerate(clips):
        bgm_path = act_bgm_map.get(clip.act) or fallback
        if bgm_path is None:
            continue
        start_t = clip.timeline_start if idx > 0 else 0.0
        end_t = clip.timeline_end if idx < len(clips) - 1 else total_duration
        if raw_spans and raw_spans[-1][0] == clip.act:
            prev_act, prev_path, prev_s, _ = raw_spans[-1]
            raw_spans[-1] = (prev_act, prev_path, prev_s, end_t)
        elif raw_spans and raw_spans[-1][1] == bgm_path:
            prev_act, prev_path, prev_s, _ = raw_spans[-1]
            raw_spans[-1] = (prev_act, prev_path, prev_s, end_t)
        else:
            # Anchor boundary cleanly to previous span's end for contiguous partition
            if raw_spans:
                start_t = raw_spans[-1][3]
            raw_spans.append((clip.act, bgm_path, start_t, end_t))

    if raw_spans:
        a0, p0, _, e0 = raw_spans[0]
        raw_spans[0] = (a0, p0, 0.0, e0)
        al, pl, sl, _ = raw_spans[-1]
        raw_spans[-1] = (al, pl, sl, total_duration)

    return raw_spans


def format_srt_time(seconds: float) -> str:
    ms_total = max(0, int(round(seconds * 1000)))
    hours = ms_total // 3_600_000
    rem = ms_total % 3_600_000
    minutes = rem // 60_000
    rem %= 60_000
    secs = rem // 1000
    ms = rem % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def format_chapter_time(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    minutes = total // 60
    secs = total % 60
    return f"{minutes:02d}:{secs:02d}"


def wrap_subtitle_text(text: str, max_line_len: int = 44) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if len(cleaned) <= max_line_len:
        return cleaned
    words = cleaned.split(" ")
    best_split = len(words) // 2
    best_diff = 10**9
    for idx in range(1, len(words)):
        left = " ".join(words[:idx])
        right = " ".join(words[idx:])
        if len(left) <= max_line_len and len(right) <= max_line_len:
            diff = abs(len(left) - len(right))
            if diff < best_diff:
                best_diff = diff
                best_split = idx
    return " ".join(words[:best_split]) + "\n" + " ".join(words[best_split:])


def compute_timeline(clips: List[ClipInfo], crossfade_dur: float) -> float:
    cursor = 0.0
    for idx, clip in enumerate(clips):
        clip.timeline_start = cursor
        clip.timeline_end = cursor + clip.trimmed_duration
        is_last = idx == len(clips) - 1
        if not is_last and clip.transition_out == "crossfade_0.25s":
            overlap = min(crossfade_dur, clip.trimmed_duration * 0.4)
            cursor = clip.timeline_end - overlap
        else:
            cursor = clip.timeline_end
    return clips[-1].timeline_end if clips else 0.0


def build_srt_content(clips: List[ClipInfo], crossfade_dur: float) -> str:
    entries: List[str] = []
    sub_idx = 1
    for i, clip in enumerate(clips):
        if clip.audio_mode not in ("character_dialogue", "offscreen_narration"):
            continue
        dialogue = (clip.dialogue_en or "").strip()
        if not dialogue:
            continue

        prev_xfade = i > 0 and clips[i - 1].transition_out == "crossfade_0.25s"
        lead_in = (crossfade_dur * 0.6) if prev_xfade else 0.10
        lead_out = 0.10

        start_t = clip.timeline_start + lead_in
        end_t = clip.timeline_end - lead_out
        if end_t <= start_t + 0.5:
            start_t = clip.timeline_start + 0.05
            end_t = max(start_t + 0.6, clip.timeline_end - 0.05)

        wrapped = wrap_subtitle_text(dialogue)
        if clip.audio_mode == "offscreen_narration":
            wrapped = f"<i>{wrapped}</i>"

        entries.append(
            f"{sub_idx}\n"
            f"{format_srt_time(start_t)} --> {format_srt_time(end_t)}\n"
            f"{wrapped}\n"
        )
        sub_idx += 1

    return "\n".join(entries)


def normalize_single_clip(
    clip: ClipInfo,
    out_path: Path,
    width: int,
    height: int,
    fps: int,
) -> float:
    """Trim and normalize one clip to uniform 1280x720 24fps yuv420p + 48kHz stereo PCM."""
    fade_edge = 0.02
    fade_out_start = max(0.0, clip.trimmed_duration - fade_edge)

    vf = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1,fps={fps},format=yuv420p"
    )

    if clip.has_audio:
        af = (
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"afade=t=in:st=0:d={fade_edge},"
            f"afade=t=out:st={fade_out_start:.4f}:d={fade_edge}"
        )
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(clip.raw_path),
            "-ss", f"{clip.trim_start:.4f}",
            "-t", f"{clip.trimmed_duration:.4f}",
            "-vf", vf,
            "-af", af,
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
            "-r", str(fps),
            "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(out_path),
        ]
    else:
        vf_trim = (
            f"trim=start={clip.trim_start:.4f}:duration={clip.trimmed_duration:.4f},"
            f"setpts=PTS-STARTPTS,{vf}"
        )
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(clip.raw_path),
            "-f", "lavfi", "-t", f"{clip.trimmed_duration:.4f}",
            "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map", "0:v:0", "-map", "1:a:0",
            "-vf", vf_trim,
            "-t", f"{clip.trimmed_duration:.4f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
            "-r", str(fps),
            "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(out_path),
        ]

    run_cmd(cmd, check=True)
    actual_dur, _ = get_duration_and_audio(out_path)
    return actual_dur


def assemble_segments_with_transitions(
    clips: List[ClipInfo],
    tmp_dir: Path,
    crossfade_dur: float,
    fps: int,
) -> Tuple[Path, float]:
    """
    Group consecutive hard_cut clips into segments, concatenate each segment,
    then join segments with exact 0.25s xfade + acrossfade transitions.
    """
    segments: List[List[ClipInfo]] = []
    current_seg: List[ClipInfo] = []

    for idx, clip in enumerate(clips):
        current_seg.append(clip)
        is_last = idx == len(clips) - 1
        if not is_last and clip.transition_out == "crossfade_0.25s":
            segments.append(current_seg)
            current_seg = []
    if current_seg:
        segments.append(current_seg)

    seg_files: List[Tuple[Path, float]] = []
    for s_idx, seg in enumerate(segments):
        seg_out = tmp_dir / f"segment_{s_idx:02d}.mkv"
        if len(seg) == 1:
            assert seg[0].norm_path is not None
            shutil.copy2(seg[0].norm_path, seg_out)
            dur, _ = get_duration_and_audio(seg_out)
            seg_files.append((seg_out, dur))
            continue

        cmd = ["ffmpeg", "-y", "-v", "error"]
        for c in seg:
            assert c.norm_path is not None
            cmd.extend(["-i", str(c.norm_path)])

        in_labels = "".join(f"[{i}:v:0][{i}:a:0]" for i in range(len(seg)))
        fc = f"{in_labels}concat=n={len(seg)}:v=1:a=1[vout][aout]"
        cmd.extend([
            "-filter_complex", fc,
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
            "-r", str(fps),
            "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(seg_out),
        ])
        run_cmd(cmd, check=True)
        dur, _ = get_duration_and_audio(seg_out)
        seg_files.append((seg_out, dur))

    assembled_path = tmp_dir / "assembled_no_bgm.mkv"
    if len(seg_files) == 1:
        shutil.copy2(seg_files[0][0], assembled_path)
        return assembled_path, seg_files[0][1]

    cmd = ["ffmpeg", "-y", "-v", "error"]
    for sf, _ in seg_files:
        cmd.extend(["-i", str(sf)])

    filter_parts: List[str] = []
    cum_dur = seg_files[0][1]
    prev_v = "[0:v]"
    prev_a = "[0:a]"
    for idx in range(1, len(seg_files)):
        _, next_dur = seg_files[idx]
        offset = max(0.0, cum_dur - crossfade_dur)
        out_v = f"[vx{idx}]" if idx < len(seg_files) - 1 else "[vout]"
        out_a = f"[ax{idx}]" if idx < len(seg_files) - 1 else "[aout]"
        filter_parts.append(
            f"{prev_v}[{idx}:v]xfade=transition=fade:duration={crossfade_dur:.4f}:offset={offset:.4f}{out_v}"
        )
        filter_parts.append(
            f"{prev_a}[{idx}:a]acrossfade=d={crossfade_dur:.4f}:c1=tri:c2=tri{out_a}"
        )
        cum_dur = offset + next_dur
        prev_v = out_v
        prev_a = out_a

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p",
        "-r", str(fps),
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
        str(assembled_path),
    ])
    run_cmd(cmd, check=True)
    final_dur, _ = get_duration_and_audio(assembled_path)
    return assembled_path, final_dur


def build_bgm_volume_expr(clips: List[ClipInfo], action_db: float = -14.0, dialogue_db: float = -20.0) -> str:
    """
    Build an FFmpeg volume expression (eval=frame) that raises BGM to -14dB during
    sakuga_action cuts and ducks it to -20dB during dialogue/narration cuts.
    """
    action_gain = round(10 ** (action_db / 20.0), 5)
    dialogue_gain = round(10 ** (dialogue_db / 20.0), 5)

    action_ranges = [
        (c.timeline_start, c.timeline_end)
        for c in clips
        if c.audio_mode == "sakuga_action"
    ]
    if not action_ranges:
        return f"{dialogue_gain}"

    merged: List[Tuple[float, float]] = []
    for s, e in action_ranges:
        if merged and s <= merged[-1][1] + 0.05:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))

    conds = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in merged)
    return f"if(gt({conds},0),{action_gain},{dialogue_gain})"


def build_act_bgm_bed(
    bgm_spans: List[Tuple[int, Path, float, float]],
    total_duration: float,
    tmp_dir: Path,
    act_xfade: float = BGM_ACT_CROSSFADE_SEC,
) -> Optional[Path]:
    """
    Render a continuous 48kHz stereo BGM bed across all Acts with smooth 1.5s
    acrossfade transitions centered on each Act boundary.
    """
    if not bgm_spans:
        return None

    bed_path = tmp_dir / "bgm_bed_48k.wav"

    if len(bgm_spans) == 1:
        _, track_path, _, _ = bgm_spans[0]
        cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-stream_loop", "-1", "-i", str(track_path),
            "-af", f"atrim=0:{total_duration:.4f},asetpts=PTS-STARTPTS,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo",
            "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(bed_path),
        ]
        run_cmd(cmd, check=True)
        return bed_path

    # Clamp crossfade if any span is very short
    min_span = min(e - s for _, _, s, e in bgm_spans)
    xf = min(act_xfade, max(0.2, min_span * 0.45))

    cmd = ["ffmpeg", "-y", "-v", "error"]
    filter_parts: List[str] = []

    for idx, (_, track_path, start_t, end_t) in enumerate(bgm_spans):
        cmd.extend(["-stream_loop", "-1", "-i", str(track_path)])
        extra_start = (xf / 2.0) if idx > 0 else 0.0
        extra_end = (xf / 2.0) if idx < len(bgm_spans) - 1 else 0.0
        seg_dur = max(0.5, (end_t - start_t) + extra_start + extra_end)
        filter_parts.append(
            f"[{idx}:a]atrim=0:{seg_dur:.4f},asetpts=PTS-STARTPTS,"
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[b{idx}]"
        )

    prev = "[b0]"
    for idx in range(1, len(bgm_spans)):
        out = f"[bx{idx}]" if idx < len(bgm_spans) - 1 else "[bmerged]"
        filter_parts.append(
            f"{prev}[b{idx}]acrossfade=d={xf:.4f}:c1=tri:c2=tri{out}"
        )
        prev = out

    filter_parts.append(f"[bmerged]atrim=0:{total_duration:.4f},asetpts=PTS-STARTPTS[bed]")

    cmd.extend([
        "-filter_complex", ";".join(filter_parts),
        "-map", "[bed]",
        "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
        str(bed_path),
    ])
    run_cmd(cmd, check=True)
    return bed_path


def master_audio_and_encode(
    assembled_path: Path,
    total_duration: float,
    clips: List[ClipInfo],
    bgm_spans: List[Tuple[int, Path, float, float]],
    output_mp4: Path,
    tmp_dir: Path,
    fps: int,
    act_xfade: float = BGM_ACT_CROSSFADE_SEC,
) -> Dict[str, Any]:
    """Build per-Act BGM bed with 1.5s crossfades, duck under dialogue, apply two-pass YouTube loudnorm, and encode MP4."""
    mixed_audio = tmp_dir / "mixed_audio.wav"
    bgm_bed = build_act_bgm_bed(bgm_spans, total_duration, tmp_dir, act_xfade=act_xfade)

    if bgm_bed and bgm_bed.is_file():
        vol_expr = build_bgm_volume_expr(clips, action_db=-14.0, dialogue_db=-20.0)
        fade_out_st = max(0.0, total_duration - 2.0)
        fc = (
            f"[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[main];"
            f"[1:a]atrim=0:{total_duration:.4f},asetpts=PTS-STARTPTS,"
            f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,"
            f"volume='{vol_expr}':eval=frame,"
            f"afade=t=in:st=0:d=1.0,"
            f"afade=t=out:st={fade_out_st:.4f}:d=2.0[bgm];"
            f"[main][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]"
        )
        mix_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(assembled_path),
            "-i", str(bgm_bed),
            "-filter_complex", fc,
            "-map", "[mix]",
            "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(mixed_audio),
        ]
        run_cmd(mix_cmd, check=True)
    else:
        extract_cmd = [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(assembled_path),
            "-vn", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
            str(mixed_audio),
        ]
        run_cmd(extract_cmd, check=True)

    # Pass 1: Measure loudness for exact YouTube -14 LUFS / -1.5 dBTP / LRA 11 normalization
    measure_cmd = [
        "ffmpeg", "-y", "-i", str(mixed_audio),
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ]
    m_res = run_cmd(measure_cmd, capture=True, check=False)
    loudnorm_filter = "loudnorm=I=-14:TP=-1.5:LRA=11"
    loudness_stats: Dict[str, Any] = {}

    json_match = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", m_res.stderr, re.DOTALL)
    if json_match:
        try:
            stats = json.loads(json_match.group(0))
            loudness_stats = stats
            if stats.get("input_i") not in (None, "-inf", "inf"):
                loudnorm_filter = (
                    f"loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:"
                    f"measured_I={stats['input_i']}:"
                    f"measured_TP={stats['input_tp']}:"
                    f"measured_LRA={stats['input_lra']}:"
                    f"measured_thresh={stats['input_thresh']}:"
                    f"offset={stats['target_offset']}"
                )
        except Exception:
            pass

    # Pass 2: Final master H.264 + AAC 48kHz stereo MP4 with faststart
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    final_cmd = [
        "ffmpeg", "-y", "-v", "error",
        "-i", str(assembled_path),
        "-i", str(mixed_audio),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(fps),
        "-movflags", "+faststart",
        "-af", loudnorm_filter,
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        str(output_mp4),
    ]
    run_cmd(final_cmd, check=True)
    return loudness_stats


def _rel_or_str(p: Path) -> str:
    return str(p.relative_to(REPO_ROOT)) if p.is_relative_to(REPO_ROOT) else str(p)


def build_youtube_metadata(
    storyboard: Dict[str, Any],
    clips: List[ClipInfo],
    ep_num: int,
    master_mp4: Path,
    desktop_copy: Optional[Path],
    srt_path: Path,
    bgm_spans: List[Tuple[int, Path, float, float]],
    total_duration: float,
    file_size_bytes: int,
    width: int,
    height: int,
    fps: int,
) -> Dict[str, Any]:
    ep_title = storyboard.get("episodeTitleEn", f"Episode {ep_num}")
    ep_summary = storyboard.get("episodeSummaryEn", "")

    act_starts: Dict[int, float] = {}
    for c in clips:
        if c.act not in act_starts:
            act_starts[c.act] = c.timeline_start

    act_names = {
        1: "Act I — Blizzard Oath",
        2: "Act II — Dawn of Betrayal",
        3: "Act III — Vow Beneath the Snow",
    }
    chapters = []
    for act_id in sorted(act_starts.keys()):
        ts = format_chapter_time(act_starts[act_id])
        label = act_names.get(act_id, f"Act {act_id}")
        chapters.append({"timestamp": ts, "seconds": round(act_starts[act_id], 2), "title": label})

    chapter_lines = "\n".join(f"{ch['timestamp']} {ch['title']}" for ch in chapters)
    yt_title = f"SNSHero Anime EP{ep_num:02d}: {ep_title} | Dark Fantasy Original Anime (EN)"
    if len(yt_title) > 100:
        yt_title = f"SNSHero Anime EP{ep_num:02d}: {ep_title} (EN)"

    description = (
        f"SNSHero: Elwin Village & Kadan's Journey — Official Studio Anime Pilot (Episode {ep_num})\n"
        f"Episode {ep_num}: {ep_title}\n\n"
        f"{ep_summary}\n\n"
        f"Chapters:\n{chapter_lines}\n\n"
        f"Play SNSHero Free in Browser: https://snshero.com\n"
        f"#SNSHero #DarkFantasyAnime #OriginalAnime #IndieAnime #FantasyAnime #AnimePilot"
    )

    bgm_tracks_meta = [
        {
            "act": act_id,
            "track": _rel_or_str(track_path),
            "startSec": round(start_t, 2),
            "endSec": round(end_t, 2),
        }
        for act_id, track_path, start_t, end_t in bgm_spans
    ]

    return {
        "episodeNumber": ep_num,
        "episodeTitleEn": ep_title,
        "title": yt_title,
        "description": description,
        "tags": [
            "SNSHero",
            "Dark Fantasy Anime",
            "Original Anime",
            "Anime Pilot",
            "Kadan's Journey",
            "Elwin Village",
            "Fantasy Animation",
            "English Anime",
            "Indie Anime",
        ],
        "categoryId": "1",
        "defaultLanguage": "en",
        "defaultAudioLanguage": "en",
        "privacyStatus": "unlisted",
        "videoPath": str(master_mp4.relative_to(REPO_ROOT)),
        "videoAbsPath": str(master_mp4),
        "desktopCopyPath": str(desktop_copy) if desktop_copy else None,
        "subtitlePath": str(srt_path.relative_to(REPO_ROOT)),
        "subtitleAbsPath": str(srt_path),
        "bgmTracksByAct": bgm_tracks_meta,
        "bgmActCrossfadeSec": BGM_ACT_CROSSFADE_SEC if len(bgm_spans) > 1 else 0.0,
        "durationSeconds": round(total_duration, 3),
        "fileSizeBytes": file_size_bytes,
        "fileSizeMB": round(file_size_bytes / (1024 * 1024), 2),
        "resolution": f"{width}x{height}",
        "fps": fps,
        "audioSpec": "48kHz stereo AAC 192kbps, per-Act BGM (-20dB dialogue / -14dB sakuga, 1.5s Act xfade), loudnorm -14 LUFS / -1.5 dBTP",
        "textFreeVideo": True,
        "totalCuts": len(clips),
        "chapters": chapters,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Post-produce SNSHero Studio Anime episode.")
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument("--dry-run", action="store_true", help="Validate plan and preview timeline/SRT without rendering")
    parser.add_argument("--trim-start", type=float, default=0.15, help="Seconds to trim from start of each clip (default: 0.15)")
    parser.add_argument("--trim-end", type=float, default=0.15, help="Seconds to trim from end of sakuga_action clips (default: 0.15)")
    parser.add_argument("--dialogue-trim-end", type=float, default=0.05, help="Seconds to trim from end of dialogue/narration clips (default: 0.05, anti-cutoff)")
    parser.add_argument("--crossfade", type=float, default=0.25, help="Visual/audio crossfade duration for crossfade_0.25s cuts (default: 0.25)")
    parser.add_argument("--act-bgm-xfade", type=float, default=BGM_ACT_CROSSFADE_SEC, help="Audio crossfade seconds between Act BGM tracks (default: 1.5)")
    parser.add_argument("--act-bgm-json", type=str, default=None, help="Optional JSON mapping Act number to BGM file path (e.g. {'1':'...','2':'...','3':'...'})")
    parser.add_argument("--bgm", type=str, default=None, help="Optional single BGM audio file override for entire episode")
    parser.add_argument("--no-bgm", action="store_true", help="Disable BGM mixing")
    parser.add_argument("--copy-dir", type=str, default=str(DEFAULT_COPY_DIR), help="Directory to copy final MP4")
    parser.add_argument("--width", type=int, default=1280, help="Output width (default: 1280)")
    parser.add_argument("--height", type=int, default=720, help="Output height (default: 720)")
    parser.add_argument("--fps", type=int, default=24, help="Output framerate (default: 24)")
    args = parser.parse_args()

    ep_num = args.ep
    ep_dir = REPO_ROOT / f"output/studio_anime/ep{ep_num:02d}_en"
    storyboard_path = ep_dir / f"storyboard_ep{ep_num:02d}_en.json"
    clips_dir = ep_dir / "clips"
    master_mp4 = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_16x9.mp4"
    srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN.srt"
    yt_json_path = ep_dir / "youtube_upload_ready.json"

    try:
        act_bgm_map = resolve_act_bgm_map(ep_dir, args.no_bgm, args.bgm, args.act_bgm_json)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1

    print(f"[post_produce] Episode: EP{ep_num:02d}")
    print(f"[post_produce] Storyboard: {storyboard_path}")
    if not act_bgm_map:
        print("[post_produce] BGM: NONE")
    elif 0 in act_bgm_map:
        print(f"[post_produce] BGM (single override): {_rel_or_str(act_bgm_map[0])}")
    else:
        bgm_summary = ", ".join(f"Act {k}={_rel_or_str(v)}" for k, v in sorted(act_bgm_map.items()))
        print(f"[post_produce] Per-Act BGM ({args.act_bgm_xfade}s xfade): {bgm_summary}")
    print(f"[post_produce] Trim rules: start={args.trim_start}s | dialogue/narration tail={args.dialogue_trim_end}s | sakuga tail={args.trim_end}s")

    if not storyboard_path.is_file():
        if args.dry_run:
            print(f"[DRY-RUN] Storyboard not yet present at {storyboard_path}.")
            return 0
        print(f"[ERROR] Storyboard not found: {storyboard_path}", file=sys.stderr)
        return 1

    storyboard = json.loads(storyboard_path.read_text(encoding="utf-8"))
    raw_cuts = storyboard.get("cuts", [])
    if not raw_cuts:
        print("[ERROR] Storyboard contains 0 cuts.", file=sys.stderr)
        return 1

    clips: List[ClipInfo] = []
    missing_clips: List[str] = []

    for cut in raw_cuts:
        cut_num = int(cut["cutNumber"])
        cut_code = cut["cutCode"]
        audio_mode = cut.get("audioMode", "character_dialogue")
        clip_file = clips_dir / f"{cut_code}.mp4"
        if clip_file.is_file() and clip_file.stat().st_size > 10_000:
            raw_dur, has_audio = get_duration_and_audio(clip_file)
        else:
            missing_clips.append(cut_code)
            raw_dur, has_audio = 6.0, True

        t_start = args.trim_start
        t_end = args.dialogue_trim_end if audio_mode in ("character_dialogue", "offscreen_narration") else args.trim_end
        if raw_dur - (t_start + t_end) < 1.5:
            t_start = 0.0
            t_end = 0.0
        trimmed_dur = max(0.5, raw_dur - t_start - t_end)

        clips.append(
            ClipInfo(
                cut_number=cut_num,
                cut_code=cut_code,
                act=int(cut.get("act", 1)),
                audio_mode=audio_mode,
                speaker_en=cut.get("speakerEn", ""),
                dialogue_en=cut.get("dialogueEn", ""),
                transition_out=cut.get("transitionOut", "hard_cut"),
                raw_path=clip_file,
                raw_duration=raw_dur,
                has_audio=has_audio,
                trim_start=t_start,
                trim_end=t_end,
                trimmed_duration=trimmed_dur,
            )
        )

    est_total = compute_timeline(clips, args.crossfade)
    bgm_spans = compute_act_bgm_segments(clips, est_total, act_bgm_map)
    xfade_cuts = [c.cut_code for c in clips[:-1] if c.transition_out == "crossfade_0.25s"]
    dialogue_cnt = sum(1 for c in clips if c.audio_mode == "character_dialogue")
    narration_cnt = sum(1 for c in clips if c.audio_mode == "offscreen_narration")
    sakuga_cnt = sum(1 for c in clips if c.audio_mode == "sakuga_action")

    print(
        f"[post_produce] Cuts: {len(clips)} "
        f"(dialogue={dialogue_cnt}, narration={narration_cnt}, sakuga={sakuga_cnt}) | "
        f"Crossfades({args.crossfade}s): {xfade_cuts} | Est. duration: {est_total:.2f}s"
    )
    for act_id, track_path, s_t, e_t in bgm_spans:
        label = f"Act {act_id}" if act_id > 0 else "Full"
        print(f"  [BGM] {label:5s} ({s_t:6.2f}s -> {e_t:6.2f}s): {_rel_or_str(track_path)}")

    if args.dry_run:
        print(f"[DRY-RUN] Missing raw clips: {len(missing_clips)}/{len(clips)}")
        for c in clips[:6]:
            print(
                f"  {c.cut_code} | Act {c.act} | {c.audio_mode:19s} | trim=({c.trim_start:.2f}s, {c.trim_end:.2f}s) | "
                f"{c.timeline_start:6.2f}s -> {c.timeline_end:6.2f}s | out={c.transition_out}"
            )
        if len(clips) > 6:
            print(f"  ... ({len(clips) - 6} more cuts)")
        srt_preview = build_srt_content(clips, args.crossfade)
        print(f"[DRY-RUN] SRT subtitle cues planned: {srt_preview.count('-->')}")
        print(f"[DRY-RUN] BGM volume expression: {build_bgm_volume_expr(clips)}")
        return 0

    if missing_clips:
        print(f"[ERROR] Missing {len(missing_clips)} raw clips in {clips_dir}: {missing_clips}", file=sys.stderr)
        return 1

    tmp_dir = Path(tempfile.mkdtemp(prefix=f"snshero_ep{ep_num:02d}_post_"))
    try:
        print(f"[post_produce] Stage 1/3: Anti-cutoff trimming & normalizing {len(clips)} clips to {args.width}x{args.height} @{args.fps}fps...")
        for c in clips:
            norm_file = tmp_dir / f"norm_{c.cut_code}.mkv"
            actual_dur = normalize_single_clip(c, norm_file, args.width, args.height, args.fps)
            c.norm_path = norm_file
            c.trimmed_duration = actual_dur

        exact_est_dur = compute_timeline(clips, args.crossfade)

        print("[post_produce] Stage 2/3: Assembling Acts with hard cuts & 0.25s crossfades...")
        assembled_path, assembled_dur = assemble_segments_with_transitions(
            clips, tmp_dir, args.crossfade, args.fps
        )
        bgm_spans = compute_act_bgm_segments(clips, assembled_dur, act_bgm_map)
        print(f"[post_produce] Assembled duration: {assembled_dur:.3f}s (timeline calc: {exact_est_dur:.3f}s)")

        print("[post_produce] Stage 3/3: Building per-Act BGM bed (1.5s xfade) + ducking + two-pass YouTube loudnorm (-14 LUFS)...")
        loudness_stats = master_audio_and_encode(
            assembled_path, assembled_dur, clips, bgm_spans, master_mp4, tmp_dir, args.fps, act_xfade=args.act_bgm_xfade
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    final_dur, final_has_audio = get_duration_and_audio(master_mp4)
    final_size = master_mp4.stat().st_size
    if not final_has_audio or final_size < 100_000:
        print(f"[ERROR] Master verification failed: size={final_size}, has_audio={final_has_audio}", file=sys.stderr)
        return 1

    srt_content = build_srt_content(clips, args.crossfade)
    srt_path.write_text(srt_content, encoding="utf-8")
    srt_cues = srt_content.count("-->")

    desktop_copy_path: Optional[Path] = None
    copy_dir = Path(args.copy_dir).expanduser()
    try:
        copy_dir.mkdir(parents=True, exist_ok=True)
        desktop_copy_path = copy_dir / master_mp4.name
        shutil.copy2(master_mp4, desktop_copy_path)
        shutil.copy2(srt_path, copy_dir / srt_path.name)
    except Exception as exc:
        print(f"[WARN] Could not copy to {copy_dir}: {exc}", file=sys.stderr)
        desktop_copy_path = None

    yt_meta = build_youtube_metadata(
        storyboard=storyboard,
        clips=clips,
        ep_num=ep_num,
        master_mp4=master_mp4,
        desktop_copy=desktop_copy_path,
        srt_path=srt_path,
        bgm_spans=bgm_spans,
        total_duration=final_dur,
        file_size_bytes=final_size,
        width=args.width,
        height=args.height,
        fps=args.fps,
    )
    if loudness_stats:
        yt_meta["loudnessMeasured"] = loudness_stats
    yt_json_path.write_text(json.dumps(yt_meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print("=" * 68)
    print(f"[SUCCESS] Master MP4 : {master_mp4}")
    print(f"[SUCCESS] Duration   : {final_dur:.2f}s | Size: {final_size / (1024 * 1024):.2f} MB ({final_size:,} bytes)")
    print(f"[SUCCESS] SRT Subs   : {srt_path} ({srt_cues} cues)")
    print(f"[SUCCESS] YouTube JSON: {yt_json_path}")
    if desktop_copy_path:
        print(f"[SUCCESS] Desktop Copy: {desktop_copy_path}")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    sys.exit(main())
