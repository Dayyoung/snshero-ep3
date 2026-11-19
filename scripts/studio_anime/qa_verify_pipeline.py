#!/usr/bin/env python3
"""
Studio Quality & Continuity Verifier for SNSHero Studio Anime Pipeline.

Supports:
  --ep N --gate 1  : Storyboard, keyframes, and Veo prompt QA -> qa_report_gate1.md
  --ep N --gate 2  : Downloaded Veo clips ffprobe QA + 6x4 contact sheet -> qa_report_gate2.md
"""

from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

EXPECTED_CUTS = 24
EXPECTED_WIDTH = 1280
EXPECTED_HEIGHT = 720
MIN_KEYFRAME_BYTES = 50 * 1024  # 50 KB
MIN_CLIP_BYTES = 100 * 1024     # 100 KB
MIN_CLIP_DURATION = 4.5
MAX_CLIP_DURATION = 7.0
MAX_DIALOGUE_WORDS = 15

BANNED_COPYRIGHT_TERMS = [
    "Demon Slayer",
    "ufotable",
    "Kimetsu",
    "Ghibli",
    "Shinkai",
    "MAPPA",
    "Disney",
    "Pixar",
]

BANNED_GORE_REGEX = re.compile(
    r"\b(blood|bloody|kill|killed|killing|corpse|corpses|slaughter|massacre|severed|decapitated)\b",
    re.IGNORECASE,
)

BANNED_FILTER_REGEX = re.compile(
    r"\b(hercul|hercules)\b",
    re.IGNORECASE,
)

NO_TEXT_PATTERNS = [
    r"\bno[\s-]+text\b",
    r"\bzero[\s-]+text\b",
    r"\btext[\s-]+free\b",
    r"\bno[\s-]+subtitles?\b",
    r"\bzero[\s-]+subtitles?\b",
    r"\bno[\s-]+captions?\b",
    r"\bzero[\s-]+captions?\b",
    r"\bno[\s-]+letters?\b",
    r"\bno[\s-]+watermarks?\b",
    r"\bno[\s-]+speech[\s-]+bubbles?\b",
    r"\bwithout[\s]+(?:any[\s]+)?text\b",
]
NO_TEXT_REGEX = re.compile("|".join(NO_TEXT_PATTERNS), re.IGNORECASE)


def find_repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in [here.parent.parent.parent, Path.cwd()]:
        if (parent / "package.json").exists() or (parent / "src").exists():
            return parent
    return Path.cwd()


def word_count(text: str) -> int:
    cleaned = text.strip()
    if not cleaned:
        return 0
    return len(cleaned.split())


def load_json(path: Path) -> tuple[Any | None, str | None]:
    if not path.exists():
        return None, f"File not found: {path}"
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as exc:
        return None, f"Invalid JSON in {path}: {exc}"


def extract_prompt_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("cuts", "prompts", "items"):
            val = data.get(key)
            if isinstance(val, list):
                return val
    return []


def run_gate1(root: Path, ep: int, max_words: int) -> int:
    ep_str = f"{ep:02d}"
    base_dir = root / "output" / "studio_anime" / f"ep{ep_str}_en"
    base_dir.mkdir(parents=True, exist_ok=True)

    storyboard_path = base_dir / f"storyboard_ep{ep_str}_en.json"
    act_bgm_path = base_dir / "act_bgm.json"
    keyframes_dir = base_dir / "keyframes"
    prompts_path = base_dir / f"flow_prompts_ep{ep_str}_en.json"
    report_path = base_dir / "qa_report_gate1.md"

    director_errors: list[str] = []
    curator_errors: list[str] = []
    prompter_errors: list[str] = []
    warnings: list[str] = []

    # 1. Storyboard checks
    sb_data, sb_err = load_json(storyboard_path)
    cuts: list[dict[str, Any]] = []
    audio_counts = {
        "character_dialogue": 0,
        "offscreen_narration": 0,
        "sakuga_action": 0,
        "other": 0,
    }
    max_words_seen = 0
    cut_rows: list[dict[str, Any]] = []

    if sb_err or not isinstance(sb_data, dict):
        director_errors.append(sb_err or "Storyboard root must be a JSON object.")
    else:
        cuts = sb_data.get("cuts", [])
        if not isinstance(cuts, list):
            director_errors.append("Storyboard 'cuts' field must be a list.")
            cuts = []
        elif len(cuts) != EXPECTED_CUTS:
            director_errors.append(
                f"Storyboard has {len(cuts)} cuts (expected {EXPECTED_CUTS})."
            )

        for idx, cut in enumerate(cuts, start=1):
            cut_num = cut.get("cutNumber", idx)
            expected_code = f"EP{ep_str}-CUT{idx:02d}"
            cut_code = cut.get("cutCode", expected_code)
            if cut_code != expected_code:
                director_errors.append(
                    f"Cut #{idx}: cutCode '{cut_code}' != expected '{expected_code}'."
                )

            mode = str(cut.get("audioMode", "")).strip()
            if mode in audio_counts:
                audio_counts[mode] += 1
            else:
                audio_counts["other"] += 1
                director_errors.append(
                    f"{cut_code}: invalid audioMode '{mode}'."
                )

            dialogue = str(cut.get("dialogueEn", "") or "").strip()
            wc = word_count(dialogue)
            if wc > max_words_seen:
                max_words_seen = wc

            if mode in ("character_dialogue", "offscreen_narration"):
                if wc == 0:
                    director_errors.append(
                        f"{cut_code}: audioMode is '{mode}' but dialogueEn is empty."
                    )
                elif wc > max_words:
                    director_errors.append(
                        f"{cut_code}: dialogueEn has {wc} words (max {max_words}): \"{dialogue}\""
                    )
            elif mode == "sakuga_action":
                if wc > 0:
                    director_errors.append(
                        f"{cut_code}: sakuga_action cut must have empty dialogueEn, found {wc} words."
                    )

            src_file = cut.get("sourceWebtoonFile", "")
            if src_file:
                src_path = Path(src_file)
                if not src_path.is_absolute():
                    src_path = root / src_path
                if not src_path.exists():
                    director_errors.append(
                        f"{cut_code}: sourceWebtoonFile not found: {src_file}"
                    )
            else:
                director_errors.append(f"{cut_code}: missing sourceWebtoonFile.")

            cut_rows.append(
                {
                    "idx": idx,
                    "cutCode": cut_code,
                    "mode": mode,
                    "words": wc,
                    "kf_status": "PENDING",
                    "prompt_status": "PENDING",
                }
            )

        if audio_counts["character_dialogue"] < 14:
            director_errors.append(
                f"Audio balance fail: character_dialogue={audio_counts['character_dialogue']} (need >= 14)."
            )
        if audio_counts["offscreen_narration"] > 2:
            director_errors.append(
                f"Audio balance fail: offscreen_narration={audio_counts['offscreen_narration']} (need <= 2)."
            )
        if audio_counts["sakuga_action"] < 5:
            director_errors.append(
                f"Audio balance fail: sakuga_action={audio_counts['sakuga_action']} (need >= 5)."
            )

    # 1b. act_bgm.json check (required for EP02+, optional for EP01)
    act_bgm_status = "N/A (EP01)"
    if ep >= 2 or act_bgm_path.exists():
        bgm_data, bgm_err = load_json(act_bgm_path)
        if bgm_err or not isinstance(bgm_data, dict):
            director_errors.append(bgm_err or "act_bgm.json must be a JSON object.")
            act_bgm_status = "FAIL"
        else:
            bgm_ok = True
            bgm_dir = root / "public" / "hs-assets" / "snshero-audio" / "bgm"
            for act_key in ("1", "2", "3"):
                val = bgm_data.get(act_key)
                if not val or not isinstance(val, str):
                    director_errors.append(f"act_bgm.json missing string mapping for Act '{act_key}'.")
                    bgm_ok = False
                    continue
                cand = Path(val)
                if not cand.is_absolute():
                    cand = root / cand if (root / cand).exists() else bgm_dir / cand.name
                if not cand.exists():
                    director_errors.append(f"act_bgm.json Act '{act_key}' file not found: {val}")
                    bgm_ok = False
            act_bgm_status = "PASS (Acts 1-3 verified)" if bgm_ok else "FAIL"

    # Ensure 24 rows for table even if storyboard failed
    if not cut_rows:
        cut_rows = [
            {
                "idx": i,
                "cutCode": f"EP{ep_str}-CUT{i:02d}",
                "mode": "-",
                "words": 0,
                "kf_status": "PENDING",
                "prompt_status": "PENDING",
            }
            for i in range(1, EXPECTED_CUTS + 1)
        ]

    # 2. Keyframes checks
    kf_pass_count = 0
    for row in cut_rows:
        cut_code = row["cutCode"]
        kf_path = keyframes_dir / f"{cut_code}_keyframe.png"
        if not kf_path.exists():
            curator_errors.append(f"{cut_code}: missing keyframe {kf_path.relative_to(root)}")
            row["kf_status"] = "MISSING"
            continue

        size_bytes = kf_path.stat().st_size
        size_kb = size_bytes / 1024.0
        if size_bytes <= MIN_KEYFRAME_BYTES:
            curator_errors.append(
                f"{cut_code}: keyframe too small ({size_kb:.1f}KB <= 50KB)."
            )
            row["kf_status"] = f"SMALL ({size_kb:.1f}KB)"
            continue

        try:
            with Image.open(kf_path) as img:
                w, h = img.size
                fmt = img.format
            if (w, h) != (EXPECTED_WIDTH, EXPECTED_HEIGHT):
                curator_errors.append(
                    f"{cut_code}: keyframe dimensions {w}x{h} != {EXPECTED_WIDTH}x{EXPECTED_HEIGHT}."
                )
                row["kf_status"] = f"DIM {w}x{h}"
            elif fmt != "PNG":
                curator_errors.append(
                    f"{cut_code}: keyframe format is {fmt}, expected PNG."
                )
                row["kf_status"] = f"FMT {fmt}"
            else:
                kf_pass_count += 1
                row["kf_status"] = f"OK ({w}x{h}, {size_kb:.0f}KB)"
        except Exception as exc:
            curator_errors.append(f"{cut_code}: unreadable keyframe PNG: {exc}")
            row["kf_status"] = "CORRUPT"

    # 3. Flow prompts checks
    prompts_data, prompts_err = load_json(prompts_path)
    prompts_pass_count = 0

    if prompts_err or prompts_data is None:
        prompter_errors.append(prompts_err or "Prompts file unreadable.")
        for row in cut_rows:
            row["prompt_status"] = "MISSING"
    else:
        prompt_list = extract_prompt_list(prompts_data)
        if len(prompt_list) != EXPECTED_CUTS:
            prompter_errors.append(
                f"flow_prompts has {len(prompt_list)} entries (expected {EXPECTED_CUTS})."
            )

        by_code: dict[str, dict[str, Any]] = {}
        for idx, item in enumerate(prompt_list, start=1):
            code = item.get("cutCode") or f"EP{ep_str}-CUT{idx:02d}"
            by_code[code] = item

        for row in cut_rows:
            cut_code = row["cutCode"]
            item = by_code.get(cut_code)
            if not item:
                prompter_errors.append(f"{cut_code}: missing prompt entry in flow_prompts.")
                row["prompt_status"] = "MISSING"
                continue

            prompt_text = str(item.get("veoPromptEn", "") or "")
            item_errs: list[str] = []

            expected_tag = f"[STUDIO ANIME {cut_code}]"
            if expected_tag not in prompt_text:
                item_errs.append(f"missing header tag `{expected_tag}`")

            lower_prompt = prompt_text.lower()
            found_copyright = [
                term for term in BANNED_COPYRIGHT_TERMS if term.lower() in lower_prompt
            ]
            if found_copyright:
                item_errs.append(f"banned copyright/studio term(s): {', '.join(found_copyright)}")

            found_gore = sorted(set(m.group(0) for m in BANNED_GORE_REGEX.finditer(prompt_text)))
            if found_gore:
                item_errs.append(f"banned high-risk gore term(s): {', '.join(found_gore)}")

            found_filter = sorted(set(m.group(0) for m in BANNED_FILTER_REGEX.finditer(prompt_text)))
            if found_filter:
                item_errs.append(f"banned third-party filter term(s): {', '.join(found_filter)}")

            if not NO_TEXT_REGEX.search(prompt_text):
                item_errs.append("missing explicit No-Text rule")

            # Also double-check dialogue word count in prompt metadata if present
            p_mode = str(item.get("audioMode", "")).strip()
            p_dial = str(item.get("dialogueEn", "") or "").strip()
            if p_mode in ("character_dialogue", "offscreen_narration") and word_count(p_dial) > max_words:
                item_errs.append(f"dialogueEn exceeds {max_words} words ({word_count(p_dial)})")

            if item_errs:
                prompter_errors.append(f"{cut_code}: " + "; ".join(item_errs))
                row["prompt_status"] = "FAIL"
            else:
                prompts_pass_count += 1
                row["prompt_status"] = "OK"

    all_errors = director_errors + curator_errors + prompter_errors
    passed = len(all_errors) == 0
    status_str = "PASS" if passed else "FAIL"
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        f"# Studio Anime EP{ep_str} — Gate 1 QA Report",
        "",
        f"- **Status**: **{status_str}**",
        f"- **Checked At**: {now_iso}",
        f"- **Episode**: EP{ep_str} (English Pilot)",
        "",
        "## Summary Metrics",
        "",
        "| Check | Result | Detail |",
        "| --- | --- | --- |",
        f"| Storyboard Cuts | {'PASS' if len(cuts) == EXPECTED_CUTS else 'FAIL'} | {len(cuts)}/{EXPECTED_CUTS} cuts |",
        f"| Audio Balance | {'PASS' if (audio_counts['character_dialogue'] >= 14 and audio_counts['offscreen_narration'] <= 2 and audio_counts['sakuga_action'] >= 5 and audio_counts['other'] == 0) else 'FAIL'} | dialogue={audio_counts['character_dialogue']} (>=14), narration={audio_counts['offscreen_narration']} (<=2), sakuga={audio_counts['sakuga_action']} (>=5) |",
        f"| Max Dialogue Words | {'PASS' if max_words_seen <= max_words else 'FAIL'} | {max_words_seen} words (max {max_words}) |",
        f"| Act BGM Mapping (`act_bgm.json`) | {'PASS' if act_bgm_status != 'FAIL' else 'FAIL'} | {act_bgm_status} |",
        f"| Keyframes (1280x720 PNG >50KB) | {'PASS' if kf_pass_count == EXPECTED_CUTS else 'FAIL'} | {kf_pass_count}/{EXPECTED_CUTS} valid |",
        f"| Flow Prompts (Tags, Safety, No-Text) | {'PASS' if prompts_pass_count == EXPECTED_CUTS else 'FAIL'} | {prompts_pass_count}/{EXPECTED_CUTS} valid |",
        "",
    ]

    if not passed:
        lines.append("## Defects by Owner")
        lines.append("")
        if director_errors:
            lines.append("### `@director` (Storyboard)")
            for e in director_errors:
                lines.append(f"- {e}")
            lines.append("")
        if curator_errors:
            lines.append("### `@curator` (Keyframes)")
            for e in curator_errors:
                lines.append(f"- {e}")
            lines.append("")
        if prompter_errors:
            lines.append("### `@prompter` (Veo Prompts)")
            for e in prompter_errors:
                lines.append(f"- {e}")
            lines.append("")

    if warnings:
        lines.append("## Warnings")
        lines.append("")
        for w in warnings:
            lines.append(f"- {w}")
        lines.append("")

    lines.extend(
        [
            "## Per-Cut Verification Matrix",
            "",
            "| Cut | Audio Mode | Words | Keyframe | Flow Prompt |",
            "| --- | --- | ---: | --- | --- |",
        ]
    )
    for row in cut_rows:
        lines.append(
            f"| {row['cutCode']} | `{row['mode']}` | {row['words']} | {row['kf_status']} | {row['prompt_status']} |"
        )
    lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"[Gate 1] EP{ep_str} => {status_str}")
    print(
        f"  Storyboard: {len(cuts)}/{EXPECTED_CUTS} | "
        f"Audio: dlg={audio_counts['character_dialogue']}, nar={audio_counts['offscreen_narration']}, sakuga={audio_counts['sakuga_action']} | "
        f"Keyframes: {kf_pass_count}/{EXPECTED_CUTS} | Prompts: {prompts_pass_count}/{EXPECTED_CUTS}"
    )
    if all_errors:
        print(f"  Total Defects: {len(all_errors)}")
        for e in all_errors[:20]:
            print(f"    - {e}")
    print(f"  Report written: {report_path}")
    return 0 if passed else 1


def ffprobe_clip(clip_path: Path) -> tuple[dict[str, Any] | None, str | None]:
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(clip_path),
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=20)
        if res.returncode != 0:
            return None, f"ffprobe exit {res.returncode}: {res.stderr.strip()}"
        return json.loads(res.stdout), None
    except Exception as exc:
        return None, f"ffprobe error: {exc}"


def extract_midpoint_frame(clip_path: Path, midpoint_sec: float, width: int, height: int) -> Image.Image | None:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-ss",
        f"{midpoint_sec:.3f}",
        "-i",
        str(clip_path),
        "-frames:v",
        "1",
        "-vf",
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, check=False, timeout=20)
        if res.returncode != 0 or not res.stdout:
            return None
        return Image.open(io.BytesIO(res.stdout)).convert("RGB")
    except Exception:
        return None


def make_placeholder_tile(width: int, height: int, label: str, reason: str) -> Image.Image:
    img = Image.new("RGB", (width, height), (70, 18, 18))
    draw = ImageDraw.Draw(img)
    draw.rectangle([2, 2, width - 3, height - 3], outline=(220, 80, 80), width=2)
    font = ImageFont.load_default()
    draw.text((12, height // 2 - 14), label, fill=(255, 220, 220), font=font)
    draw.text((12, height // 2 + 4), reason[:36], fill=(255, 160, 160), font=font)
    return img


def annotate_tile(img: Image.Image, label: str, ok: bool) -> Image.Image:
    out = img.copy()
    draw = ImageDraw.Draw(out)
    font = ImageFont.load_default()
    badge_color = (16, 120, 48) if ok else (170, 32, 32)
    draw.rectangle([4, 4, 150, 22], fill=badge_color)
    draw.text((8, 8), label, fill=(255, 255, 255), font=font)
    return out


def run_gate2(root: Path, ep: int) -> int:
    ep_str = f"{ep:02d}"
    base_dir = root / "output" / "studio_anime" / f"ep{ep_str}_en"
    base_dir.mkdir(parents=True, exist_ok=True)

    clips_dir = base_dir / "clips"
    contact_sheet_path = base_dir / f"qa_contact_sheet_ep{ep_str}.jpg"
    report_path = base_dir / "qa_report_gate2.md"

    tile_w, tile_h = 320, 180
    cols, rows_n = 6, 4
    sheet = Image.new("RGB", (tile_w * cols, tile_h * rows_n), (15, 15, 18))

    clip_results: list[dict[str, Any]] = []
    failed_cuts: list[str] = []
    passed_count = 0

    for idx in range(1, EXPECTED_CUTS + 1):
        cut_num_str = f"{idx:02d}"
        cut_code = f"EP{ep_str}-CUT{cut_num_str}"
        clip_path = clips_dir / f"{cut_code}.mp4"

        errors: list[str] = []
        size_kb = 0.0
        res_str = "-"
        audio_str = "-"
        dur_val: float | None = None

        if not clip_path.exists():
            errors.append("missing file")
        else:
            size_bytes = clip_path.stat().st_size
            size_kb = size_bytes / 1024.0
            if size_bytes <= MIN_CLIP_BYTES:
                errors.append(f"size {size_kb:.1f}KB <= 100KB")

            meta, err = ffprobe_clip(clip_path)
            if err or not meta:
                errors.append(err or "ffprobe failed")
            else:
                streams = meta.get("streams", [])
                v_streams = [s for s in streams if s.get("codec_type") == "video"]
                a_streams = [s for s in streams if s.get("codec_type") == "audio"]

                if not v_streams:
                    errors.append("no video stream")
                else:
                    vs = v_streams[0]
                    w = int(vs.get("width") or 0)
                    h = int(vs.get("height") or 0)
                    res_str = f"{w}x{h}"
                    if w <= 0 or h <= 0:
                        errors.append(f"invalid resolution {w}x{h}")
                    else:
                        aspect = w / h
                        if abs(aspect - (16.0 / 9.0)) > 0.05:
                            errors.append(f"non-16:9 aspect ({aspect:.3f}, {w}x{h})")

                if not a_streams:
                    errors.append("no audio stream")
                else:
                    audio_str = str(a_streams[0].get("codec_name", "audio"))

                fmt_dur = meta.get("format", {}).get("duration")
                v_dur = v_streams[0].get("duration") if v_streams else None
                raw_dur = fmt_dur if fmt_dur is not None else v_dur
                try:
                    dur_val = float(raw_dur) if raw_dur is not None else None
                except (TypeError, ValueError):
                    dur_val = None

                if dur_val is None:
                    errors.append("unknown duration")
                elif not (MIN_CLIP_DURATION <= dur_val <= MAX_CLIP_DURATION):
                    errors.append(
                        f"duration {dur_val:.2f}s outside [{MIN_CLIP_DURATION}s, {MAX_CLIP_DURATION}s]"
                    )

        ok = len(errors) == 0
        if ok:
            passed_count += 1
        else:
            failed_cuts.append(cut_num_str)

        # Extract midpoint frame for contact sheet
        tile: Image.Image | None = None
        if clip_path.exists() and dur_val and dur_val > 0.2:
            frame = extract_midpoint_frame(clip_path, dur_val / 2.0, tile_w, tile_h)
            if frame is not None:
                badge = f"CUT{cut_num_str} | {dur_val:.1f}s | {'OK' if ok else 'ERR'}"
                tile = annotate_tile(frame, badge, ok)
        if tile is None:
            tile = make_placeholder_tile(
                tile_w,
                tile_h,
                cut_code,
                errors[0] if errors else "frame extract failed",
            )

        grid_idx = idx - 1
        gx = (grid_idx % cols) * tile_w
        gy = (grid_idx // cols) * tile_h
        sheet.paste(tile, (gx, gy))

        clip_results.append(
            {
                "cutCode": cut_code,
                "cutNum": cut_num_str,
                "ok": ok,
                "size_kb": size_kb,
                "res": res_str,
                "audio": audio_str,
                "dur": f"{dur_val:.2f}s" if dur_val is not None else "-",
                "notes": "OK" if ok else "; ".join(errors),
            }
        )

    sheet.save(contact_sheet_path, format="JPEG", quality=90)

    passed = len(failed_cuts) == 0
    status_str = "PASS" if passed else "FAIL"
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        f"# Studio Anime EP{ep_str} — Gate 2 QA Report",
        "",
        f"- **Status**: **{status_str}**",
        f"- **Checked At**: {now_iso}",
        f"- **Clips Passed**: {passed_count}/{EXPECTED_CUTS}",
        f"- **Visual Contact Sheet**: `{contact_sheet_path.relative_to(root)}`",
        "",
    ]

    if failed_cuts:
        lines.extend(
            [
                "## Failed Cuts for `@flow-op` Regeneration",
                "",
                f"- Regenerate command hint: `--ep {ep} --cuts {','.join(failed_cuts)}`",
                "",
            ]
        )

    lines.extend(
        [
            "## Per-Clip Inspection Table",
            "",
            "| Cut | Status | Size (KB) | Resolution | Audio | Duration | Notes |",
            "| --- | --- | ---: | --- | --- | ---: | --- |",
        ]
    )
    for r in clip_results:
        lines.append(
            f"| {r['cutCode']} | {'PASS' if r['ok'] else 'FAIL'} | {r['size_kb']:.1f} | {r['res']} | `{r['audio']}` | {r['dur']} | {r['notes']} |"
        )
    lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"[Gate 2] EP{ep_str} => {status_str} ({passed_count}/{EXPECTED_CUTS} clips valid)")
    if failed_cuts:
        print(f"  Failed cuts: --cuts {','.join(failed_cuts)}")
    print(f"  Contact sheet written: {contact_sheet_path}")
    print(f"  Report written: {report_path}")
    return 0 if passed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="SNSHero Studio Anime QA Verifier")
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument(
        "--gate",
        type=int,
        choices=[1, 2],
        required=True,
        help="QA Gate to run (1=Pre-Flow, 2=Post-Flow Clips)",
    )
    parser.add_argument("--root", type=str, default=None, help="Repository root override")
    parser.add_argument(
        "--max-words",
        type=int,
        default=None,
        help="Max dialogue/narration words per 6s cut (default: 9 for EP02+, 15 for EP01)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve() if args.root else find_repo_root()
    max_words = args.max_words if args.max_words is not None else (9 if args.ep >= 2 else MAX_DIALOGUE_WORDS)
    if args.gate == 1:
        return run_gate1(root, args.ep, max_words)
    return run_gate2(root, args.ep)


if __name__ == "__main__":
    sys.exit(main())
