#!/usr/bin/env python3
"""
SNSHero Full-Length Feature Animation (EP01-EP40, 94 Min) 10-Language YouTube Uploader
--------------------------------------------------------------------------------------
Uploads all 10 official dubbed full-length MP4s to @snshero (`UCA6QmKiPstbiyBUHtnSMxyA`)
with native-language titles, descriptions, localized 42-chapter timestamps, custom 1280x720
thumbnails, SRT captions, and a dedicated 10-language Feature Movie playlist.

Default upload order places English (`en`) and Korean (`ko`) FIRST:
  en, ko, ja, zh-Hans, zh-Hant, es, fr, de, id, vi

Usage:
  python3 scripts/studio_anime/upload_youtube_full_anime_10lang.py --langs en,ko
  python3 scripts/studio_anime/upload_youtube_full_anime_10lang.py
  python3 scripts/studio_anime/upload_youtube_full_anime_10lang.py --verify-only
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import certifi
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from upload_youtube_20eps_multilang import EP_TITLES_10LANG  # noqa: E402

REPO_ROOT = SCRIPT_DIR.parents[1]
OUT_ROOT = REPO_ROOT / "output/studio_anime"
THUMB_DIR = OUT_ROOT / "thumbs"
CHAPTERS_PATH = OUT_ROOT / "SNSHero_Full_Anime_EP01_EP40_EN_chapters.json"
STATE_PATH = OUT_ROOT / "youtube_full_anime_10lang_state.json"

TOKEN_PATH = Path("/Users/dayyoung/.gemini/config/snshero_youtube/token.json")
CHANNEL_ID = "UCA6QmKiPstbiyBUHtnSMxyA"
TMP_CHROME_DIR = Path("/tmp/yt_studio_snshero_anime_profile6")
PROFILE_DIR_NAME = "Profile 6"

LANG_ORDER: List[str] = [
    "en",
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

YT_AUDIO_LANG_FALLBACK: Dict[str, str] = {
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
}

PLAYLIST_TITLE_DEFAULT = "SNSHero: The Chronicles of Kadan | Full-Length Feature Anime (10 Languages)"
PLAYLIST_DESC_DEFAULT = (
    "Complete 94-minute Studio Anime feature film of SNSHero: The Chronicles of Kadan (EP01–EP40) "
    "available in 10 official dubbed languages (EN, KO, JA, ZH-Hans, ZH-Hant, ES, FR, DE, ID, VI).\n\n"
    "🎁 FREE PLAYER REWARDS — Claim free starter card packs, daily free summons, and collect 382 tactical cards!\n"
    "⚔️ Play the anime's story battles FREE in your browser: https://snshero.com"
)

PLAYLIST_LOCALIZATIONS: Dict[str, Dict[str, str]] = {
    "en": {"title": PLAYLIST_TITLE_DEFAULT, "description": PLAYLIST_DESC_DEFAULT},
    "ko": {
        "title": "눈히어로: 카단의 여정 | 풀버전 극장판 애니메이션 (10개 언어 더빙 완결편)",
        "description": "『눈히어로: 카단의 여정』 1화~40화 94분 풀버전 극장판 애니메이션 10개 공식 언어 더빙 컬렉션입니다.\n🎁 무료 스타터 카드팩 · 매일 무료 소환 · 382종 카드 수집!\n⚔️ 브라우저에서 바로 플레이: https://snshero.com",
    },
    "ja": {
        "title": "SNSHero：カダンの旅｜全40話フルアニメーション映画（公式10言語吹替）",
        "description": "『SNSHero：カダンの旅』第1話〜第40話（94分）フルアニメ映画の公式10言語吹替コレクションです。\n⚔️ ブラウザで今すぐ無料プレイ：https://snshero.com",
    },
    "zh-Hans": {
        "title": "SNSHero：卡丹的旅程｜全40集完整动画电影（官方10语配音版）",
        "description": "《SNSHero：卡丹的旅程》第1至40集94分钟完整动画电影官方10语配音合集。\n⚔️ 立即免费畅玩：https://snshero.com",
    },
    "zh-Hant": {
        "title": "SNSHero：卡丹的旅程｜全40集完整動畫電影（官方10語配音版）",
        "description": "《SNSHero：卡丹的旅程》第1至40集94分鐘完整動畫電影官方10語配音合集。\n⚔️ 立即免費暢玩：https://snshero.com",
    },
    "es": {
        "title": "SNSHero: El Viaje de Kadan | Película Anime Completa (10 Idiomas)",
        "description": "Película completa de 94 minutos SNSHero: El Viaje de Kadan (EP01–40) en 10 idiomas oficiales.\n⚔️ Juega gratis en tu navegador: https://snshero.com",
    },
    "fr": {
        "title": "SNSHero : Le Voyage de Kadan | Film Anime Complet (10 Langues)",
        "description": "Film d'animation complet de 94 minutes SNSHero : Le Voyage de Kadan (EP01–40) en 10 langues officielles.\n⚔️ Jouez gratuitement : https://snshero.com",
    },
    "de": {
        "title": "SNSHero: Kadans Reise | Ganzer Anime-Film (10 Sprachen)",
        "description": "Kompletter 94-Minuten-Anime-Film SNSHero: Kadans Reise (Folgen 1–40) in 10 offiziellen Sprachen.\n⚔️ Jetzt kostenlos spielen: https://snshero.com",
    },
    "id": {
        "title": "SNSHero: Perjalanan Kadan | Film Anime Lengkap (10 Bahasa)",
        "description": "Film anime lengkap 94 menit SNSHero: Perjalanan Kadan (EP01–40) dalam 10 bahasa resmi.\n⚔️ Mainkan gratis di browser: https://snshero.com",
    },
    "vi": {
        "title": "SNSHero: Hành Trình Của Kadan | Phim Anime Trọn Bộ (10 Ngôn Ngữ)",
        "description": "Phim hoạt hình trọn bộ 94 phút SNSHero: Hành Trình Của Kadan (Tập 01–40) với 10 ngôn ngữ lồng tiếng chính thức.\n⚔️ Chơi miễn phí trên trình duyệt: https://snshero.com",
    },
}

NATIVE_META: Dict[str, Dict[str, Any]] = {
    "en": {
        "title": "[FULL ANIME MOVIE] SNSHero: The Chronicles of Kadan (EP01–40 Complete | 94 Min English Dub)",
        "thumb_badge": "94 MIN · EP01–40 · ENGLISH DUB",
        "thumb_sub": "THE CHRONICLES OF KADAN — COMPLETE FEATURE",
        "caption_name": "English",
        "intro_label": "Opening & Character Introductions",
        "ending_label": "Epilogue Montage & Credits (SNSHero.com)",
        "chapters_header": "⏱️ CHAPTERS (EP01–EP40)",
        "ep_prefix": "EP",
        "body": (
            "🎬 SNSHero: The Chronicles of Kadan — Complete 94-Minute Studio Anime Feature (Episodes 01–40, Official English Dub).\n\n"
            "From the blizzard betrayal that shattered Elwin Village to the final battle atop the Black Citadel, "
            "follow Kadan, Silia, Ignis, and the Six Masters across all 40 chapters in one seamless feature film.\n\n"
            "🎁 FREE PLAYER REWARDS — Claim free starter card packs, daily free summons, and collect 382 tactical cards with zero download!\n"
            "⚔️ Play Kadan's Journey Story Boss Battles FREE right now: https://snshero.com"
        ),
        "hashtags": "#SNSHero #KadansJourney #FullAnimeMovie #DarkFantasyAnime #AnimeMovie #CardRPG #FreeGame",
        "tags": ["SNSHero", "Kadan's Journey", "Full Anime Movie", "Dark Fantasy Anime", "EP01-40", "English Dub", "Card RPG"],
    },
    "ko": {
        "title": "[풀버전 애니 1~40화 완결] 눈히어로: 카단의 여정 (94분 한국어 더빙 완전판)",
        "thumb_badge": "94분 완결 · 1~40화 · 한국어 더빙",
        "thumb_sub": "눈히어로: 카단의 여정 — 극장판 완전편",
        "caption_name": "한국어 (Korean)",
        "intro_label": "오프닝 & 주요 등장인물 소개",
        "ending_label": "에필로그 몽타주 & 엔딩 크레딧 (SNSHero.com)",
        "chapters_header": "⏱️ 챕터 타임라인 (1화~40화)",
        "ep_prefix": "EP",
        "body": (
            "🎬 『눈히어로: 카단의 여정』 스튜디오 애니메이션 제1화~제40화 완결 94분 풀버전 극장판 (공식 한국어 더빙).\n\n"
            "엘윈마을의 눈보라 속 비극부터 검은 성채 최후의 결전까지, 카단과 실리아·이그니스·6대 스승이 써 내려간 "
            "40화 대서사시를 끊김 없는 한 편의 장편 애니메이션으로 감상하세요.\n\n"
            "🎁 무료 게임 보상: 지금 접속 시 무료 스타터 카드팩 · 매일 무료 소환 · 382종 전략 카드 수집 & 40화 스토리 보스전 즉시 플레이!\n"
            "⚔️ 무설치 웹 카드 RPG 바로 플레이: https://snshero.com"
        ),
        "hashtags": "#눈히어로 #카단의여정 #풀버전애니 #판타지애니 #한국어더빙 #무료웹게임 #SNSHero",
        "tags": ["눈히어로", "카단의 여정", "SNSHero", "풀버전 애니메이션", "한국어 더빙", "다크 판타지", "카드 RPG"],
    },
    "ja": {
        "title": "[全40話フルアニメ] SNSHero：カダンの旅 完結編（94分・日本語吹替版）",
        "thumb_badge": "全40話・94分｜日本語吹替版",
        "thumb_sub": "SNSHero：カダンの旅 — 長編完全版",
        "caption_name": "日本語 (Japanese)",
        "intro_label": "オープニング＆主要キャラクター紹介",
        "ending_label": "エピローグ＆エンディングクレジット (SNSHero.com)",
        "chapters_header": "⏱️ チャプター（第1話〜第40話）",
        "ep_prefix": "第",
        "body": (
            "🎬 『SNSHero：カダンの旅』公式スタジオアニメ第1話〜第40話（94分）日本語吹替フルムービー。\n\n"
            "エルウィン村を襲った雪夜の裏切りから黒き城塞の最終決戦まで、カダン、シリア、イグニスと六大師の壮大な旅路を一挙に収録。\n\n"
            "🎁 無料プレイ特典：無料スターターパック・毎日無料召喚・全382枚の戦略カード収集＆全40話ボス戦！\n"
            "⚔️ インストール不要・無料ブラウザRPG今すぐプレイ：https://snshero.com"
        ),
        "hashtags": "#SNSHero #カダンの旅 #フルアニメ #ダークファンタジー #日本語吹替 #カードRPG",
        "tags": ["SNSHero", "カダンの旅", "フルアニメ", "日本語吹替", "ファンタジーアニメ", "カードRPG"],
    },
    "zh-Hans": {
        "title": "[全40集完整动画电影] SNSHero：卡丹的旅程 完结篇（94分钟中文配音版）",
        "thumb_badge": "全40集 · 94分钟 · 简体中文配音",
        "thumb_sub": "SNSHero：卡丹的旅程 — 完整剧场版",
        "caption_name": "简体中文 (Chinese Simplified)",
        "intro_label": "开场与主要角色介绍",
        "ending_label": "终章回顾与片尾鸣谢 (SNSHero.com)",
        "chapters_header": "⏱️ 章节时间轴（第1集–第40集）",
        "ep_prefix": "EP",
        "body": (
            "🎬 《SNSHero：卡丹的旅程》第1至第40集完整94分钟动画电影（官方简体中文配音版）。\n\n"
            "从暴风雪中埃尔温村的背叛，到黑色堡垒巅的终极决战，一次完整呈现卡丹、西莉亚、伊格尼斯与六大宗师的史诗征程。\n\n"
            "🎁 免费游戏奖励：立即进入即可领取免费新手卡包、每日免费召唤与382张策略卡牌！\n"
            "⚔️ 免安装网页卡牌RPG立即开战：https://snshero.com"
        ),
        "hashtags": "#SNSHero #卡丹的旅程 #完整动画电影 #暗黑奇幻 #中文配音 #卡牌RPG",
        "tags": ["SNSHero", "卡丹的旅程", "完整动画", "中文配音", "奇幻动画", "卡牌RPG"],
    },
    "zh-Hant": {
        "title": "[全40集完整動畫電影] SNSHero：卡丹的旅程 完結篇（94分鐘中文配音版）",
        "thumb_badge": "全40集 · 94分鐘 · 繁體中文配音",
        "thumb_sub": "SNSHero：卡丹的旅程 — 完整劇場版",
        "caption_name": "繁體中文 (Chinese Traditional)",
        "intro_label": "開場與主要角色介紹",
        "ending_label": "終章回顧與片尾鳴謝 (SNSHero.com)",
        "chapters_header": "⏱️ 章節時間軸（第1集–第40集）",
        "ep_prefix": "EP",
        "body": (
            "🎬 《SNSHero：卡丹的旅程》第1至第40集完整94分鐘動畫電影（官方繁體中文配音版）。\n\n"
            "從暴風雪中埃爾溫村的背叛，到黑色堡壘之巔的終極決戰，一次完整呈現卡丹、西莉亞、伊格尼斯與六大宗師的史詩征程。\n\n"
            "🎁 免費遊戲獎勵：立即進入即可領取免費新手卡包、每日免費召喚與382張策略卡牌！\n"
            "⚔️ 免安裝網頁卡牌RPG立即開戰：https://snshero.com"
        ),
        "hashtags": "#SNSHero #卡丹的旅程 #完整動畫電影 #暗黑奇幻 #中文配音 #卡牌RPG",
        "tags": ["SNSHero", "卡丹的旅程", "完整動畫", "繁體中文", "奇幻動畫", "卡牌RPG"],
    },
    "es": {
        "title": "[PELÍCULA ANIME COMPLETA] SNSHero: El Viaje de Kadan (EP01–40 | 94 Min Doblaje Español)",
        "thumb_badge": "94 MIN · EP01–40 · DOBLAJE ESPAÑOL",
        "thumb_sub": "EL VIAJE DE KADAN — PELÍCULA COMPLETA",
        "caption_name": "Español (Spanish)",
        "intro_label": "Introducción y Personajes Principales",
        "ending_label": "Epílogo y Créditos Finales (SNSHero.com)",
        "chapters_header": "⏱️ CAPÍTULOS (EP01–EP40)",
        "ep_prefix": "EP",
        "body": (
            "🎬 SNSHero: El Viaje de Kadan — Película completa de anime de 94 minutos (Episodios 01 al 40, doblaje oficial al español).\n\n"
            "Desde la traición bajo la ventisca en Aldea Elwin hasta la batalla final en la Ciudadela Negra, "
            "vive los 40 episodios completos de Kadan, Silia e Ignis sin cortes.\n\n"
            "🎁 RECOMPENSAS GRATIS: Reclama sobres iniciales, invocaciones diarias gratis y 382 cartas tácticas sin descargas.\n"
            "⚔️ Juega gratis en tu navegador: https://snshero.com"
        ),
        "hashtags": "#SNSHero #ElViajeDeKadan #PeliculaAnime #AnimeEspañol #FantasiaOscura #CardRPG",
        "tags": ["SNSHero", "El Viaje de Kadan", "Película Anime", "Anime en Español", "Fantasía Oscura", "RPG de Cartas"],
    },
    "fr": {
        "title": "[FILM ANIME COMPLET] SNSHero : Le Voyage de Kadan (EP01–40 | 94 Min VF)",
        "thumb_badge": "94 MIN · EP01–40 · VERSION FRANÇAISE",
        "thumb_sub": "LE VOYAGE DE KADAN — FILM COMPLET",
        "caption_name": "Français (French)",
        "intro_label": "Ouverture et Présentation des Personnages",
        "ending_label": "Épilogue et Générique de Fin (SNSHero.com)",
        "chapters_header": "⏱️ CHAPITRES (EP01–EP40)",
        "ep_prefix": "EP",
        "body": (
            "🎬 SNSHero : Le Voyage de Kadan — Long-métrage d'animation complet de 94 minutes (Épisodes 01 à 40, version française officielle).\n\n"
            "De la trahison dans le blizzard au village d'Elwin jusqu'à l'affrontement final à la Citadelle Noire, "
            "suivez l'épopée intégrale de Kadan, Silia et Ignis.\n\n"
            "🎁 RÉCOMPENSES GRATUITES : packs de démarrage offerts, invocations gratuites quotidiennes et 382 cartes tactiques !\n"
            "⚔️ Jouez gratuitement sans téléchargement : https://snshero.com"
        ),
        "hashtags": "#SNSHero #LeVoyageDeKadan #FilmAnime #AnimeVF #DarkFantasy #JeuDeCartes",
        "tags": ["SNSHero", "Le Voyage de Kadan", "Film Anime", "Anime VF", "Dark Fantasy", "Card RPG"],
    },
    "de": {
        "title": "[GANZER ANIME FILM] SNSHero: Kadans Reise (Folgen 1–40 | 94 Min Deutsch)",
        "thumb_badge": "94 MIN · EP01–40 · DEUTSCHE SYNCHRO",
        "thumb_sub": "KADANS REISE — KOMPLETTER FILM",
        "caption_name": "Deutsch (German)",
        "intro_label": "Intro & Vorstellung der Hauptcharaktere",
        "ending_label": "Epilog-Montage & Abspann (SNSHero.com)",
        "chapters_header": "⏱️ KAPITEL (FOLGE 01–40)",
        "ep_prefix": "EP",
        "body": (
            "🎬 SNSHero: Kadans Reise — Kompletter 94-Minuten-Anime-Spielfilm (Folgen 1–40, offizielle deutsche Synchronfassung).\n\n"
            "Vom Verrat im Schneesturm über Dorf Elwin bis zum letzten Kampf auf der Schwarzen Zitadelle — "
            "erlebe alle 40 Kapitel von Kadan, Silia und Ignis am Stück.\n\n"
            "🎁 GRATIS-BELOHNUNGEN: Kostenlose Starter-Kartenpacks, tägliche Gratis-Beschwörungen & 382 taktische Karten!\n"
            "⚔️ Jetzt kostenlos im Browser spielen: https://snshero.com"
        ),
        "hashtags": "#SNSHero #KadansReise #GanzerAnimeFilm #AnimeDeutsch #DarkFantasy #CardRPG",
        "tags": ["SNSHero", "Kadans Reise", "Ganzer Anime Film", "Anime Deutsch", "Dark Fantasy", "Kartenspiel"],
    },
    "id": {
        "title": "[FILM ANIME LENGKAP] SNSHero: Perjalanan Kadan (EP01–40 | 94 Menit Dubbing Indonesia)",
        "thumb_badge": "94 MENIT · EP01–40 · BAHASA INDONESIA",
        "thumb_sub": "PERJALANAN KADAN — FILM LENGKAP",
        "caption_name": "Bahasa Indonesia",
        "intro_label": "Pembukaan & Pengenalan Karakter Utama",
        "ending_label": "Montase Epilog & Kredit Akhir (SNSHero.com)",
        "chapters_header": "⏱️ BABAK CERITA (EP01–EP40)",
        "ep_prefix": "EP",
        "body": (
            "🎬 SNSHero: Perjalanan Kadan — Film animasi lengkap berdurasi 94 menit (Episode 01–40, dubbing resmi Bahasa Indonesia).\n\n"
            "Dari pengkhianatan badai salju di Desa Elwin hingga pertarungan terakhir di Benteng Hitam, "
            "saksikan kisah lengkap Kadan, Silia, Ignis, dan Enam Guru Agung.\n\n"
            "🎁 HADIAH GRATIS: Klaim paket kartu pemula, summon gratis harian, dan koleksi 382 kartu taktis!\n"
            "⚔️ Mainkan langsung gratis di browser tanpa unduh: https://snshero.com"
        ),
        "hashtags": "#SNSHero #PerjalananKadan #FilmAnime #AnimeIndonesia #DarkFantasy #CardRPG",
        "tags": ["SNSHero", "Perjalanan Kadan", "Film Anime", "Anime Indonesia", "Dark Fantasy", "Game Kartu"],
    },
    "vi": {
        "title": "[PHIM ANIME TRỌN BỘ] SNSHero: Hành Trình Của Kadan (Tập 01–40 | 94 Phút Lồng Tiếng Việt)",
        "thumb_badge": "94 PHÚT · TẬP 01–40 · TIẾNG VIỆT",
        "thumb_sub": "HÀNH TRÌNH CỦA KADAN — PHIM TRỌN BỘ",
        "caption_name": "Tiếng Việt (Vietnamese)",
        "intro_label": "Mở Đầu & Giới Thiệu Nhân Vật Chính",
        "ending_label": "Hồi Kết & Danh Sách Thực Hiện (SNSHero.com)",
        "chapters_header": "⏱️ MỤC LỤC TẬP (TẬP 01–40)",
        "ep_prefix": "Tập ",
        "body": (
            "🎬 SNSHero: Hành Trình Của Kadan — Phim hoạt hình trọn bộ 94 phút (Tập 01–40, bản lồng tiếng Việt chính thức).\n\n"
            "Từ đêm phản bội trong bão tuyết tại Làng Elwin đến trận chiến cuối cùng trên đỉnh Thành Đen, "
            "theo dõi trọn vẹn hành trình của Kadan, Silia, Ignis và Lục Đại Tông Sư.\n\n"
            "🎁 QUÀ TẶNG MIỄN PHÍ: Nhận gói thẻ tân thủ, triệu hồi miễn phí mỗi ngày & sưu tập 382 thẻ bài chiến thuật!\n"
            "⚔️ Chơi ngay trên trình duyệt không cần tải: https://snshero.com"
        ),
        "hashtags": "#SNSHero #HanhTrinhCuaKadan #PhimAnime #AnimeTiengViet #DarkFantasy #CardRPG",
        "tags": ["SNSHero", "Hành Trình Của Kadan", "Phim Anime Trọn Bộ", "Anime Tiếng Việt", "Dark Fantasy", "Game Thẻ Bài"],
    },
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def get_youtube_client():
    data = json.loads(TOKEN_PATH.read_text(encoding="utf-8"))
    scopes = data.get("scopes") or []
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), scopes or None)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")
        os.chmod(TOKEN_PATH, 0o600)
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"playlistId": None, "languages": {}}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_font_for_lang(lang: str, size: int) -> ImageFont.FreeTypeFont:
    if lang == "ko":
        candidates = ["/System/Library/Fonts/AppleSDGothicNeo.ttc", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"]
    elif lang in ("ja", "zh-Hans", "zh-Hant"):
        candidates = ["/System/Library/Fonts/Hiragino Sans GB.ttc", "/System/Library/Fonts/STHeiti Medium.ttc", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"]
    else:
        candidates = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"]

    for p in candidates:
        if Path(p).is_file():
            try:
                idx = 6 if "AppleSDGothicNeo" in p else 0
                return ImageFont.truetype(p, size=size, index=idx)
            except Exception:
                try:
                    return ImageFont.truetype(p, size=size)
                except Exception:
                    pass
    return ImageFont.load_default()


def generate_feature_thumbnail(lang: str) -> Path:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    tag = LANG_TAGS[lang]
    out_jpg = THUMB_DIR / f"full_anime_{tag}_thumb.jpg"
    if out_jpg.is_file() and out_jpg.stat().st_size > 20_000:
        return out_jpg

    bg_path = OUT_ROOT / "ep08_en/keyframes/EP08-CUT07_keyframe.png"
    if not bg_path.is_file():
        bg_path = OUT_ROOT / "ep40_en/keyframes/EP40-CUT24_keyframe.png"

    base = Image.open(bg_path).convert("RGBA").resize((1280, 720), Image.Resampling.LANCZOS)

    # Bottom cinematic gradient + top subtle scrim for legibility
    overlay = Image.new("RGBA", (1280, 720), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for dy in range(280):
        alpha = int(235 * (dy / 279.0) ** 1.35)
        y = 720 - 280 + dy
        odraw.line((0, y, 1280, y), fill=(8, 10, 16, alpha))
    for dy in range(110):
        alpha = int(150 * (1.0 - dy / 109.0))
        odraw.line((0, dy, 1280, dy), fill=(8, 10, 16, alpha))
    comp = Image.alpha_composite(base, overlay)

    # Brand logo top-left
    logo_path = REPO_ROOT / ("public/hs-assets/brand/logo-ko.webp" if lang == "ko" else "public/hs-assets/brand/logo-en.webp")
    if logo_path.is_file():
        logo = Image.open(logo_path).convert("RGBA")
        lw = 260
        lh = int(logo.height * (lw / logo.width))
        logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
        comp.paste(logo, (44, 32), logo)

    draw = ImageDraw.Draw(comp)
    meta = NATIVE_META[lang]

    # Top-right badge pill
    f_badge = _load_font_for_lang(lang, 26)
    badge_txt = meta["thumb_badge"]
    bb = draw.textbbox((0, 0), badge_txt, font=f_badge)
    bw = bb[2] - bb[0]
    bh = bb[3] - bb[1]
    px, py = 1280 - 44 - bw - 36, 40
    draw.rectangle((px, py, px + bw + 36, py + bh + 22), fill=(212, 175, 55, 240))
    draw.text((px + 18, py + 9), badge_txt, font=f_badge, fill=(14, 16, 22, 255))

    # Bottom feature title & gold divider
    f_title = _load_font_for_lang(lang, 44)
    title_txt = meta["thumb_sub"]
    draw.text((52, 578), title_txt, font=f_title, fill=(250, 245, 232, 255))
    draw.line((52, 636, 520, 636), fill=(212, 175, 55, 220), width=3)

    f_foot = _load_font_for_lang(lang, 22)
    draw.text((52, 650), "SNSHero.com · Official 40-Episode Complete Studio Anime", font=f_foot, fill=(216, 212, 200, 235))

    comp.convert("RGB").save(out_jpg, "JPEG", quality=93)
    return out_jpg


def build_native_metadata(lang: str, chapters_meta: Dict[str, Any]) -> Tuple[str, str, List[str]]:
    meta = NATIVE_META[lang]
    title = meta["title"]
    if len(title) > 100:
        title = title[:97] + "..."

    ch_lines = [meta["chapters_header"]]
    for ch in chapters_meta["chapters"]:
        ts = ch["timestamp"]
        cid = ch["id"]
        if cid == "intro":
            ch_lines.append(f"{ts} {meta['intro_label']}")
        elif cid == "ending":
            ch_lines.append(f"{ts} {meta['ending_label']}")
        else:
            ep = int(ch["episode"])
            ep_title = EP_TITLES_10LANG[ep][lang]
            if lang == "ja":
                ch_lines.append(f"{ts} 第{ep:02d}話: {ep_title}")
            elif lang in ("zh-Hans", "zh-Hant"):
                ch_lines.append(f"{ts} 第{ep:02d}集: {ep_title}")
            elif lang == "ko":
                ch_lines.append(f"{ts} {ep:02d}화: {ep_title}")
            elif lang == "vi":
                ch_lines.append(f"{ts} Tập {ep:02d}: {ep_title}")
            else:
                ch_lines.append(f"{ts} EP{ep:02d}: {ep_title}")

    desc = f"{meta['body']}\n\n" + "\n".join(ch_lines) + f"\n\n{meta['hashtags']}"
    if len(desc) > 4950:
        desc = desc[:4947] + "..."
    return title, desc, meta["tags"]


def ensure_playlist(yt, state: dict) -> str:
    if state.get("playlistId"):
        pl_id = state["playlistId"]
        try:
            chk = yt.playlists().list(part="snippet,status", id=pl_id).execute()
            if chk.get("items"):
                log(f"Reusing existing 10-lang Feature playlist: {pl_id}")
                return pl_id
        except Exception as e:
            log(f"Warning checking playlist {pl_id}: {e}")

    resp = yt.playlists().list(part="snippet", channelId=CHANNEL_ID, maxResults=50).execute()
    for it in resp.get("items", []):
        if it["snippet"].get("title") == PLAYLIST_TITLE_DEFAULT:
            pl_id = it["id"]
            state["playlistId"] = pl_id
            save_state(state)
            log(f"Found existing matching playlist: {pl_id}")
            return pl_id

    body = {
        "snippet": {
            "title": PLAYLIST_TITLE_DEFAULT,
            "description": PLAYLIST_DESC_DEFAULT,
            "defaultLanguage": "en",
        },
        "status": {"privacyStatus": "public"},
        "localizations": PLAYLIST_LOCALIZATIONS,
    }
    created = yt.playlists().insert(part="snippet,status,localizations", body=body).execute()
    pl_id = created["id"]
    state["playlistId"] = pl_id
    save_state(state)
    log(f"Created 10-lang Feature playlist: {pl_id} (https://www.youtube.com/playlist?list={pl_id})")
    return pl_id


def ensure_chrome_profile() -> None:
    src_root = Path("/Users/dayyoung/Library/Application Support/Google/Chrome")
    if not TMP_CHROME_DIR.exists() or not (TMP_CHROME_DIR / PROFILE_DIR_NAME).exists():
        log(f"Preparing Chrome {PROFILE_DIR_NAME} copy at {TMP_CHROME_DIR} ...")
        TMP_CHROME_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_root / "Local State", TMP_CHROME_DIR / "Local State")
        shutil.copytree(
            src_root / PROFILE_DIR_NAME,
            TMP_CHROME_DIR / PROFILE_DIR_NAME,
            symlinks=True,
            ignore=shutil.ignore_patterns(
                "Cache*", "Code Cache*", "GPUCache*", "Service Worker*", "Singleton*", "Sessions*"
            ),
        )
    for sf in TMP_CHROME_DIR.glob("Singleton*"):
        sf.unlink(missing_ok=True)


def upload_via_api(
    yt,
    lang: str,
    mp4_path: Path,
    yt_title: str,
    yt_desc: str,
    tags: List[str],
) -> Tuple[Optional[str], bool]:
    """Resumable YouTube Data API v3 upload (16 MB chunks, automatic retry)."""
    audio_lang = YT_AUDIO_LANG_FALLBACK.get(lang, lang)
    size_gb = mp4_path.stat().st_size / (1024**3)
    log(f"[{lang}] Starting YouTube Data API v3 resumable upload: {mp4_path.name} ({size_gb:.2f} GB) ...")

    body = {
        "snippet": {
            "title": yt_title,
            "description": yt_desc,
            "tags": tags,
            "categoryId": "1",
            "defaultLanguage": audio_lang,
            "defaultAudioLanguage": audio_lang,
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(mp4_path), mimetype="video/mp4", chunksize=16 * 1024 * 1024, resumable=True)
    request = yt.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    last_log_pct = -10
    last_log_t = time.time()
    retry = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            retry = 0
            if status:
                pct = int(status.progress() * 100)
                now = time.time()
                if pct >= last_log_pct + 10 or (now - last_log_t) >= 30.0:
                    log(f"[{lang}] API upload progress: {pct}%")
                    last_log_pct = pct
                    last_log_t = now
        except HttpError as e:
            err_s = str(e)
            if e.resp.status in (400, 403) and any(
                k in err_s for k in ("quotaExceeded", "uploadLimitExceeded", "exceeded the number of videos")
            ):
                log(f"[{lang}] YouTube API quota/upload limit reached: {err_s[:240]}")
                return None, True
            if e.resp.status in (500, 502, 503, 504) and retry < 6:
                retry += 1
                wait_s = min(60, 2**retry)
                log(f"[{lang}] Transient HTTP {e.resp.status}; retrying chunk in {wait_s}s...")
                time.sleep(wait_s)
                continue
            raise
        except Exception as e:
            if retry < 6:
                retry += 1
                wait_s = min(60, 2**retry)
                log(f"[{lang}] Network error ({type(e).__name__}: {e}); retrying chunk in {wait_s}s...")
                time.sleep(wait_s)
                continue
            raise

    video_id = response["id"]
    log(f"[{lang}] API Upload Complete & Public: https://youtu.be/{video_id}")
    return video_id, False


def upload_via_studio(
    page,
    lang: str,
    mp4_path: Path,
    thumb_path: Path,
    yt_title: str,
    yt_desc: str,
) -> Tuple[Optional[str], bool]:
    upload_url = f"https://studio.youtube.com/channel/{CHANNEL_ID}/content?d=ud"
    log(f"[{lang}] Opening YouTube Studio upload dialog for {mp4_path.name} ({mp4_path.stat().st_size / 1024**3:.2f} GB) ...")
    page.goto(upload_url, wait_until="domcontentloaded", timeout=45000)
    time.sleep(3.5)

    try:
        skip_btn = page.locator(
            'a:has-text("YOUTUBE 스튜디오로 건너뛰기"), a:has-text("Skip to YouTube Studio")'
        ).first
        if skip_btn.count() > 0 and skip_btn.is_visible():
            skip_btn.click(force=True)
            time.sleep(3.0)
    except Exception:
        pass

    if "accounts.google.com" in page.url:
        log("[ERROR] YouTube Studio requires Google login. Stopping.")
        return None, True

    file_input = page.locator("input[type=file]").first
    if file_input.count() == 0:
        create_btn = page.locator("ytcp-button#create-icon, #create-icon").first
        if create_btn.count() > 0:
            create_btn.click(force=True)
            time.sleep(1.5)
            page.locator("tp-yt-paper-item#text-item-0").first.click(force=True)
            time.sleep(2.0)

    page.locator("input[type=file]").first.set_input_files(str(mp4_path))

    dialog = page.locator("ytcp-uploads-dialog")
    video_id = None
    for _ in range(90):
        time.sleep(1.0)
        body_txt = dialog.inner_text() if dialog.count() > 0 else page.inner_text("body")
        if "일일 업로드 한도" in body_txt or "Daily upload limit" in body_txt:
            log(f"[{lang}] Daily upload limit reached on YouTube Studio!")
            return None, True
        links = dialog.locator("a[href*='youtu.be'], a[href*='youtube.com/watch']")
        if links.count() > 0:
            href = links.first.get_attribute("href") or ""
            if "youtu.be/" in href:
                video_id = href.split("youtu.be/")[-1].split("?")[0].strip()
            elif "v=" in href:
                video_id = href.split("v=")[-1].split("&")[0].strip()
            if video_id:
                break

    if not video_id:
        log(f"[{lang}] Could not detect assigned video_id.")
        return None, False

    log(f"[{lang}] Assigned Video ID: {video_id}")

    title_box = dialog.locator("#title-textarea #textbox").first
    title_box.wait_for(state="visible", timeout=20000)
    title_box.click(force=True)
    page.keyboard.press("Meta+A")
    page.keyboard.press("Backspace")
    title_box.fill(yt_title)
    time.sleep(0.4)

    desc_box = dialog.locator("#description-textarea #textbox").first
    if desc_box.count() > 0:
        desc_box.click(force=True)
        page.keyboard.press("Meta+A")
        page.keyboard.press("Backspace")
        desc_box.fill(yt_desc)
        time.sleep(0.4)

    if thumb_path.exists():
        thumb_in = dialog.locator("input#file-loader").first
        if thumb_in.count() > 0:
            thumb_in.set_input_files(str(thumb_path))
            time.sleep(1.5)

    not_mfk = dialog.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first
    not_mfk.scroll_into_view_if_needed()
    not_mfk.click(force=True)
    time.sleep(0.4)
    if not_mfk.get_attribute("aria-checked") != "true":
        not_mfk.click(force=True)
        time.sleep(0.4)

    for _ in range(3):
        nxt = dialog.locator("#next-button").first
        nxt.click(force=True)
        time.sleep(1.2)

    pub_radio = dialog.locator('tp-yt-paper-radio-button[name="PUBLIC"]').first
    pub_radio.wait_for(state="visible", timeout=15000)
    pub_radio.click(force=True)
    time.sleep(0.5)

    # Wait patiently up to 45 minutes for 4.05 GB upload completion
    last_log_t = 0.0
    for _ in range(1350):
        status_txt = dialog.locator(".progress-label").first.inner_text() if dialog.locator(".progress-label").count() > 0 else ""
        if any(k in status_txt for k in ("일일 업로드 한도", "Daily upload limit")):
            log(f"[{lang}] Daily upload limit reached during upload!")
            return None, True
        done_btn = dialog.locator("#done-button").first
        is_disabled = done_btn.get_attribute("disabled") is not None or done_btn.get_attribute("aria-disabled") == "true"
        if any(k in status_txt for k in ("처리", "Processing", "완료", "complete", "Checks", "검사")) and not is_disabled:
            log(f"[{lang}] Upload finished ({status_txt.strip()}), publishing...")
            break
        if "%" in status_txt and "100%" in status_txt and not is_disabled:
            log(f"[{lang}] Upload reached 100% ({status_txt.strip()}), publishing...")
            break
        now = time.time()
        if now - last_log_t >= 30.0:
            log(f"[{lang}] Upload progress: {status_txt.strip() or 'uploading...'}")
            last_log_t = now
        time.sleep(2.0)

    done_btn = dialog.locator("#done-button").first
    done_btn.click(force=True)
    time.sleep(5.0)

    try:
        close_btn = page.locator("ytcp-video-share-dialog #close-button, ytcp-uploads-still-processing-dialog #close-button").first
        if close_btn.count() > 0 and close_btn.is_visible():
            close_btn.click(force=True)
            time.sleep(1.0)
    except Exception:
        pass

    log(f"[{lang}] Published on YouTube Studio: https://youtu.be/{video_id}")
    return video_id, False


def fetch_existing_playlist_videos(yt, playlist_id: str) -> set:
    vids = set()
    token = None
    while True:
        try:
            r = yt.playlistItems().list(
                part="contentDetails", playlistId=playlist_id, maxResults=50, pageToken=token
            ).execute()
        except HttpError as e:
            if e.resp.status == 404:
                return vids
            raise
        for it in r.get("items", []):
            vids.add(it["contentDetails"]["videoId"])
        token = r.get("nextPageToken")
        if not token:
            break
    return vids


def apply_api_postprocess(
    yt,
    playlist_id: str,
    lang: str,
    video_id: str,
    yt_title: str,
    yt_desc: str,
    tags: List[str],
    thumb_path: Path,
    srt_path: Path,
    existing_pl_vids: set,
    upload_captions: bool = False,
    skip_snippet_update: bool = False,
) -> dict:
    res = {"snippetUpdated": skip_snippet_update, "inPlaylist": False, "thumbnailSet": False, "captionSet": False}

    # 1. Update snippet with native language metadata (when uploaded via Studio UI)
    audio_lang = YT_AUDIO_LANG_FALLBACK.get(lang, lang)
    if not skip_snippet_update:
        for attempt in range(3):
            try:
                body = {
                    "id": video_id,
                    "snippet": {
                        "title": yt_title,
                        "description": yt_desc,
                        "tags": tags,
                        "categoryId": "1",
                        "defaultLanguage": audio_lang if attempt > 0 else lang,
                        "defaultAudioLanguage": audio_lang,
                    },
                }
                yt.videos().update(part="snippet", body=body).execute()
                res["snippetUpdated"] = True
                log(f"[{lang}] Updated snippet & language ({lang}/{audio_lang}) via API ({video_id})")
                break
            except HttpError as e:
                if attempt < 2:
                    time.sleep(3)
                    continue
                log(f"[{lang}] Warning: snippet update failed: {e}")

    # 2. Add to playlist
    if video_id in existing_pl_vids:
        res["inPlaylist"] = True
    else:
        try:
            yt.playlistItems().insert(
                part="snippet",
                body={
                    "snippet": {
                        "playlistId": playlist_id,
                        "resourceId": {"kind": "youtube#video", "videoId": video_id},
                    }
                },
            ).execute()
            existing_pl_vids.add(video_id)
            res["inPlaylist"] = True
            log(f"[{lang}] Added to playlist {playlist_id}")
        except HttpError as e:
            log(f"[{lang}] Warning: playlist insert failed: {e}")

    # 3. Custom 1280x720 thumbnail via API
    if thumb_path.is_file():
        try:
            yt.thumbnails().set(
                videoId=video_id,
                media_body=MediaFileUpload(str(thumb_path), mimetype="image/jpeg"),
            ).execute()
            res["thumbnailSet"] = True
            log(f"[{lang}] Set custom 1280x720 thumbnail via API ({video_id})")
        except HttpError as e:
            log(f"[{lang}] Warning: thumbnail set failed: {e}")

    # 4. Native SRT caption track via API (graceful skip if quotaExceeded)
    if upload_captions and srt_path.is_file():
        try:
            yt.captions().insert(
                part="snippet",
                body={
                    "snippet": {
                        "videoId": video_id,
                        "language": audio_lang,
                        "name": NATIVE_META[lang]["caption_name"],
                        "isDraft": False,
                    }
                },
                media_body=MediaFileUpload(str(srt_path), mimetype="application/octet-stream"),
            ).execute()
            res["captionSet"] = True
            log(f"[{lang}] Uploaded native SRT caption ({audio_lang}) via API ({video_id})")
        except HttpError as e:
            log(f"[{lang}] Caption skipped ({e.resp.status}): {e}")

    return res


def verify_live_uploads(yt, state: dict, playlist_id: str) -> List[Dict[str, Any]]:
    pl_vids = fetch_existing_playlist_videos(yt, playlist_id)
    report = []
    for lang in LANG_ORDER:
        info = state.get("languages", {}).get(lang, {})
        vid = info.get("videoId")
        if not vid:
            report.append({"lang": lang, "status": "PENDING"})
            continue
        r = yt.videos().list(part="snippet,status", id=vid).execute()
        items = r.get("items", [])
        if not items:
            report.append({"lang": lang, "videoId": vid, "status": "NOT_FOUND"})
            continue
        it = items[0]
        sn = it["snippet"]
        st = it["status"]
        entry = {
            "lang": lang,
            "videoId": vid,
            "url": f"https://youtu.be/{vid}",
            "title": sn.get("title"),
            "privacyStatus": st.get("privacyStatus"),
            "uploadStatus": st.get("uploadStatus"),
            "defaultLanguage": sn.get("defaultLanguage"),
            "defaultAudioLanguage": sn.get("defaultAudioLanguage"),
            "inPlaylist": vid in pl_vids,
        }
        report.append(entry)
        log(
            f"[LIVE {LANG_TAGS[lang]:7s}] {entry['url']} | privacy={entry['privacyStatus']} | "
            f"upload={entry['uploadStatus']} | lang={entry['defaultLanguage']}/{entry['defaultAudioLanguage']} | "
            f"playlist={entry['inPlaylist']}"
        )
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload 10-language Full Anime (EP01-EP40) to @snshero YouTube")
    parser.add_argument(
        "--langs",
        default=",".join(LANG_ORDER),
        help="Comma-separated languages in upload order (default: en,ko,ja,zh-Hans,zh-Hant,es,fr,de,id,vi)",
    )
    parser.add_argument("--api-upload", action="store_true", default=True, help="Use Data API v3 resumable upload (default)")
    parser.add_argument("--studio-upload", action="store_true", help="Use Playwright YouTube Studio UI instead of API upload")
    parser.add_argument("--captions", action="store_true", help="Also upload SRT captions via API (400 units/video)")
    parser.add_argument("--api-only-postprocess", action="store_true", help="Run API postprocess only for already-uploaded videoIds")
    parser.add_argument("--verify-only", action="store_true", help="Verify live YouTube status for uploaded videos")
    args = parser.parse_args()
    use_studio = bool(args.studio_upload)

    selected = [x.strip() for x in args.langs.split(",") if x.strip()]
    for lg in selected:
        if lg not in LANG_ORDER:
            print(f"ERROR: Unsupported language '{lg}'", file=sys.stderr)
            return 1

    chapters_meta = json.loads(CHAPTERS_PATH.read_text(encoding="utf-8"))
    state = load_state()
    yt = get_youtube_client()
    playlist_id = ensure_playlist(yt, state)

    if args.verify_only:
        verify_live_uploads(yt, state, playlist_id)
        return 0

    existing_pl_vids = fetch_existing_playlist_videos(yt, playlist_id)

    # Pre-generate all requested 1280x720 localized thumbnails
    thumbs = {lg: generate_feature_thumbnail(lg) for lg in selected}
    pending = [lg for lg in selected if not state.get("languages", {}).get(lg, {}).get("videoId")]

    if pending and not args.api_only_postprocess:
        if not use_studio:
            for lg in pending:
                tag = LANG_TAGS[lg]
                mp4_path = OUT_ROOT / f"SNSHero_Full_Anime_EP01_EP40_{tag}_16x9.mp4"
                srt_path = OUT_ROOT / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"
                if not mp4_path.is_file():
                    log(f"[{lg}] Missing MP4: {mp4_path}, skipping.")
                    continue

                yt_title, yt_desc, tags = build_native_metadata(lg, chapters_meta)
                vid, limit_hit = upload_via_api(yt, lg, mp4_path, yt_title, yt_desc, tags)
                if limit_hit:
                    log(f"Stopped at {lg} due to daily YouTube API quota/upload limit.")
                    break
                if not vid:
                    continue

                state.setdefault("languages", {})[lg] = {
                    "lang": lg,
                    "tag": tag,
                    "videoId": vid,
                    "url": f"https://youtu.be/{vid}",
                    "title": yt_title,
                    "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                }
                save_state(state)

                time.sleep(2.0)
                post = apply_api_postprocess(
                    yt,
                    playlist_id,
                    lg,
                    vid,
                    yt_title,
                    yt_desc,
                    tags,
                    thumbs[lg],
                    srt_path,
                    existing_pl_vids,
                    upload_captions=bool(args.captions),
                    skip_snippet_update=True,
                )
                state["languages"][lg].update(post)
                save_state(state)
        else:
            ensure_chrome_profile()
            with sync_playwright() as p:
                ctx = p.chromium.launch_persistent_context(
                    user_data_dir=str(TMP_CHROME_DIR),
                    channel="chrome",
                    headless=False,
                    args=[f"--profile-directory={PROFILE_DIR_NAME}", "--hide-crash-restore-bubble"],
                    viewport={"width": 1440, "height": 960},
                )
                page = ctx.pages[0] if ctx.pages else ctx.new_page()

                for lg in pending:
                    tag = LANG_TAGS[lg]
                    mp4_path = OUT_ROOT / f"SNSHero_Full_Anime_EP01_EP40_{tag}_16x9.mp4"
                    srt_path = OUT_ROOT / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"
                    if not mp4_path.is_file():
                        log(f"[{lg}] Missing MP4: {mp4_path}, skipping.")
                        continue

                    yt_title, yt_desc, tags = build_native_metadata(lg, chapters_meta)
                    vid, limit_or_auth = upload_via_studio(page, lg, mp4_path, thumbs[lg], yt_title, yt_desc)
                    if limit_or_auth:
                        log(f"Stopped at {lg} due to daily upload limit or auth gate.")
                        break
                    if not vid:
                        continue

                    state.setdefault("languages", {})[lg] = {
                        "lang": lg,
                        "tag": tag,
                        "videoId": vid,
                        "url": f"https://youtu.be/{vid}",
                        "title": yt_title,
                        "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                    }
                    save_state(state)

                    time.sleep(3.0)
                    post = apply_api_postprocess(
                        yt,
                        playlist_id,
                        lg,
                        vid,
                        yt_title,
                        yt_desc,
                        tags,
                        thumbs[lg],
                        srt_path,
                        existing_pl_vids,
                        upload_captions=bool(args.captions),
                        skip_snippet_update=False,
                    )
                    state["languages"][lg].update(post)
                    save_state(state)

                ctx.close()

    # Catch up API postprocess on any uploaded items if incomplete
    for lg in selected:
        info = state.get("languages", {}).get(lg)
        if not info or not info.get("videoId"):
            continue
        if not info.get("snippetUpdated") or not info.get("inPlaylist") or not info.get("thumbnailSet"):
            tag = LANG_TAGS[lg]
            srt_path = OUT_ROOT / f"SNSHero_Full_Anime_EP01_EP40_{tag}.srt"
            yt_title, yt_desc, tags = build_native_metadata(lg, chapters_meta)
            post = apply_api_postprocess(
                yt,
                playlist_id,
                lg,
                info["videoId"],
                yt_title,
                yt_desc,
                tags,
                thumbs[lg],
                srt_path,
                existing_pl_vids,
                upload_captions=bool(args.captions),
                skip_snippet_update=bool(info.get("snippetUpdated")),
            )
            info.update(post)
            save_state(state)

    verify_live_uploads(yt, state, playlist_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
