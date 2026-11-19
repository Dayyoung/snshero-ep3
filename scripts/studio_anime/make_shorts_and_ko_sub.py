#!/usr/bin/env python3
"""
SNSHero Studio Anime — Korean SRT Generator & Full-Bleed 9:16 Vertical YouTube Shorts

Produces:
  1. `SNSHero_StudioAnime_EP{N:02d}_KO.srt` — dramatic Korean anime subtitles synced 1:1
     with `SNSHero_StudioAnime_EP{N:02d}_EN.srt` timestamps.
  2. `SNSHero_StudioAnime_EP{N:02d}_EN_KO_Shorts_9x16.mp4` — 100% full-bleed 1080x1920 (9:16)
     YouTube Shorts from the 16:9 master:
       - Full-screen 9:16 center crop (zero top/bottom padding or blur bars):
           scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1
       - ZERO on-screen text (no header, no burned-in subtitles — 100% clean anime visuals)
       - Soft subtitle tracks muxed into the MP4 container (EN.srt as eng + KO.srt as kor, mov_text)
       - Preserves -14 LUFS 48kHz stereo AAC audio intact (-c:a copy)
  3. Extracts QA preview frames, copies all 4 episode assets (16x9.mp4, Shorts_9x16.mp4,
     EN.srt, KO.srt) to `/Users/dayyoung/Desktop/내문서/movie/`, and creates symlinks in
     `dist/studio-anime/` without moving originals.

Usage:
  python3 scripts/studio_anime/make_shorts_and_ko_sub.py --ep 2
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_COPY_DIR = Path("/Users/dayyoung/Desktop/내문서/movie")
DIST_SYMLINK_DIR = REPO_ROOT / "dist/studio-anime"

CANVAS_W = 1080
CANVAS_H = 1920

# Per-episode dramatic Korean anime subtitle translations (ordered 1:1 with EN.srt cues)
KO_TRANSLATIONS_BY_EP: Dict[int, List[str]] = {
    1: [
        "<i>빛의 항구 얼어붙은 변방, 겨울이 엘윈마을을 삼켰고\n얼음 너머로 그림자의 소문이 스며들었다.</i>",
        "이름을 대라, 그림자의 사냥개여.\n내 창이 지금 여기서 끝장을 내주마!",
        "무기를 거둬라, 형제들이여.\n늑대의 피를 둘렀어도 난 그들의 사냥개가 아니다.",
        "아르투스와 루시안이 왕국을 팔아넘겼다.\n그믐달이 뜨기 전, 왕실 심문관들이 들이닥칠 거다.",
        "이 은단검을 너희 아들들에게 물려주어라.\n복수가 아닌, 진실을 지키기 위해.",
        "내 아들의 이름은 카단이라 짓겠다.\n결코 부서지지 않는 불굴의 방패.",
        "내 아들은 이그니스.\n용광로 속에서도 길을 잃지 않는 불꽃이다.",
        "따뜻한 국물부터 드세요.\n이번 추위는 너무 매서워요.",
        "반역자들에게 자비란 사치지.\n이 마을 전체를 반군으로 낙인찍어라—저 여자는 내 것이다.",
        "검을 버려라, 알렉산다르!\n반역을 자백하면 네 여자의 목숨만은 살려주지!",
        "내 아내의 목숨은 배신자의 혀로\n흥정할 수 있는 게 아니다!",
        "내 몸에 손대지 마, 이 괴물아!",
        "살아라, 이셀라!\n도망쳐—너와 우리 아들은 반드시 살아야 해!",
        "누군가는 살아남아\n이곳에서 빵을 구워야 하니까요.",
        "아가, 카단…\n아버지의 방패가 우리를 지켜주고 있단다.",
        "넌 복수를 위해 태어난 아이가 아니야.",
        "약속해 다오—결코 거짓 앞에\n고개 숙이지 않겠다고.",
        "<i>눈은 두 영웅을 묻었으나,\n그들의 불씨는 끝내 꺼지지 않았다.</i>",
    ],
    2: [
        "<i>사흘 밤 뒤, 기사는 엘윈마을의 잿더미에 닿았다.</i>",
        "빛의 항구 왕실 문장이다.\n배신은 내부에서 시작됐어.",
        "금칠한 왕실 사냥개가\n우리 부두를 기웃거리는군!",
        "고아들에게 손대지 마, 궁정의 개!\n무기 버려!",
        "멈춰, 그림리!\n저자는 해칠 뜻이 없어!",
        "멈추세요!\n노예선에서 우릴 구해준 분들이에요!",
        "잘 보시오.\n모든 명령에 루시안 왕자의 인장이 찍혀 있소.",
        "내 눈이 삐었군!\n루시안의 개가 아니라 진짜 기사였어.",
        "엘윈에서 두 아버지가 쓰러졌소.\n남은 건 그들의 아들들뿐.",
        "북쪽에서 알렉산다르의 아들을 찾아\n지켜주시오.",
        "영웅의 유산이 북쪽 눈밭에\n얼어붙게 두진 않겠소.",
        "믿고 맡겨.\n우리가 강철처럼 단단히 키워낼 테니까.",
        "날카로운 검, 바다의 기개,\n치유술까지 전부 가르쳐주지.",
        "나는 루시안의 궁정으로 들어가\n발리안의 아들을 지키겠소.",
        "18년 뒤 동짓날,\n별취한 종탑 꼭대기에서 다시 만나자고.",
        "누구의 방패가 더 단단한지,\n두 아이의 대결로 증명해보지.",
        "좋소! 아버지들의 유산이\n반드시 이 어둠을 꿰뚫을 것이오!",
        "<i>일곱 기수는 북쪽으로 달렸고,\n한 기사는 홀로 남쪽으로 걸었다.</i>",
    ],
}


def parse_srt_blocks(path: Path) -> List[Tuple[str, str, str]]:
    """Return list of (index_str, timing_line, body_text)."""
    raw = path.read_text(encoding="utf-8").strip()
    blocks = re.split(r"\n\s*\n", raw)
    out: List[Tuple[str, str, str]] = []
    for blk in blocks:
        lines = [ln.rstrip("\r") for ln in blk.strip().splitlines()]
        if len(lines) < 3:
            continue
        out.append((lines[0].strip(), lines[1].strip(), "\n".join(lines[2:]).strip()))
    return out


def generate_ko_srt(ep_num: int, en_srt_path: Path, ko_srt_path: Path, force: bool = False) -> int:
    en_blocks = parse_srt_blocks(en_srt_path)
    if ko_srt_path.is_file() and not force:
        ko_blocks = parse_srt_blocks(ko_srt_path)
        if len(ko_blocks) == len(en_blocks):
            return len(ko_blocks)

    translations = KO_TRANSLATIONS_BY_EP.get(ep_num)
    if not translations:
        raise RuntimeError(
            f"No built-in Korean translation list for EP{ep_num:02d} and {ko_srt_path} not found."
        )
    if len(translations) != len(en_blocks):
        raise RuntimeError(
            f"EP{ep_num:02d} Korean translation count ({len(translations)}) != EN.srt cue count ({len(en_blocks)})."
        )

    entries: List[str] = []
    for (idx_str, timing_line, _), ko_text in zip(en_blocks, translations):
        entries.append(f"{idx_str}\n{timing_line}\n{ko_text}\n")
    ko_srt_path.write_text("\n".join(entries), encoding="utf-8")
    return len(entries)


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
    parser = argparse.ArgumentParser(description="Create KO SRT and full-bleed 9:16 text-free YouTube Shorts with soft EN+KO subtitles.")
    parser.add_argument("--ep", type=int, default=1, help="Episode number (default: 1)")
    parser.add_argument("--regen-ko", action="store_true", help="Force regenerate KO.srt from built-in translations")
    parser.add_argument("--copy-dir", type=str, default=str(DEFAULT_COPY_DIR), help="Desktop export directory")
    parser.add_argument("--preview-times", type=str, default="20,115", help="Comma-separated seconds for QA preview frames")
    args = parser.parse_args()

    ep_num = args.ep
    ep_dir = REPO_ROOT / f"output/studio_anime/ep{ep_num:02d}_en"
    master_16x9 = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_16x9.mp4"
    en_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN.srt"
    ko_srt_path = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_KO.srt"
    out_shorts = ep_dir / f"SNSHero_StudioAnime_EP{ep_num:02d}_EN_KO_Shorts_9x16.mp4"

    for req in (master_16x9, en_srt_path):
        if not req.is_file():
            print(f"[ERROR] Required file missing: {req}", file=sys.stderr)
            return 1

    ko_cues = generate_ko_srt(ep_num, en_srt_path, ko_srt_path, force=args.regen_ko)
    print(f"[shorts] Episode EP{ep_num:02d}: KO SRT ready ({ko_cues} cues) -> {ko_srt_path}")
    print(f"[shorts] Full-bleed {CANVAS_W}x{CANVAS_H} (9:16), ZERO on-screen text, soft EN+KO subtitles")

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

    # Copy all 4 episode deliverables to Desktop movie directory
    copy_dir = Path(args.copy_dir).expanduser()
    copy_dir.mkdir(parents=True, exist_ok=True)
    for src in (master_16x9, out_shorts, en_srt_path, ko_srt_path):
        shutil.copy2(src, copy_dir / src.name)

    # Create symlinks for all 4 episode deliverables in dist/studio-anime/
    for src in (master_16x9, out_shorts, en_srt_path, ko_srt_path):
        create_symlink_force(src, DIST_SYMLINK_DIR / src.name)

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
    print(f"[SUCCESS] KO SRT          : {ko_srt_path} ({ko_cues} cues)")
    print(f"[SUCCESS] Preview Frames  : {[str(p) for p in preview_paths]}")
    print(f"[SUCCESS] Desktop Copies  : 4 files copied to {copy_dir}")
    print(f"[SUCCESS] Dist Symlinks   : 4 symlinks created in {DIST_SYMLINK_DIR}")
    print("=" * 68)
    return 0


if __name__ == "__main__":
    sys.exit(main())
