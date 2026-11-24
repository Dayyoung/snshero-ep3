#!/usr/bin/env python3
"""Safely record an uploaded YouTube videoId into the Studio Anime upload state JSON."""
import argparse
import json
import time
from pathlib import Path

OUT_ROOT = Path("/Users/dayyoung/project/snshero/output/studio_anime")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=["video", "shorts"], required=True)
    parser.add_argument("--ep", type=int, required=True)
    parser.add_argument("--video-id", required=True)
    args = parser.parse_args()

    state_path = (
        OUT_ROOT / "youtube_20eps_upload_state.json"
        if args.kind == "video"
        else OUT_ROOT / "youtube_20shorts_upload_state.json"
    )
    state = json.loads(state_path.read_text(encoding="utf-8"))
    ep_key = f"{args.ep:02d}"
    vid = args.video_id.strip()
    if "/" in vid:
        vid = vid.rstrip("/").split("/")[-1]
    if "?" in vid:
        vid = vid.split("?")[0]

    url = f"https://youtube.com/shorts/{vid}" if args.kind == "shorts" else f"https://youtu.be/{vid}"
    state.setdefault("episodes", {})[ep_key] = {
        "episode": args.ep,
        "videoId": vid,
        "url": url,
        "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "localized": False,
        "inPlaylist": False,
    }
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"RECORDED {args.kind.upper()} EP{ep_key} -> {vid} ({url})")


if __name__ == "__main__":
    main()
