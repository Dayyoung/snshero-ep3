#!/usr/bin/env python3
"""1-shot batch matcher: matches the N newest MP4s in ~/Downloads against target
EPXX-CUTYY keyframes via Frame-0 RGB MAE (< 25.0), copies them to clips/, and
updates output/studio_anime/epXX_en/flow_status.json.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.studio_anime.qa_verify_pipeline import compute_frame0_mae  # noqa: E402

KST = timezone(timedelta(hours=9))
MAX_MAE = 25.0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ep", type=int, required=True)
    parser.add_argument("--cuts", nargs="+", required=True, help="e.g. 1 2 3 or EP28-CUT01 EP28-CUT02")
    parser.add_argument("--scan", type=int, default=8, help="Number of newest ~/Downloads/*.mp4 to inspect")
    args = parser.parse_args()

    ep_str = f"{args.ep:02d}"
    ep_dir = ROOT / "output" / "studio_anime" / f"ep{ep_str}_en"
    kf_dir = ep_dir / "keyframes"
    clips_dir = ep_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)
    status_path = ep_dir / "flow_status.json"
    prompts_path = ep_dir / f"flow_prompts_ep{ep_str}_en.json"

    target_cuts: list[str] = []
    for c in args.cuts:
        c = c.strip().upper()
        if c.isdigit():
            target_cuts.append(f"EP{ep_str}-CUT{int(c):02d}")
        elif c.startswith(f"EP{ep_str}-CUT"):
            target_cuts.append(c)
        else:
            target_cuts.append(f"EP{ep_str}-CUT{int(c.replace('CUT', '')):02d}")

    downloads = Path.home() / "Downloads"
    mp4s = sorted(downloads.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)[: args.scan]
    if not mp4s:
        print("ERROR: No .mp4 files found in ~/Downloads")
        return 1

    # Compute full MAE matrix: (cutCode, mp4Path) -> mae
    scores: list[tuple[float, str, Path]] = []
    for cut in target_cuts:
        kf = kf_dir / f"{cut}_keyframe.png"
        if not kf.exists():
            print(f"ERROR: Missing keyframe {kf}")
            return 1
        for mp4 in mp4s:
            mae, err = compute_frame0_mae(mp4, kf, 320, 180)
            if mae is not None and err is None:
                scores.append((mae, cut, mp4))

    scores.sort(key=lambda x: x[0])
    matched: dict[str, tuple[Path, float]] = {}
    used_mp4s: set[Path] = set()
    for mae, cut, mp4 in scores:
        if cut in matched or mp4 in used_mp4s:
            continue
        if mae < MAX_MAE:
            matched[cut] = (mp4, mae)
            used_mp4s.add(mp4)

    # Load or init flow_status.json
    title_en = ""
    if prompts_path.exists():
        try:
            title_en = json.loads(prompts_path.read_text(encoding="utf-8")).get("episodeTitleEn", "")
        except Exception:
            pass

    if status_path.exists():
        status = json.loads(status_path.read_text(encoding="utf-8"))
    else:
        status = {
            "episodeNumber": args.ep,
            "episodeTitleEn": title_en,
            "projectUrl": "https://flow.google.com/project/de975be6-d001-4c64-ba2f-5530fa91c7d8",
            "completedCuts": [],
            "pendingCuts": [f"EP{ep_str}-CUT{i:02d}" for i in range(1, 25)],
            "totalCuts": 24,
            "completedCount": 0,
            "status": "in_progress",
            "maeVerified": {},
            "updatedAt": "",
        }

    completed = set(status.get("completedCuts", []))
    mae_map = dict(status.get("maeVerified", {}))

    failed: list[str] = []
    for cut in target_cuts:
        if cut in matched:
            mp4, mae = matched[cut]
            dest = clips_dir / f"{cut}.mp4"
            shutil.copy2(mp4, dest)
            completed.add(cut)
            mae_map[cut] = round(mae, 2)
            print(f"OK  {cut} <- {mp4.name} ({dest.stat().st_size:,} bytes) MAE={mae:.2f}")
        else:
            failed.append(cut)
            print(f"MISS {cut} (no downloaded clip with MAE < {MAX_MAE})")

    all_cuts = [f"EP{ep_str}-CUT{i:02d}" for i in range(1, 25)]
    status["completedCuts"] = [c for c in all_cuts if c in completed]
    status["pendingCuts"] = [c for c in all_cuts if c not in completed]
    status["completedCount"] = len(status["completedCuts"])
    status["maeVerified"] = {c: mae_map[c] for c in all_cuts if c in mae_map}
    status["status"] = "completed" if status["completedCount"] == 24 else "in_progress"
    status["updatedAt"] = datetime.now(KST).isoformat(timespec="seconds")
    status_path.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"STATUS EP{ep_str}: {status['completedCount']}/24 ({status['status']})")
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
