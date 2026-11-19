#!/usr/bin/env python3
"""
SNSHero Studio Anime — Google Flow Veo 3.1 Batch Production Runner
------------------------------------------------------------------
Generates and downloads 6-second 16:9 anime clips from Google Flow using
Start Frame Image-to-Video (`Veo 3.1 - Lite`) for a target episode.

Key features:
- Connects via Chrome DevTools Protocol (CDP) first (auto-detecting
  http://127.0.0.1:9222 or using --cdp-url) to operate directly on the
  user's already-logged-in Google Flow tab without anti-detection flags.
- Clean fallback to standard Playwright Chrome launch if no CDP port is open.
- Immediately detects login walls / CAPTCHA / verification gates and stops
  cleanly with exit code 42 (never bypasses auth or CAPTCHA).
- Matches generated videos 1-to-1 using the `[STUDIO ANIME EPXX-CUTYY]`
  prompt header in Flow's `batchexecute?rpcids=Zzl0ze` payload, with live
  thumbnail-diff fallback (`flow-video-tile img.thumbnail`).
- Saves clips to `output/studio_anime/epXX_en/clips/EPXX-CUTYY.mp4` and
  maintains resumable checkpoints in `output/studio_anime/epXX_en/flow_status.json`.
- Retries failed/policy-filtered cuts up to 2 times (3 attempts total) with
  a progressively softened motion prompt while preserving the Start Frame,
  `[STUDIO ANIME EPXX-CUTYY]` header, audio/dialogue rule, and no-text rule.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT_ID = "de975be6-d001-4c64-ba2f-5530fa91c7d8"
DEFAULT_PROJECT_URL = f"https://flow.google.com/project/{DEFAULT_PROJECT_ID}"
DEFAULT_CDP_URL = "http://127.0.0.1:9222"
DEFAULT_MODEL = "Veo 3.1 - Lite"
MIN_CLIP_BYTES = 100_000
EXIT_AUTH_OR_CAPTCHA_BLOCKED = 42


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def parse_cuts_filter(raw: Optional[str], ep: int) -> Optional[Set[int]]:
    """Parse --cuts like '01,05', '1-4,8', or 'EP01-CUT01,EP01-CUT05' into cut numbers."""
    if not raw:
        return None
    result: Set[int] = set()
    for token in raw.split(","):
        tok = token.strip()
        if not tok:
            continue
        m_range = re.fullmatch(r"(\d+)\s*-\s*(\d+)", tok)
        if m_range:
            a, b = int(m_range.group(1)), int(m_range.group(2))
            for n in range(min(a, b), max(a, b) + 1):
                result.add(n)
            continue
        m_code = re.search(r"CUT(\d+)", tok, flags=re.IGNORECASE)
        if m_code:
            result.add(int(m_code.group(1)))
            continue
        m_num = re.fullmatch(r"\d+", tok)
        if m_num:
            result.add(int(tok))
            continue
        raise ValueError(f"Invalid --cuts entry: {tok!r}")
    return result


def probe_cdp_endpoint(cdp_url: str, timeout: float = 2.0) -> Optional[dict]:
    """Check whether a Chrome DevTools Protocol endpoint is reachable."""
    url = cdp_url.rstrip("/") + "/json/version"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return None
    return None


def load_prompts_file(prompts_path: Path) -> Tuple[dict, List[dict]]:
    """Load flow_prompts_epXX_en.json (supports either {'cuts': [...]} or [...])."""
    raw = json.loads(prompts_path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return {"cuts": raw}, raw
    if isinstance(raw, dict):
        cuts = raw.get("cuts") or raw.get("prompts") or raw.get("cutscenes") or []
        return raw, cuts
    raise ValueError(f"Unsupported JSON structure in {prompts_path}")


def resolve_keyframe_path(cut: dict, ep_dir: Path) -> Path:
    """Resolve keyframe PNG path from cut entry or canonical keyframes directory."""
    raw_kf = cut.get("keyframePath") or cut.get("keyframe") or ""
    if raw_kf:
        p = Path(raw_kf)
        if not p.is_absolute():
            p = ROOT / p
        if p.exists():
            return p
    ccode = cut["cutCode"]
    return ep_dir / "keyframes" / f"{ccode}_keyframe.png"


def load_status(status_path: Path, ep: int, project_url: str, model: str) -> dict:
    if status_path.exists():
        try:
            data = json.loads(status_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("episodeNumber", ep)
                data.setdefault("projectUrl", project_url)
                data.setdefault("model", model)
                data.setdefault("cuts", {})
                return data
        except Exception:
            pass
    return {
        "episodeNumber": ep,
        "projectUrl": project_url,
        "model": model,
        "updatedAt": now_iso(),
        "blocked": False,
        "blockerReason": None,
        "cuts": {},
    }


def save_status(status_path: Path, status: dict, total_cuts: int):
    cuts_map = status.get("cuts") or {}
    completed = sum(1 for v in cuts_map.values() if v.get("status") == "completed")
    failed = sum(1 for v in cuts_map.values() if v.get("status") == "failed")
    status["updatedAt"] = now_iso()
    status["summary"] = {
        "totalCuts": total_cuts,
        "completed": completed,
        "failed": failed,
        "remaining": max(0, total_cuts - completed - failed),
    }
    status_path.parent.mkdir(parents=True, exist_ok=True)
    status_path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_zzl0ze_video_map(body: str, ep: int) -> Dict[str, str]:
    """
    Parse Flow's authoritative `batchexecute?rpcids=Zzl0ze` response body and map each
    `[STUDIO ANIME EPXX-CUTYY]` prompt entry to its direct downloadable `.mp4` URL.
    """
    mapping: Dict[str, str] = {}
    ep_prefix = f"EP{ep:02d}-CUT"
    pattern = re.compile(rf"\[STUDIO ANIME ({ep_prefix}\d{{2}})\]")
    for m in pattern.finditer(body):
        cut_id = m.group(1)
        chunk = body[m.start():m.start() + 6500]
        # Primary: Flow asb token followed by video byte size (7-9+ digits)
        m_asb = re.search(
            r'https://lh3\.googleusercontent\.com/asb/([A-Za-z0-9_-]+)\\+",null,null,(\d{6,10})',
            chunk,
        )
        if m_asb:
            token = m_asb.group(1)
            mapping[cut_id] = f"https://flow.google.com/asb/{token}=mm,22,15"
            continue
        # Secondary: direct flow-content video URL if present
        m_fc = re.search(r'https://flow-content\.google/video/[A-Za-z0-9_-]+', chunk)
        if m_fc:
            mapping[cut_id] = m_fc.group(0)
            continue
        # Tertiary: any lh3 asb token near the prompt
        m_lh3 = re.search(r'https://lh3\.googleusercontent\.com/asb/([A-Za-z0-9_-]+)', chunk)
        if m_lh3:
            token = m_lh3.group(1)
            mapping[cut_id] = f"https://flow.google.com/asb/{token}=mm,22,15"
    return mapping


def thumb_url_to_video_url(thumb_url: str) -> str:
    """Convert a Flow video tile thumbnail URL into its downloadable MP4 URL."""
    m = re.search(r"/asb/([A-Za-z0-9_-]+)", thumb_url)
    if m:
        return f"https://flow.google.com/asb/{m.group(1)}=mm,22,15"
    base = thumb_url.split("=")[0]
    return f"{base}=mm,22,15"


def is_valid_mp4_bytes(data: bytes) -> bool:
    if len(data) < MIN_CLIP_BYTES:
        return False
    return b"ftyp" in data[:64]


def soften_motion_prompt(prompt: str, cut: dict, retry_index: int) -> str:
    """
    On failure/policy filter (retry_index=1 or 2), soften intense combat/motion
    phrasing while strictly preserving:
    - `[STUDIO ANIME EPXX-CUTYY]` header
    - Start Frame identity preservation
    - Exact audio/dialogue/narration/silence rule
    - No-text rule
    """
    ccode = cut["cutCode"]
    audio_mode = cut.get("audioMode", "sakuga_action")
    speaker = (cut.get("speakerEn") or "").strip()
    dialogue = (cut.get("dialogueEn") or "").strip()

    # Keep header intact
    header_match = re.search(r"\[STUDIO ANIME [^\]]+\]", prompt)
    header = header_match.group(0) if header_match else f"[STUDIO ANIME {ccode}]"

    if audio_mode == "character_dialogue" and dialogue:
        audio_rule = (
            f'AUDIO RULE (CHARACTER DIALOGUE): ONLY {speaker or "the speaking character"} speaks '
            f'"{dialogue}" in clear, expressive English within 5 seconds with natural lip-sync; '
            f"all other characters keep their mouths closed. Subtle ambient wind and orchestral score."
        )
    elif audio_mode == "offscreen_narration" and dialogue:
        audio_rule = (
            f'AUDIO RULE (OFFSCREEN NARRATION): All on-screen characters keep their mouths completely '
            f'closed and silent. ONLY a deep off-screen male narrator speaks "{dialogue}" calmly in clear English.'
        )
    else:
        audio_rule = (
            "AUDIO RULE (STRICT SILENCE): ZERO spoken words; all characters keep their mouths closed. "
            "Cinematic ambient wind, snow, and atmospheric fantasy sound effects only."
        )

    if retry_index == 1:
        motion_desc = (
            "Animate the attached Start Frame smoothly at 24fps in high-craft cel-shaded 2D dark-fantasy anime style. "
            "Preserve the exact character appearance, clothing, props, and composition from the Start Frame. "
            "Apply a graceful cinematic camera push-in with drifting snow particles, fluttering hair and cloaks, "
            "subtle glowing magical embers, and atmospheric volumetric rim lighting."
        )
    else:
        motion_desc = (
            "Gently bring the attached Start Frame to life as a 6-second 16:9 2D fantasy anime shot. "
            "Keep exact character and background continuity from the Start Frame with slow cinematic camera drift, "
            "soft falling snow, gentle breeze moving hair and fabric, and warm rim light."
        )

    return (
        f"{header} {motion_desc} "
        f"{audio_rule} "
        f"STRICT NO-TEXT RULE: ZERO subtitles, captions, speech bubbles, letters, numbers, or watermarks anywhere in frame."
    )


def detect_auth_or_captcha_blocker(page) -> Optional[str]:
    """
    Detect if Google Flow requires user sign-in, CAPTCHA, or anti-bot verification.
    Returns a human-readable blocker description, or None if clear.
    """
    url = (page.url or "").lower()
    if "accounts.google.com" in url or "servicelogin" in url:
        return f"Redirected to Google Sign-In page ({page.url}). Please sign in to Google Flow in Chrome."

    try:
        body_text = (page.inner_text("body", timeout=3000) or "").lower()
    except Exception:
        body_text = ""

    captcha_markers = [
        "verify you are human",
        "i'm not a robot",
        "unusual traffic",
        "recaptcha",
        "hcaptcha",
        "로봇이 아닙니다",
        "비정상적인 트래픽",
    ]
    for marker in captcha_markers:
        if marker in body_text:
            return f"Anti-bot / CAPTCHA challenge detected on page (matched '{marker}'). User intervention required."

    # Check if there is a prominent sign-in prompt and no composer box
    composer = page.locator(
        '[aria-label="무엇을 만들고 싶으신가요?"], '
        '[aria-label*="What do you want to create"], '
        '[aria-label*="prompt" i], '
        'textarea, [contenteditable="true"]'
    )
    if composer.count() == 0:
        sign_in_btn = page.locator(
            'a:has-text("Sign in"), button:has-text("Sign in"), '
            'a:has-text("로그인"), button:has-text("로그인")'
        )
        if sign_in_btn.count() > 0 and sign_in_btn.first.is_visible():
            return "Google Flow is not signed in (Sign-In button visible, prompt composer absent)."

    return None


def get_composer_locator(page):
    return page.locator(
        '[aria-label="무엇을 만들고 싶으신가요?"], '
        '[aria-label*="What do you want to create" i], '
        '[aria-label*="Describe your video" i], '
        '[role="textbox"][contenteditable="true"]'
    ).first


def configure_veo_settings(page, model_name: str):
    """Configure Google Flow for Video -> Frames -> 16:9 -> Veo 3.1 - Lite -> 6s -> x1."""
    box = get_composer_locator(page)
    if box.count() > 0 and box.is_visible():
        box.click()
        time.sleep(0.4)

    trig = page.locator(
        'button[aria-label="설정 트리거"], '
        'button[aria-label="Settings trigger" i], '
        'button[aria-label*="Settings" i], '
        'button:has-text("Nano Banana"), '
        'button:has-text("동영상 ·"), '
        'button:has-text("Video ·"), '
        'button:has-text("Veo")'
    ).first
    trig.wait_for(state="visible", timeout=20000)
    trig.click()
    time.sleep(0.8)

    # Video mode
    vid_radio = page.locator(
        'button[role="radio"]:has-text("동영상"), button[role="radio"]:has-text("Video")'
    ).first
    if vid_radio.count() > 0 and vid_radio.is_visible():
        vid_radio.click()
        time.sleep(0.4)

    # Frames (Start Frame image-to-video) mode
    frame_radio = page.locator(
        'button[role="radio"]:has-text("프레임"), button[role="radio"]:has-text("Frames")'
    ).first
    if frame_radio.count() > 0 and frame_radio.is_visible():
        frame_radio.click()
        time.sleep(0.4)

    # 16:9 landscape
    ratio_radio = page.locator('button[role="radio"]:has-text("16:9")').first
    if ratio_radio.count() > 0 and ratio_radio.is_visible():
        ratio_radio.click()
        time.sleep(0.4)

    # Model selection (Veo 3.1 - Lite)
    model_sel = page.locator(
        'button[aria-label="모델 제품군 선택"], button[aria-label*="model" i]'
    ).first
    if model_sel.count() > 0 and model_sel.is_visible():
        cur_txt = model_sel.inner_text() or ""
        if model_name not in cur_txt:
            model_sel.click()
            time.sleep(0.6)
            opt = page.locator(f'[role="menuitem"]:has-text("{model_name}")').first
            if opt.count() > 0 and opt.is_visible():
                opt.click()
                time.sleep(0.6)

    # 6s duration
    dur_6s = page.locator(
        'button[role="radio"]:has-text("6초"), button[role="radio"]:has-text("6s")'
    ).first
    if dur_6s.count() > 0 and dur_6s.is_visible():
        dur_6s.click()
        time.sleep(0.4)

    # x1 output count
    x1_radio = page.locator('button[role="radio"]:has-text("x1")').first
    if x1_radio.count() > 0 and x1_radio.is_visible():
        x1_radio.click()
        time.sleep(0.4)

    page.keyboard.press("Escape")
    time.sleep(0.5)
    try:
        summary_txt = trig.inner_text()
    except Exception:
        summary_txt = model_name
    print(f"[Flow] Configured settings -> {summary_txt!r}", flush=True)


def get_asset_search_locator(page):
    return page.locator(
        'input[aria-label="애셋 검색"], input[aria-label*="Search assets" i], input[placeholder*="검색"], input[placeholder*="Search" i]'
    ).first


def close_picker_if_open(page):
    search_inp = get_asset_search_locator(page)
    if search_inp.count() > 0 and search_inp.is_visible():
        page.keyboard.press("Escape")
        time.sleep(0.4)


def open_start_frame_picker(page):
    search_inp = get_asset_search_locator(page)
    if search_inp.count() > 0 and search_inp.is_visible():
        return search_inp

    start_btn = page.locator(
        'button:has-text("시작"), '
        'button:has-text("Start"), '
        'button[aria-label="프롬프트 상자에 소재 추가"], '
        'button[aria-label*="Add start frame" i], '
        'button[aria-label*="Add media" i]'
    ).first
    if start_btn.count() == 0 or not start_btn.is_visible():
        box = get_composer_locator(page)
        if box.count() > 0 and box.is_visible():
            box.click()
            time.sleep(0.4)
        start_btn = page.locator(
            'button:has-text("시작"), '
            'button:has-text("Start"), '
            'button[aria-label="프롬프트 상자에 소재 추가"], '
            'button[aria-label*="Add start frame" i], '
            'button[aria-label*="Add media" i]'
        ).first

    if start_btn.count() > 0 and start_btn.is_visible():
        start_btn.click()
        time.sleep(0.9)
    return get_asset_search_locator(page)


def clear_prompt_composer(page):
    close_picker_if_open(page)
    clr = page.locator(
        'button[aria-label="프롬프트 지우기"], button[aria-label*="Clear prompt" i]'
    ).first
    if clr.count() > 0 and clr.is_visible():
        clr.click()
        time.sleep(0.4)

    for _ in range(4):
        chip_cancel = page.locator(
            'button.chip-container:has-text("cancel"), button.chip-container:has-text("close")'
        ).first
        if chip_cancel.count() > 0 and chip_cancel.is_visible():
            chip_cancel.click()
            time.sleep(0.35)
        else:
            break

    box = get_composer_locator(page)
    if box.count() > 0 and box.is_visible():
        box.click()
        page.keyboard.press("Meta+A")
        page.keyboard.press("Backspace")
        time.sleep(0.2)


def preupload_keyframes(page, keyframe_files: List[Path], out_dir: Path):
    """Batch-upload keyframe PNGs to Flow's asset picker so they are indexed."""
    marker = out_dir / "keyframes_uploaded.json"
    already_uploaded: Set[str] = set()
    if marker.exists():
        try:
            already_uploaded = set(json.loads(marker.read_text(encoding="utf-8")))
        except Exception:
            already_uploaded = set()

    missing = [str(f) for f in keyframe_files if f.name not in already_uploaded]
    if not missing:
        print(f"[Flow] All {len(keyframe_files)} keyframes already indexed in Flow asset picker.", flush=True)
        return

    print(f"[Flow] Indexing {len(missing)} keyframe PNGs in Flow Start Frame picker...", flush=True)
    chunk_size = 8
    for i in range(0, len(missing), chunk_size):
        chunk = missing[i:i + chunk_size]
        search_inp = open_start_frame_picker(page)
        if search_inp.count() > 0 and search_inp.is_visible():
            search_inp.fill("")
            time.sleep(0.25)
        upload_btn = page.locator(
            'button:has-text("미디어 업로드"), button:has-text("Upload media"), button:has-text("Upload")'
        ).first
        with page.expect_file_chooser(timeout=15000) as fc_info:
            upload_btn.click()
        fc_info.value.set_files(chunk)
        wait_s = max(8, int(len(chunk) * 1.4))
        print(f"    ⏳ Uploaded chunk {i // chunk_size + 1} ({len(chunk)} keyframes), waiting {wait_s}s...", flush=True)
        time.sleep(wait_s)
        for f in chunk:
            already_uploaded.add(Path(f).name)
        marker.write_text(json.dumps(sorted(already_uploaded), indent=2), encoding="utf-8")

    close_picker_if_open(page)


def attach_start_frame(page, fpath: Path) -> bool:
    """Attach a specific keyframe PNG as the Start Frame in Flow."""
    prefix = fpath.stem  # e.g. EP01-CUT01_keyframe
    search_key = prefix[:18]
    search_inp = open_start_frame_picker(page)
    if search_inp.count() == 0 or not search_inp.is_visible():
        return False

    search_inp.click()
    search_inp.fill("")
    time.sleep(0.15)
    search_inp.fill(prefix)
    time.sleep(0.8)

    opt = page.locator('button.asset-item[role="option"]').filter(has_text=search_key).first
    if opt.count() == 0:
        upload_btn = page.locator(
            'button:has-text("미디어 업로드"), button:has-text("Upload media"), button:has-text("Upload")'
        ).first
        if upload_btn.count() > 0 and upload_btn.is_visible():
            with page.expect_file_chooser(timeout=15000) as fc_info:
                upload_btn.click()
            fc_info.value.set_files([str(fpath)])
            time.sleep(5.0)
            search_inp.fill(prefix)
            time.sleep(0.8)
            opt = page.locator('button.asset-item[role="option"]').filter(has_text=search_key).first

    if opt.count() > 0 and opt.is_visible():
        cls_attr = opt.get_attribute("class") or ""
        if "asset-item-active" not in cls_attr:
            opt.click()
            time.sleep(0.45)
        add_btn = page.locator(
            'button:has-text("프롬프트에 추가"), button:has-text("Add to prompt"), button:has-text("Add")'
        ).first
        for _ in range(12):
            if add_btn.count() > 0 and add_btn.is_visible() and add_btn.is_enabled():
                add_btn.click()
                time.sleep(0.6)
                return True
            time.sleep(0.3)

    close_picker_if_open(page)
    return False


def download_clip(ctx, video_url: str, dest_path: Path) -> Tuple[bool, int, str]:
    """Download an MP4 clip using the authenticated Playwright BrowserContext."""
    try:
        resp = ctx.request.get(video_url, timeout=60000)
        if not resp.ok:
            return False, 0, f"HTTP {resp.status}"
        body = resp.body()
        if not is_valid_mp4_bytes(body):
            return False, len(body), f"Invalid MP4 payload ({len(body)} bytes)"
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_bytes(body)
        return True, len(body), "ok"
    except Exception as e:
        return False, 0, str(e)


def sync_from_zzl0ze(
    ctx,
    zzl0ze_video_map: Dict[str, str],
    target_cuts: List[dict],
    clips_dir: Path,
    status: dict,
    status_path: Path,
    total_cuts: int,
    force: bool = False,
) -> int:
    synced = 0
    cuts_map = status["cuts"]
    for cut in target_cuts:
        ccode = cut["cutCode"]
        if ccode not in zzl0ze_video_map:
            continue
        clip_path = clips_dir / f"{ccode}.mp4"
        prev = cuts_map.get(ccode) or {}
        auth_url = zzl0ze_video_map[ccode]

        if (
            not force
            and clip_path.exists()
            and clip_path.stat().st_size >= MIN_CLIP_BYTES
            and prev.get("videoUrl") == auth_url
            and prev.get("status") == "completed"
        ):
            synced += 1
            continue

        ok, nbytes, err = download_clip(ctx, auth_url, clip_path)
        if ok:
            cuts_map[ccode] = {
                "cutNumber": cut["cutNumber"],
                "cutCode": ccode,
                "status": "completed",
                "source": "zzl0ze",
                "videoUrl": auth_url,
                "clipPath": str(clip_path.relative_to(ROOT)),
                "clipSizeBytes": nbytes,
                "audioMode": cut.get("audioMode"),
                "timestamp": now_iso(),
            }
            save_status(status_path, status, total_cuts)
            print(f"  ✅ [{ccode}] Synced from Zzl0ze ({nbytes / (1024 * 1024):.2f} MB)", flush=True)
            synced += 1
        else:
            print(f"  ⚠️ [{ccode}] Zzl0ze download failed ({err}) for {auth_url}", flush=True)
    return synced


def run_dry_run(
    ep: int,
    project_url: str,
    model_name: str,
    cdp_url: Optional[str],
    cuts_filter: Optional[Set[int]],
    ep_dir: Path,
    prompts_path: Path,
    clips_dir: Path,
    status_path: Path,
) -> int:
    print("=== SNSHero Studio Anime — Google Flow Batch Runner (DRY RUN) ===")
    print(f"  Episode     : EP{ep:02d}")
    print(f"  Project URL : {project_url}")
    print(f"  Model       : {model_name} (16:9, 6s, x1, Start Frame)")
    print(f"  Prompts JSON: {prompts_path} (exists={prompts_path.exists()})")
    print(f"  Clips Dir   : {clips_dir}")
    print(f"  Status JSON : {status_path}")
    print(f"  Cuts Filter : {sorted(cuts_filter) if cuts_filter else 'ALL'}")

    probe_url = cdp_url or DEFAULT_CDP_URL
    cdp_info = probe_cdp_endpoint(probe_url)
    if cdp_info:
        print(f"  CDP Status  : CONNECTED ({probe_url} -> {cdp_info.get('Browser', 'Chrome')})")
    else:
        print(f"  CDP Status  : Not detected at {probe_url} (will fallback to standard Playwright Chrome launch)")

    if not prompts_path.exists():
        print("  [Dry-Run Info] Prompts file not generated yet (waiting for Gate 1). CLI & syntax verified OK.")
        return 0

    _, cuts = load_prompts_file(prompts_path)
    selected = [c for c in cuts if not cuts_filter or int(c["cutNumber"]) in cuts_filter]
    print(f"  Loaded Cuts : {len(cuts)} total, {len(selected)} selected")

    missing_kf = []
    already_done = []
    pending = []
    for c in selected:
        ccode = c["cutCode"]
        kf = resolve_keyframe_path(c, ep_dir)
        clip = clips_dir / f"{ccode}.mp4"
        if not kf.exists():
            missing_kf.append(str(kf))
        if clip.exists() and clip.stat().st_size >= MIN_CLIP_BYTES:
            already_done.append(ccode)
        else:
            pending.append(ccode)

    print(f"  Keyframes   : {len(selected) - len(missing_kf)}/{len(selected)} found")
    if missing_kf:
        print(f"  Missing KFs : {missing_kf[:5]}{' ...' if len(missing_kf) > 5 else ''}")
    print(f"  Existing MP4: {len(already_done)} already downloaded")
    print(f"  Pending MP4 : {len(pending)} to generate")
    if selected:
        sample = selected[0]
        has_tag = f"[STUDIO ANIME {sample['cutCode']}]" in (sample.get("veoPromptEn") or "")
        print(f"  Tag Check   : {sample['cutCode']} header tag present = {has_tag}")
    print("=== DRY RUN PASSED ===")
    return 0


def run_batch(args) -> int:
    ep = args.ep
    project_url = args.project_url
    model_name = args.model
    cuts_filter = parse_cuts_filter(args.cuts, ep)

    ep_dir = ROOT / "output" / "studio_anime" / f"ep{ep:02d}_en"
    prompts_path = ep_dir / f"flow_prompts_ep{ep:02d}_en.json"
    clips_dir = ep_dir / "clips"
    status_path = ep_dir / "flow_status.json"

    if args.dry_run:
        return run_dry_run(
            ep=ep,
            project_url=project_url,
            model_name=model_name,
            cdp_url=args.cdp_url,
            cuts_filter=cuts_filter,
            ep_dir=ep_dir,
            prompts_path=prompts_path,
            clips_dir=clips_dir,
            status_path=status_path,
        )

    if not prompts_path.exists():
        print(f"[ERROR] Prompts file not found: {prompts_path}", file=sys.stderr, flush=True)
        return 1

    _, all_cuts = load_prompts_file(prompts_path)
    total_cuts = len(all_cuts)
    target_cuts = [c for c in all_cuts if not cuts_filter or int(c["cutNumber"]) in cuts_filter]
    if not target_cuts:
        print("[ERROR] No cuts matched the requested filter.", file=sys.stderr, flush=True)
        return 1

    # Verify keyframes exist before opening browser
    kf_map: Dict[str, Path] = {}
    missing_kfs = []
    for cut in target_cuts:
        ccode = cut["cutCode"]
        kf = resolve_keyframe_path(cut, ep_dir)
        if not kf.exists():
            missing_kfs.append(f"{ccode}: {kf}")
        else:
            kf_map[ccode] = kf
    if missing_kfs:
        print(f"[ERROR] Missing keyframe PNGs:\n  " + "\n  ".join(missing_kfs), file=sys.stderr, flush=True)
        return 1

    clips_dir.mkdir(parents=True, exist_ok=True)
    status = load_status(status_path, ep, project_url, model_name)
    status["blocked"] = False
    status["blockerReason"] = None
    save_status(status_path, status, total_cuts)

    # Check if all target cuts are already downloaded and not --force
    if not args.force:
        remaining_initial = [
            c for c in target_cuts
            if not ((clips_dir / f"{c['cutCode']}.mp4").exists() and (clips_dir / f"{c['cutCode']}.mp4").stat().st_size >= MIN_CLIP_BYTES)
        ]
        if not remaining_initial:
            print(f"[Flow] All {len(target_cuts)} target clips already exist in {clips_dir}. Nothing to do.", flush=True)
            return 0

    from playwright.sync_api import sync_playwright

    zzl0ze_video_map: Dict[str, str] = {}
    cdp_target = args.cdp_url or DEFAULT_CDP_URL
    cdp_info = probe_cdp_endpoint(cdp_target)

    with sync_playwright() as p:
        used_cdp = False
        browser = None
        ctx = None
        page = None
        opened_new_tab = False

        try:
            if cdp_info:
                print(f"[Flow] Connecting to existing Chrome via CDP: {cdp_target} ({cdp_info.get('Browser', 'Chrome')})", flush=True)
                browser = p.chromium.connect_over_cdp(cdp_target)
                used_cdp = True
                ctx = browser.contexts[0] if browser.contexts else browser.new_context(accept_downloads=True)

                # Reuse an already-open tab for this project if present
                project_id = project_url.rstrip("/").split("/")[-1]
                for existing_pg in ctx.pages:
                    if project_id in (existing_pg.url or ""):
                        page = existing_pg
                        print(f"[Flow] Reusing existing Flow tab: {page.url}", flush=True)
                        break
                if page is None:
                    page = ctx.new_page()
                    opened_new_tab = True
            else:
                if args.cdp_url:
                    print(f"[WARN] Requested CDP URL {args.cdp_url} not reachable; falling back to standard Playwright Chrome.", flush=True)
                else:
                    print("[Flow] No Chrome CDP port detected on 127.0.0.1:9222; launching standard Playwright Chrome.", flush=True)
                browser = p.chromium.launch(channel="chrome", headless=False)
                ctx = browser.new_context(
                    viewport={"width": 1600, "height": 1000},
                    accept_downloads=True,
                )
                page = ctx.new_page()
                opened_new_tab = True

            def on_response(resp):
                if "rpcids=Zzl0ze" in resp.url:
                    try:
                        body = resp.text()
                        parsed = parse_zzl0ze_video_map(body, ep)
                        if parsed:
                            zzl0ze_video_map.update(parsed)
                    except Exception:
                        pass

            page.on("response", on_response)

            # Navigate or reload to trigger Zzl0ze state payload
            print(f"[Flow] Loading project {project_url} ...", flush=True)
            page.goto(project_url, wait_until="domcontentloaded", timeout=60000)
            time.sleep(7.0)

            # Check for auth / CAPTCHA gate immediately — NEVER bypass
            blocker = detect_auth_or_captcha_blocker(page)
            if blocker:
                print(f"[BLOCKER] {blocker}", file=sys.stderr, flush=True)
                status["blocked"] = True
                status["blockerReason"] = blocker
                save_status(status_path, status, total_cuts)
                return EXIT_AUTH_OR_CAPTCHA_BLOCKED

            # Dismiss standard Terms/Consent button if shown inside Flow
            agree_btn = page.locator('button:has-text("동의함"), button:has-text("I agree")').first
            if agree_btn.count() > 0 and agree_btn.is_visible():
                agree_btn.click()
                time.sleep(1.0)

            # Verify prompt composer is visible
            composer = get_composer_locator(page)
            if composer.count() == 0 or not composer.is_visible():
                time.sleep(4.0)
                blocker = detect_auth_or_captcha_blocker(page)
                if blocker:
                    print(f"[BLOCKER] {blocker}", file=sys.stderr, flush=True)
                    status["blocked"] = True
                    status["blockerReason"] = blocker
                    save_status(status_path, status, total_cuts)
                    return EXIT_AUTH_OR_CAPTCHA_BLOCKED

            configure_veo_settings(page, model_name)

            # Step 1: Sync any already-generated videos found in Zzl0ze
            if zzl0ze_video_map and not args.force:
                synced = sync_from_zzl0ze(
                    ctx, zzl0ze_video_map, target_cuts, clips_dir, status, status_path, total_cuts, force=False
                )
                print(f"[Flow] Pre-synced {synced} existing clips from Zzl0ze.", flush=True)

            # Determine pending cuts
            pending_cuts = []
            for c in target_cuts:
                ccode = c["cutCode"]
                clip_path = clips_dir / f"{ccode}.mp4"
                if not args.force and clip_path.exists() and clip_path.stat().st_size >= MIN_CLIP_BYTES:
                    continue
                pending_cuts.append(c)

            if not pending_cuts:
                print(f"[Flow] All {len(target_cuts)} target clips are downloaded and verified.", flush=True)
                return 0

            # Step 2: Pre-upload keyframes for pending cuts
            preupload_keyframes(page, [kf_map[c["cutCode"]] for c in pending_cuts], ep_dir)

            # Step 3: Generate each pending cut sequentially with up to 2 retries (3 total attempts)
            for idx, cut in enumerate(pending_cuts, start=1):
                ccode = cut["cutCode"]
                cnum = cut["cutNumber"]
                clip_path = clips_dir / f"{ccode}.mp4"
                kf_path = kf_map[ccode]
                base_prompt = (cut.get("veoPromptEn") or "").strip()
                if f"[STUDIO ANIME {ccode}]" not in base_prompt:
                    base_prompt = f"[STUDIO ANIME {ccode}] {base_prompt}"

                succeeded = False
                last_error = ""

                for attempt in range(3):
                    blocker = detect_auth_or_captcha_blocker(page)
                    if blocker:
                        print(f"[BLOCKER] {blocker}", file=sys.stderr, flush=True)
                        status["blocked"] = True
                        status["blockerReason"] = blocker
                        save_status(status_path, status, total_cuts)
                        return EXIT_AUTH_OR_CAPTCHA_BLOCKED

                    try:
                        clear_prompt_composer(page)
                        ok_ref = attach_start_frame(page, kf_path)
                        close_picker_if_open(page)
                        if not ok_ref:
                            raise RuntimeError(f"Failed to attach Start Frame {kf_path.name}")

                        use_prompt = base_prompt if attempt == 0 else soften_motion_prompt(base_prompt, cut, attempt)

                        box = get_composer_locator(page)
                        box.click(timeout=10000)
                        box.fill(use_prompt, timeout=10000)
                        time.sleep(0.7)

                        gen_btn = page.locator(
                            'button[aria-label="생성 시작"], button[aria-label*="Generate" i], button[aria-label*="Create" i]'
                        ).first
                        for _ in range(15):
                            if gen_btn.count() > 0 and gen_btn.is_enabled():
                                break
                            time.sleep(0.4)
                        if not gen_btn.is_enabled():
                            raise RuntimeError("Generate button did not become enabled")

                        before_thumbs = set(
                            page.locator("flow-video-tile img.thumbnail").evaluate_all(
                                "els => els.map(e => e.src).filter(Boolean)"
                            )
                        )
                        prev_zzl_url = zzl0ze_video_map.get(ccode)

                        gen_btn.click(timeout=10000)
                        print(
                            f"  🎬 [{ccode} ({idx}/{len(pending_cuts)}) | Try {attempt + 1}/3] "
                            f"Submitted to {model_name} (KF={kf_path.name}, Audio={cut.get('audioMode')})",
                            flush=True,
                        )

                        t0 = time.time()
                        saw_pct = False
                        new_video_url = None

                        while time.time() - t0 < args.timeout:
                            time.sleep(3.5)

                            # Check for auth/CAPTCHA mid-run
                            mid_blocker = detect_auth_or_captcha_blocker(page)
                            if mid_blocker:
                                print(f"[BLOCKER] {mid_blocker}", file=sys.stderr, flush=True)
                                status["blocked"] = True
                                status["blockerReason"] = mid_blocker
                                save_status(status_path, status, total_cuts)
                                return EXIT_AUTH_OR_CAPTCHA_BLOCKED

                            # Method A: Zzl0ze updated with new URL for this cutCode
                            if ccode in zzl0ze_video_map and zzl0ze_video_map[ccode] != prev_zzl_url:
                                new_video_url = zzl0ze_video_map[ccode]
                                break

                            # Method B: New video tile thumbnail appeared
                            after_thumbs = page.locator("flow-video-tile img.thumbnail").evaluate_all(
                                "els => els.map(e => e.src).filter(Boolean)"
                            )
                            diff_thumbs = [t for t in after_thumbs if t not in before_thumbs]
                            if diff_thumbs:
                                new_video_url = thumb_url_to_video_url(diff_thumbs[0])
                                break

                            active_pcts = page.evaluate("""() => {
                                const els = Array.from(document.querySelectorAll('*'));
                                const pctRe = /^\\d{1,2}%$/;
                                return els.filter(e => e.children.length === 0 && pctRe.test((e.innerText || '').trim())).map(e => e.innerText.trim());
                            }""")
                            elapsed = int(time.time() - t0)
                            if active_pcts:
                                saw_pct = True
                                print(f"    [{elapsed}s] progress={active_pcts}", flush=True)
                            elif not saw_pct and elapsed >= 25:
                                # Check if a policy/error toast appeared
                                last_error = "No progress percentage appeared within 25s (possible policy filter or queue rejection)"
                                break
                            elif saw_pct and elapsed >= 35 and not active_pcts:
                                # Finished rendering, wait briefly for tile thumbnail
                                for _ in range(5):
                                    time.sleep(2.0)
                                    after_thumbs = page.locator("flow-video-tile img.thumbnail").evaluate_all(
                                        "els => els.map(e => e.src).filter(Boolean)"
                                    )
                                    diff_thumbs = [t for t in after_thumbs if t not in before_thumbs]
                                    if diff_thumbs:
                                        new_video_url = thumb_url_to_video_url(diff_thumbs[0])
                                        break
                                if not new_video_url:
                                    last_error = "Progress finished without new video tile (possible policy filter)"
                                break

                        if not new_video_url:
                            print(f"  ⚠️ [{ccode}] Try {attempt + 1}/3 did not produce video: {last_error}", flush=True)
                            time.sleep(4.0)
                            continue

                        ok, nbytes, dl_err = download_clip(ctx, new_video_url, clip_path)
                        if ok:
                            status["cuts"][ccode] = {
                                "cutNumber": cnum,
                                "cutCode": ccode,
                                "status": "completed",
                                "source": "live",
                                "attempts": attempt + 1,
                                "softened": attempt > 0,
                                "videoUrl": new_video_url,
                                "clipPath": str(clip_path.relative_to(ROOT)),
                                "clipSizeBytes": nbytes,
                                "audioMode": cut.get("audioMode"),
                                "timestamp": now_iso(),
                            }
                            save_status(status_path, status, total_cuts)
                            print(f"  ✅ [{ccode}] Saved {clip_path.name} ({nbytes / (1024 * 1024):.2f} MB)", flush=True)
                            succeeded = True
                            break
                        else:
                            last_error = f"Download failed: {dl_err}"
                            print(f"  ⚠️ [{ccode}] Try {attempt + 1}/3 {last_error}", flush=True)
                            time.sleep(3.0)

                    except Exception as e:
                        last_error = str(e)
                        print(f"  ⚠️ [{ccode}] Try {attempt + 1}/3 error: {e} — reloading Flow...", flush=True)
                        try:
                            page.goto(project_url, wait_until="domcontentloaded", timeout=60000)
                            time.sleep(6.0)
                            configure_veo_settings(page, model_name)
                        except Exception:
                            pass

                if not succeeded:
                    print(f"  🚫 [{ccode}] Failed after 3 attempts: {last_error}", flush=True)
                    status["cuts"][ccode] = {
                        "cutNumber": cnum,
                        "cutCode": ccode,
                        "status": "failed",
                        "attempts": 3,
                        "error": last_error,
                        "timestamp": now_iso(),
                    }
                    save_status(status_path, status, total_cuts)

            # Final Zzl0ze pass in case any cut finished right after timeout
            if zzl0ze_video_map:
                sync_from_zzl0ze(
                    ctx, zzl0ze_video_map, target_cuts, clips_dir, status, status_path, total_cuts, force=False
                )

        finally:
            if used_cdp:
                # Never close user's existing tabs or kill user's Chrome over CDP
                if opened_new_tab and page is not None:
                    try:
                        page.close()
                    except Exception:
                        pass
                if browser is not None:
                    try:
                        browser.close()
                    except Exception:
                        pass
            else:
                if browser is not None:
                    try:
                        browser.close()
                    except Exception:
                        pass

    completed_target = sum(
        1 for c in target_cuts
        if (clips_dir / f"{c['cutCode']}.mp4").exists()
        and (clips_dir / f"{c['cutCode']}.mp4").stat().st_size >= MIN_CLIP_BYTES
    )
    print(f"\n[Flow] Batch finished: {completed_target}/{len(target_cuts)} target clips ready in {clips_dir}", flush=True)
    return 0 if completed_target == len(target_cuts) else 2


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="SNSHero Studio Anime — Google Flow Veo 3.1 Batch Production Runner"
    )
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument(
        "--cuts",
        type=str,
        default=None,
        help="Optional comma-separated cut numbers/ranges/codes (e.g. '01,05', '1-4', 'EP01-CUT01')",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Google Flow video model name (default: '{DEFAULT_MODEL}')",
    )
    parser.add_argument(
        "--cdp-url",
        type=str,
        default=None,
        help=f"Chrome DevTools Protocol URL (default: auto-detect {DEFAULT_CDP_URL})",
    )
    parser.add_argument(
        "--project-url",
        type=str,
        default=DEFAULT_PROJECT_URL,
        help=f"Target Google Flow project URL (default: {DEFAULT_PROJECT_URL})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=150,
        help="Max seconds to wait per video generation attempt (default: 150)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if clip MP4 already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration, CDP availability, prompts, and keyframes without running browser",
    )
    return parser


def main() -> int:
    parser = build_arg_parser()
    args = parser.parse_args()
    return run_batch(args)


if __name__ == "__main__":
    sys.exit(main())
