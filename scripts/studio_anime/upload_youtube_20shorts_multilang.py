#!/usr/bin/env python3
"""
SNSHero Studio Anime Shorts (EP01–EP20, 9:16) 10-Language YouTube Metadata, Playlist & API Post-Processor
---------------------------------------------------------------------------------------------------------
Reuses 10-language episode titles, game-play rewards, and play-CTA copy from
`upload_youtube_20eps_multilang.py` to manage the dedicated Official Shorts Playlist
and apply 10-language official `localizations` + playlist ordering for all 20 Shorts.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Tuple

from googleapiclient.errors import HttpError

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import upload_youtube_20eps_multilang as base

OUT_ROOT = base.OUT_ROOT
CHANNEL_ID = base.CHANNEL_ID
STATE_PATH = OUT_ROOT / "youtube_20shorts_upload_state.json"

SHORTS_PLAYLIST_TITLE = "SNSHero: Kadan's Journey | Official Studio Anime Shorts (EP01–EP20)"
SHORTS_PLAYLIST_DESC = (
    "Official 9:16 full-screen Studio Anime Shorts of SNSHero: Kadan's Journey (Episodes 01–20).\n"
    "Watch in vertical full-screen with English & Korean subtitle tracks!\n\n"
    "🎁 FREE PLAYER REWARDS — Claim free starter card packs, daily free summons, and collect 382 tactical cards with zero download!\n"
    "⚔️ Play the anime's story battles FREE right now in your browser: https://snshero.com\n"
    "#Shorts #SNSHero #KadansJourney #DarkFantasyAnime"
)

SHORTS_PLAYLIST_LOCALIZATIONS: Dict[str, Dict[str, str]] = {
    "en": {
        "title": SHORTS_PLAYLIST_TITLE,
        "description": SHORTS_PLAYLIST_DESC,
    },
    "ko": {
        "title": "눈히어로: 카단의 여정 | 공식 스튜디오 애니메이션 쇼츠 (1화~20화)",
        "description": "『눈히어로: 카단의 여정』 공식 9:16 풀스크린 스튜디오 애니메이션 쇼츠 1화~20화 재생목록!\n🎁 지금 접속 시 무료 스타터 카드팩 · 매일 무료 소환 · 382종 전략 카드 수집 보상 즉시 지급!\n⚔️ 무설치 웹 카드 RPG 바로 플레이: https://snshero.com #Shorts",
    },
    "ja": {
        "title": "SNSHero：カダンの旅｜公式スタジオアニメ Shorts（第1話〜第20話）",
        "description": "『SNSHero：カダンの旅』公式9:16縦型フルスクリーンアニメShorts第1話〜第20話！\n🎁 今すぐプレイで無料スターターパック＆毎日無料召喚・382枚のカード報酬をゲット！\n⚔️ 無料ブラウザカードRPG：https://snshero.com #Shorts",
    },
    "zh-Hans": {
        "title": "SNSHero：卡丹的旅程｜官方工作室动画 Shorts（第1集–第20集）",
        "description": "《SNSHero：卡丹的旅程》官方9:16全屏竖版动画Shorts第1集至第20集！\n🎁 立即畅玩领取免费新手卡包、每日免费召唤与382张策略卡牌奖励！\n⚔️ 免安装网页卡牌RPG立即开战：https://snshero.com #Shorts",
    },
    "zh-Hant": {
        "title": "SNSHero：卡丹的旅程｜官方工作室動畫 Shorts（第1集–第20集）",
        "description": "《SNSHero：卡丹的旅程》官方9:16全螢幕直式動畫Shorts第1集至第20集！\n🎁 立即暢玩領取免費新手卡包、每日免費召喚與382張策略卡牌獎勵！\n⚔️ 免安裝網頁卡牌RPG立即開戰：https://snshero.com #Shorts",
    },
    "es": {
        "title": "SNSHero: El Viaje de Kadan | Anime Oficial Shorts (EP01–EP20)",
        "description": "Shorts oficiales en pantalla completa 9:16 de SNSHero: El Viaje de Kadan (EP01–EP20).\n🎁 ¡RECOMPENSAS GRATIS! Sobres iniciales, invocaciones diarias gratis y 382 cartas tácticas.\n⚔️ Juega gratis en tu navegador: https://snshero.com #Shorts",
    },
    "fr": {
        "title": "SNSHero : Le Voyage de Kadan | Anime Officiel Shorts (EP01–EP20)",
        "description": "Shorts officiels plein écran 9:16 de SNSHero : Le Voyage de Kadan (EP01–EP20).\n🎁 RÉCOMPENSES GRATUITES : packs de départ offerts, invocations quotidiennes et 382 cartes !\n⚔️ Jouez gratuitement sans téléchargement : https://snshero.com #Shorts",
    },
    "de": {
        "title": "SNSHero: Kadans Reise | Offizielle Anime Shorts (EP01–EP20)",
        "description": "Offizielle 9:16 Vollbild-Anime-Shorts zu SNSHero: Kadans Reise (Folgen 1–20).\n🎁 GRATIS-BELOHNUNGEN: Kostenlose Starter-Packs, tägliche Beschwörungen & 382 Karten!\n⚔️ Jetzt kostenlos im Browser spielen: https://snshero.com #Shorts",
    },
    "id": {
        "title": "SNSHero: Perjalanan Kadan | Anime Resmi Shorts (EP01–EP20)",
        "description": "Anime Shorts layar penuh 9:16 resmi SNSHero: Perjalanan Kadan (EP01–EP20).\n🎁 HADIAH GRATIS: Paket kartu pemula, summon gratis harian & 382 kartu taktis!\n⚔️ Mainkan langsung di browser: https://snshero.com #Shorts",
    },
    "vi": {
        "title": "SNSHero: Hành Trình Của Kadan | Anime Chính Thức Shorts (Tập 01–20)",
        "description": "Anime Shorts toàn màn hình 9:16 chính thức SNSHero: Hành Trình Của Kadan (Tập 1–20).\n🎁 QUÀ TẶNG MIỄN PHÍ: Gói thẻ tân thủ, triệu hồi miễn phí mỗi ngày & 382 thẻ chiến thuật!\n⚔️ Chơi ngay trên trình duyệt: https://snshero.com #Shorts",
    },
}


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"playlistId": None, "episodes": {}}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_shorts_playlist(yt, state: dict) -> str:
    if state.get("playlistId"):
        pl_id = state["playlistId"]
        try:
            chk = yt.playlists().list(part="snippet,status", id=pl_id).execute()
            if chk.get("items"):
                base.log(f"Reusing existing Shorts playlist: {pl_id}")
                return pl_id
        except Exception:
            pass

    resp = yt.playlists().list(part="snippet", channelId=CHANNEL_ID, maxResults=50).execute()
    for it in resp.get("items", []):
        if it["snippet"].get("title") == SHORTS_PLAYLIST_TITLE:
            pl_id = it["id"]
            state["playlistId"] = pl_id
            save_state(state)
            base.log(f"Found existing matching Shorts playlist: {pl_id}")
            return pl_id

    body = {
        "snippet": {
            "title": SHORTS_PLAYLIST_TITLE,
            "description": SHORTS_PLAYLIST_DESC,
            "defaultLanguage": "en",
        },
        "status": {"privacyStatus": "public"},
        "localizations": SHORTS_PLAYLIST_LOCALIZATIONS,
    }
    created = yt.playlists().insert(part="snippet,status,localizations", body=body).execute()
    pl_id = created["id"]
    state["playlistId"] = pl_id
    save_state(state)
    base.log(f"Created new 10-language Shorts playlist: {pl_id} (https://www.youtube.com/playlist?list={pl_id})")
    return pl_id


def build_shorts_metadata(ep: int) -> Tuple[str, str, Dict[str, Dict[str, str]], List[str]]:
    _, full_desc, base_locs, base_tags = base.build_episode_metadata(ep)
    titles = base.EP_TITLES_10LANG[ep]

    default_title = f"[SNSHero Shorts EP{ep:02d}] {titles['en']} #Shorts"
    if len(default_title) > 100:
        default_title = default_title[:90] + "... #Shorts"

    default_desc = full_desc.replace(
        "#SNSHero #KadansJourney",
        "#Shorts #SNSHero #KadansJourney #AnimeShorts",
    )

    localizations: Dict[str, Dict[str, str]] = {}
    for lang, loc in base_locs.items():
        loc_t = titles[lang]
        if lang == "en":
            st = default_title
        elif lang == "ko":
            st = f"[눈히어로 쇼츠 {ep:02d}화] {loc_t} #Shorts"
        elif lang == "ja":
            st = f"[SNSHero Shorts 第{ep:02d}話] {loc_t} #Shorts"
        elif lang == "zh-Hans":
            st = f"[SNSHero Shorts 第{ep:02d}集] {loc_t} #Shorts"
        elif lang == "zh-Hant":
            st = f"[SNSHero Shorts 第{ep:02d}集] {loc_t} #Shorts"
        elif lang == "es":
            st = f"[SNSHero Shorts EP{ep:02d}] {loc_t} #Shorts"
        elif lang == "fr":
            st = f"[SNSHero Shorts EP{ep:02d}] {loc_t} #Shorts"
        elif lang == "de":
            st = f"[SNSHero Shorts EP{ep:02d}] {loc_t} #Shorts"
        elif lang == "id":
            st = f"[SNSHero Shorts EP{ep:02d}] {loc_t} #Shorts"
        else:
            st = f"[SNSHero Shorts Tập {ep:02d}] {loc_t} #Shorts"

        if len(st) > 100:
            st = st[:90] + "... #Shorts"

        sd = loc["description"]
        if "#Shorts" not in sd:
            sd = sd + "\n#Shorts #SNSHero"
        localizations[lang] = {"title": st, "description": sd}

    tags = ["Shorts", "AnimeShorts"] + base_tags
    return default_title, default_desc, localizations, tags


def main():
    parser = argparse.ArgumentParser(description="Init 10-language Shorts playlist and run API post-processing for EP01-EP20 Shorts")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=20)
    parser.add_argument("--init-playlist", action="store_true")
    parser.add_argument("--api-only-postprocess", action="store_true")
    parser.add_argument("--force-relocalize", action="store_true")
    args = parser.parse_args()

    state = load_state()
    yt = base.get_youtube_client()
    playlist_id = ensure_shorts_playlist(yt, state)

    if args.init_playlist and not args.api_only_postprocess:
        print(f"PLAYLIST_ID={playlist_id}")
        return

    existing_pl_vids = base.fetch_existing_playlist_videos(yt, playlist_id)

    for ep in range(args.start, args.end + 1):
        ep_key = f"{ep:02d}"
        info = state["episodes"].get(ep_key)
        if not info or not info.get("videoId"):
            continue
        if args.force_relocalize or not info.get("localized") or not info.get("inPlaylist"):
            yt_title, yt_desc, localizations, tags = build_shorts_metadata(ep)
            post = base.apply_api_postprocess(
                yt, playlist_id, ep, info["videoId"], yt_title, yt_desc, localizations, tags, existing_pl_vids, upload_captions=False
            )
            info.update(post)
            save_state(state)

    done = sum(1 for ep in range(args.start, args.end + 1) if state["episodes"].get(f"{ep:02d}", {}).get("videoId"))
    base.log(f"=== SHORTS SUMMARY: {done}/{args.end - args.start + 1} processed | Playlist: https://www.youtube.com/playlist?list={playlist_id} ===")


if __name__ == "__main__":
    main()
