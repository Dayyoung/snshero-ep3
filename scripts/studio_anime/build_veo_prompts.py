#!/usr/bin/env python3
"""
SNSHero Studio Anime — Sakuga Veo 3.1 Lite Prompt Builder
=========================================================
Combines:
  - output/studio_anime/ep{N:02d}_en/storyboard_ep{N:02d}_en.json
  - output/studio_anime/ep{N:02d}_en/continuity_bible_ep{N:02d}.json
into:
  - output/studio_anime/ep{N:02d}_en/flow_prompts_ep{N:02d}_en.json

Each cut entry contains:
  cutNumber, cutCode, act, keyframePath, audioMode, speakerEn,
  dialogueEn, transitionOut, veoPromptEn (+ metadata).

Designed for Google Flow Veo 3.1 - Lite (Start Frame Image-to-Video, 16:9, 6s).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
STUDIO_OUT_ROOT = ROOT / "output" / "studio_anime"

# ---------------------------------------------------------------------------
# Veo Safety & Copyright Sanitizer
# ---------------------------------------------------------------------------
# Inspired by skills/video-anime/scripts/generate_flow_videos.py VEO_SAFE_WORD_MAP
# Expanded to guarantee zero copyrighted brand/studio names and zero high-risk
# gore/graphic-violence terms so Google Flow Veo 3.1 - Lite never blocks a cut.

VEO_SAFE_WORD_MAP: List[Tuple[str, str]] = [
    # Copyrighted studio / franchise / creator names
    (r"\bDemon Slayer\b", "premium hand-drawn dark-fantasy anime"),
    (r"\bKimetsu no Yaiba\b", "legendary dark-fantasy animation"),
    (r"\bKimetsu\b", "dark-fantasy anime"),
    (r"\bufotable\b", "cel-shaded dynamic anime"),
    (r"\bMakoto Shinkai\b", "atmospheric cinematic"),
    (r"\bShinkai\b", "cinematic"),
    (r"\bStudio Ghibli\b", "hand-drawn anime"),
    (r"\bGhibli\b", "hand-drawn anime"),
    (r"\bHayao Miyazaki\b", "classic animation"),
    (r"\bMiyazaki\b", "classic animation"),
    (r"\bWit Studio\b", "dynamic action anime"),
    (r"\bMAPPA\b", "high-octane anime"),
    (r"\bKyoto Animation\b", "detailed character anime"),
    (r"\bKyoAni\b", "detailed character anime"),
    (r"\bDisney\b", "fantasy animation"),
    (r"\bPixar\b", "3D animation"),
    (r"\bMarvel\b", "heroic"),
    # Graphic violence / gore terms (Veo policy-safe fantasy equivalents)
    (r"\bblood-soaked\b", "snow-covered"),
    (r"\bbloodstained\b", "weather-worn"),
    (r"\bbloodshed\b", "fierce clash"),
    (r"\bbloodlust\b", "fierce resolve"),
    (r"\bbloodline\b", "ancestral lineage"),
    (r"\bbloodied\b", "battle-worn"),
    (r"\bbleeding\b", "glowing"),
    (r"\bbleeds\b", "glows"),
    (r"\bbleed\b", "glow"),
    (r"\bbloody\b", "crimson"),
    (r"\bblood\w*", "crimson light"),
    (r"\bcorpses\b", "fallen shields"),
    (r"\bcorpse\b", "fallen armor"),
    (r"\bsevered\b", "parted"),
    (r"\bsevering\b", "cutting through"),
    (r"\bsevers\b", "parts"),
    (r"\bsever\b", "part"),
    (r"\bdecapitated\b", "shattered"),
    (r"\bdecapitating\b", "shattering"),
    (r"\bdecapitate\b", "shatter"),
    (r"\bslaughtered\b", "defeated"),
    (r"\bslaughtering\b", "overwhelming"),
    (r"\bslaughter\b", "battle"),
    (r"\bmassacred\b", "overwhelmed"),
    (r"\bmassacre\b", "conflict"),
    (r"\bmurdered\b", "betrayed"),
    (r"\bmurdering\b", "betraying"),
    (r"\bmurderer\b", "betrayer"),
    (r"\bmurder\b", "betrayal"),
    (r"\bkilled\b", "defeated"),
    (r"\bkilling\b", "defeating"),
    (r"\bkiller\b", "adversary"),
    (r"\bkills\b", "defeats"),
    (r"\bkill\b", "defeat"),
    (r"\bstabbed\b", "struck"),
    (r"\bstabbing\b", "striking"),
    (r"\bstab\b", "strike"),
    (r"\bimpaled\b", "struck"),
    (r"\bimpaling\b", "striking"),
    (r"\bimpale\b", "strike"),
    (r"\bbeheaded\b", "shattered"),
    (r"\bbehead\b", "shatter"),
    (r"\bgory\b", "intense"),
    (r"\bgore\b", "sparks"),
    (r"\bdismembered\b", "shattered"),
    (r"\bdismember\b", "shatter"),
    (r"\bscreaming\b", "shouting"),
    (r"\bscreams\b", "echoes"),
    (r"\bexecution\b", "judgment"),
    (r"\btorture\b", "ordeal"),
    (r"\bdying\b", "fading"),
    (r"\bdead\b", "fallen"),
    (r"\bdeath\b", "shadow"),
    (r"\bpoisoned\b", "tainted"),
    (r"\bpoison\b", "dark mist"),
    (r"\bvenom\b", "dark aura"),
    (r"\bwounded\b", "weary"),
    (r"\bwounds\b", "scars"),
    (r"\bwound\b", "scar"),
    (r"\bskulls\b", "helmets"),
    (r"\bskull\b", "helmet"),
    (r"\bthroat\b", "collar"),
    (r"\bflesh\b", "armor"),
]

BANNED_BRAND_CHECK = [
    r"\bDemon Slayer\b",
    r"\bufotable\b",
    r"\bKimetsu\b",
    r"\bGhibli\b",
    r"\bShinkai\b",
    r"\bMAPPA\b",
    r"\bDisney\b",
    r"\bPixar\b",
]

BANNED_GORE_CHECK = [
    r"\bblood\w*",
    r"\bkill(?:s|ed|ing|er)?\b",
    r"\bcorpse\w*\b",
    r"\bslaughter\w*\b",
    r"\bmassacre\w*\b",
    r"\bsevered\b",
    r"\bdecapitat\w*\b",
]

STYLE_DIRECTIVE = (
    "High-budget modern dark-fantasy cel-shaded 2D anime, 16:9 widescreen, "
    "24fps sakuga fluidity, crisp hand-drawn ink lineart, dramatic volumetric rim lighting, "
    "2.5D kinetic camera sweeps, and flowing luminous elemental energy ribbons."
)

NO_TEXT_RULE = (
    "NO-TEXT RULE: ZERO on-screen text, ZERO subtitles, ZERO captions, "
    "ZERO speech bubbles, ZERO letters, ZERO numbers, ZERO UI overlays, "
    "and ZERO watermarks anywhere in the frame."
)


def sanitize_veo_prompt(text: str) -> Tuple[str, List[str]]:
    """Apply Veo safety and copyright word replacements. Returns (sanitized, changes)."""
    out = text
    changes: List[str] = []
    for pat, repl in VEO_SAFE_WORD_MAP:
        new_out, count = re.subn(pat, repl, out, flags=re.IGNORECASE)
        if count > 0:
            changes.append(f"{pat} -> {repl} ({count}x)")
            out = new_out
    # Deduplicate doubled words like "Crimson crimson light" after replacement
    out = re.sub(r"\b(crimson|fallen|dark|glowing|shattered)\s+\1\b", r"\1", out, flags=re.IGNORECASE)
    # Collapse accidental double spaces
    out = re.sub(r"[ \t]{2,}", " ", out).strip()
    return out, changes


def check_banned_terms(text: str) -> List[str]:
    """Verify zero banned copyright or high-risk gore terms remain."""
    hits: List[str] = []
    for pat in BANNED_BRAND_CHECK + BANNED_GORE_CHECK:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            hits.append(m.group(0))
    return hits


# ---------------------------------------------------------------------------
# Flexible Continuity Bible Extraction Helpers
# ---------------------------------------------------------------------------

def _normalize_key(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _stringify_compact(val: Any, max_len: int = 200) -> str:
    """Turn a dict/list/string from continuity_bible into a tight, readable phrase."""
    if val is None:
        return ""
    if isinstance(val, str):
        s = val.strip()
    elif isinstance(val, list):
        s = ", ".join(_stringify_compact(x, max_len=90) for x in val if x)
    elif isinstance(val, dict):
        # Prefer dedicated continuityAnchor if curated by @curator
        anchor = val.get("continuityAnchor") or val.get("continuity_anchor")
        if isinstance(anchor, str) and anchor.strip():
            s = anchor.strip()
        else:
            parts: List[str] = []
            priority_keys = [
                "colorScheme", "lightingDirection", "atmosphereAndWeather",
                "visualIdentity", "visual_identity", "appearance", "description",
                "hair", "armorAndOutfit", "outfit", "armor", "clothing", "weapon", "weapons",
                "palette", "colorPalette", "color_palette", "lighting", "mood", "atmosphere",
            ]
            seen = set()
            for k in priority_keys:
                if k in val and val[k]:
                    v = _stringify_compact(val[k], max_len=140)
                    if v:
                        parts.append(v)
                    seen.add(k)
            if not parts:
                skip = {
                    "name", "canonicalName", "id", "act", "actNumber", "actTitle",
                    "paletteHex", "voiceTone", "voiceToneEn", "voice_tone", "voice",
                    "role", "cuts", "appearances", "appearingCuts", "owner",
                }
                for k, v in val.items():
                    if k in skip or k in seen or not v:
                        continue
                    sv = _stringify_compact(v, max_len=100)
                    if sv:
                        parts.append(sv)
            s = "; ".join(parts)
    else:
        s = str(val).strip()

    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        s = s[: max_len - 1].rsplit(" ", 1)[0].rstrip(",;:")
    return s.rstrip(".")


def _index_named_collection(raw: Any) -> Dict[str, Tuple[str, Any]]:
    """Index a dict or list of objects by normalized name."""
    index: Dict[str, Tuple[str, Any]] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            display = v.get("name", k) if isinstance(v, dict) else k
            index[_normalize_key(k)] = (str(display), v)
            if isinstance(display, str):
                index[_normalize_key(display)] = (display, v)
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict):
                name = item.get("name") or item.get("id") or item.get("character") or item.get("prop") or ""
                if name:
                    index[_normalize_key(str(name))] = (str(name), item)
            elif isinstance(item, str):
                index[_normalize_key(item)] = (item, item)
    return index


def _lookup_entry(index: Dict[str, Tuple[str, Any]], query: str) -> Optional[Tuple[str, Any]]:
    nq = _normalize_key(query)
    if not nq:
        return None
    if nq in index:
        return index[nq]
    # Substring match (e.g. "Elwin" matches "Elwin (Young)")
    for k, val in index.items():
        if len(nq) >= 3 and (nq in k or k in nq):
            return val
    return None


def _extract_voice_tone(char_entry: Any) -> str:
    if not isinstance(char_entry, dict):
        return ""
    for key in ("voiceToneEn", "voiceTone", "voice_tone", "voice", "delivery", "vocalStyle", "vocal_style"):
        val = char_entry.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _extract_act_palette(bible: Dict[str, Any], act: int) -> str:
    """Find lighting/color palette guidance for a given Act number (1, 2, 3)."""
    candidate_containers = [
        bible.get("acts"),
        bible.get("actLighting"),
        bible.get("act_lighting"),
        bible.get("actPalettes"),
        bible.get("act_palettes"),
        bible.get("lightingAndPalette"),
        bible.get("lighting_and_palette"),
        bible.get("colorPalettes"),
        bible.get("color_palettes"),
        bible.get("actColorPalettes"),
    ]
    roman = {1: "I", 2: "II", 3: "III"}.get(act, str(act))
    candidate_keys = [
        str(act),
        f"act{act}",
        f"act_{act}",
        f"Act {act}",
        f"Act {roman}",
        f"act{roman}",
        f"act_{roman}",
    ]
    norm_candidates = {_normalize_key(k) for k in candidate_keys}

    for container in candidate_containers:
        if isinstance(container, dict):
            for k, v in container.items():
                if _normalize_key(str(k)) in norm_candidates or _normalize_key(str(k)).startswith(f"act{act}"):
                    return _stringify_compact(v, max_len=200)
        elif isinstance(container, list):
            for item in container:
                if isinstance(item, dict):
                    item_act = item.get("act") or item.get("actNumber") or item.get("act_number")
                    if str(item_act) == str(act) or _normalize_key(str(item_act or "")) in norm_candidates:
                        return _stringify_compact(item, max_len=200)
            if 1 <= act <= len(container):
                return _stringify_compact(container[act - 1], max_len=200)
    return ""


def _clean_sentence(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    return s.rstrip(".")


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------

def build_single_cut_prompt(
    cut: Dict[str, Any],
    ep: int,
    char_index: Dict[str, Tuple[str, Any]],
    prop_index: Dict[str, Tuple[str, Any]],
    bible: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str]]:
    cut_num = int(cut["cutNumber"])
    cut_code = str(cut.get("cutCode") or f"EP{ep:02d}-CUT{cut_num:02d}")
    act = int(cut.get("act", 1))
    audio_mode = str(cut.get("audioMode", "sakuga_action")).strip()
    speaker_en = str(cut.get("speakerEn") or "").strip()
    dialogue_en = str(cut.get("dialogueEn") or "").strip()
    transition_out = str(cut.get("transitionOut") or "hard_cut").strip()
    location = _clean_sentence(str(cut.get("location") or ""))
    camera_move = _clean_sentence(str(cut.get("cameraMove") or "Dynamic cinematic camera push-in"))
    motion_vfx = _clean_sentence(str(cut.get("motionAndVfx") or "Flowing cloaks, drifting snow particles, and glowing atmospheric light"))
    characters: List[str] = [str(c).strip() for c in (cut.get("characters") or []) if str(c).strip()]
    props: List[str] = [str(p).strip() for p in (cut.get("props") or []) if str(p).strip()]
    sfx_cues: List[str] = [str(s).strip() for s in (cut.get("sfxCues") or []) if str(s).strip()]

    keyframe_rel = f"output/studio_anime/ep{ep:02d}_en/keyframes/{cut_code}_keyframe.png"

    # Gather continuity cues (concise to keep Veo prompt sharp & obedient)
    char_notes: List[str] = []
    speaker_voice_tone = ""
    for ch in characters[:3]:
        found = _lookup_entry(char_index, ch)
        if found:
            disp, data = found
            desc = _stringify_compact(data, max_len=160)
            if desc:
                if desc.lower().startswith(disp.lower()):
                    char_notes.append(desc)
                else:
                    char_notes.append(f"{disp} ({desc})")
            if speaker_en and _normalize_key(speaker_en) in (_normalize_key(ch), _normalize_key(disp)):
                speaker_voice_tone = _extract_voice_tone(data)

    if speaker_en and not speaker_voice_tone:
        found_spk = _lookup_entry(char_index, speaker_en)
        if found_spk:
            speaker_voice_tone = _extract_voice_tone(found_spk[1])

    prop_notes: List[str] = []
    for pr in props[:2]:
        found = _lookup_entry(prop_index, pr)
        if found:
            disp, data = found
            desc = _stringify_compact(data, max_len=130)
            if desc and "match attached start-frame keyframe design" not in desc.lower():
                if desc.lower().startswith(disp.lower()):
                    prop_notes.append(desc)
                else:
                    prop_notes.append(f"{disp} ({desc})")
            else:
                prop_notes.append(disp)

    act_palette = _clean_sentence(_extract_act_palette(bible, act))
    sfx_text = ", ".join(sfx_cues) if sfx_cues else "howling blizzard wind, distant steel resonance, atmospheric dark-fantasy ambience"

    # Assemble prompt sections
    sections: List[str] = [
        f"[STUDIO ANIME {cut_code}] {STYLE_DIRECTIVE}",
        (
            "START FRAME CONTINUITY: Strictly preserve the attached Start Frame's exact character designs, "
            "faces, hair, outfits, armor, weapons, props, and spatial framing while animating the shot "
            "fluidly across all 6 seconds."
        ),
    ]

    scene_bits: List[str] = []
    if location:
        scene_bits.append(f"Setting: {location}")
    if act_palette:
        scene_bits.append(f"Act {act} palette & lighting: {act_palette}")
    if char_notes:
        scene_bits.append("Characters: " + " | ".join(char_notes))
    if prop_notes:
        scene_bits.append("Key props: " + " | ".join(prop_notes))
    if scene_bits:
        sections.append("VISUAL CONTINUITY: " + ". ".join(scene_bits) + ".")

    sections.append(
        f"CAMERA & SAKUGA MOTION: {camera_move}. {motion_vfx}. "
        "Keep kinetic 24fps motion alive from frame 1 through second 6 with zero frozen slideshow holds."
    )

    # Strict 3-mode audio directive
    if audio_mode == "character_dialogue":
        spk_label = speaker_en or (characters[0] if characters else "the featured character")
        tone_clause = f" ({speaker_voice_tone})" if speaker_voice_tone else ""
        sections.append(
            f"AUDIO (CHARACTER DIALOGUE): ONLY {spk_label} speaks in clear, expressive English{tone_clause} "
            f'within 5 seconds with natural lip-sync and facial emotion: "{dialogue_en}". '
            f"All other characters on screen keep their mouths completely closed and silent. "
            f"Supporting SFX: {sfx_text}."
        )
    elif audio_mode == "offscreen_narration":
        sections.append(
            "AUDIO (OFF-SCREEN NARRATION): All on-screen characters keep their mouths completely closed "
            "and silent for the entire 6 seconds. ONLY a deep, resonant off-screen male narrator speaks "
            f'in the background within 5 seconds: "{dialogue_en}". '
            f"Supporting ambient SFX: {sfx_text}."
        )
    elif audio_mode == "sakuga_action":
        sections.append(
            "AUDIO (SAKUGA ACTION — STRICT SILENCE): ZERO spoken words, ZERO dialogue, ZERO narration. "
            "Every character on screen keeps their mouth firmly closed. "
            f"Deliver intense, crisp anime combat and environmental SFX only: {sfx_text}."
        )
    else:
        raise ValueError(f"[{cut_code}] Unknown audioMode: {audio_mode!r}")

    sections.append(NO_TEXT_RULE)

    raw_prompt = " ".join(sections)
    sanitized_prompt, changes = sanitize_veo_prompt(raw_prompt)

    # Hard verification against banned terms
    banned_hits = check_banned_terms(sanitized_prompt)
    if banned_hits:
        raise RuntimeError(
            f"[{cut_code}] Banned term(s) survived sanitization: {banned_hits}"
        )

    entry = {
        "cutNumber": cut_num,
        "cutCode": cut_code,
        "act": act,
        "keyframePath": keyframe_rel,
        "audioMode": audio_mode,
        "speakerEn": speaker_en,
        "dialogueEn": dialogue_en,
        "transitionOut": transition_out,
        "sfxCues": sfx_cues,
        "veoPromptEn": sanitized_prompt,
    }
    return entry, changes


def build_episode_prompts(ep: int) -> Path:
    ep_dir = STUDIO_OUT_ROOT / f"ep{ep:02d}_en"
    storyboard_path = ep_dir / f"storyboard_ep{ep:02d}_en.json"
    bible_path = ep_dir / f"continuity_bible_ep{ep:02d}.json"
    out_path = ep_dir / f"flow_prompts_ep{ep:02d}_en.json"

    if not storyboard_path.exists():
        raise FileNotFoundError(f"Storyboard not found: {storyboard_path}")
    if not bible_path.exists():
        raise FileNotFoundError(f"Continuity bible not found: {bible_path}")

    storyboard = json.loads(storyboard_path.read_text(encoding="utf-8"))
    bible = json.loads(bible_path.read_text(encoding="utf-8"))

    cuts = storyboard.get("cuts")
    if not isinstance(cuts, list) or not cuts:
        raise ValueError(f"No cuts array found in {storyboard_path}")

    char_index = _index_named_collection(
        bible.get("characters") or bible.get("characterSheets") or bible.get("character_sheets") or {}
    )
    prop_index = _index_named_collection(
        bible.get("props")
        or bible.get("recurringProps")
        or bible.get("recurring_props")
        or bible.get("keyProps")
        or {}
    )

    built_cuts: List[Dict[str, Any]] = []
    sanitized_summary: Dict[str, List[str]] = {}
    mode_counts: Dict[str, int] = {}

    for cut in cuts:
        entry, changes = build_single_cut_prompt(cut, ep, char_index, prop_index, bible)
        built_cuts.append(entry)
        mode = entry["audioMode"]
        mode_counts[mode] = mode_counts.get(mode, 0) + 1
        if changes:
            sanitized_summary[entry["cutCode"]] = changes

    payload = {
        "episodeNumber": int(storyboard.get("episodeNumber", ep)),
        "episodeTitleEn": storyboard.get("episodeTitleEn", f"Episode {ep:02d}"),
        "model": "Veo 3.1 - Lite",
        "aspectRatio": "16:9",
        "durationSeconds": 6,
        "totalCuts": len(built_cuts),
        "audioModeBreakdown": mode_counts,
        "cuts": built_cuts,
    }

    ep_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # Summary log
    print(f"[build_veo_prompts] Wrote {len(built_cuts)} Veo 3.1 - Lite prompts -> {out_path}")
    print(f"[build_veo_prompts] Audio modes: {mode_counts}")
    if sanitized_summary:
        print(f"[build_veo_prompts] Safety-sanitized {len(sanitized_summary)} cut(s):")
        for code, ch in sanitized_summary.items():
            print(f"  - {code}: {', '.join(ch)}")
    else:
        print("[build_veo_prompts] Safety sanitizer: 0 replacements needed (clean input).")

    # Verify keyframe presence (warning only so prompt build still succeeds if keyframes pending)
    missing_kf = [
        c["cutCode"] for c in built_cuts if not (ROOT / c["keyframePath"]).exists()
    ]
    if missing_kf:
        print(f"[build_veo_prompts] WARNING: {len(missing_kf)} keyframe(s) missing on disk: {missing_kf}")
    else:
        print(f"[build_veo_prompts] Verified all {len(built_cuts)} keyframe PNGs exist on disk.")

    return out_path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build Google Flow Veo 3.1 - Lite prompts from storyboard & continuity bible."
    )
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    args = parser.parse_args()
    if args.ep < 1:
        print("Error: --ep must be >= 1", file=sys.stderr)
        return 1
    build_episode_prompts(args.ep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
