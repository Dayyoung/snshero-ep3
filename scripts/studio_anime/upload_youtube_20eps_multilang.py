#!/usr/bin/env python3
"""
SNSHero Studio Anime (EP01–EP20) 10-Language YouTube Uploader & Playlist Manager
--------------------------------------------------------------------------------
1. Creates (or reuses) a dedicated 10-language localized YouTube Playlist on @snshero
   (`UCA6QmKiPstbiyBUHtnSMxyA`) via YouTube Data API v3 OAuth (`token.json`).
2. Generates 1280x720 custom cover thumbnails from `public/webtoon-assets/episode_XX/scene_00.webp`.
3. Uploads EP01..EP20 16:9 Studio Anime MP4s via YouTube Studio (`Profile 6`) to avoid the
   1,600-unit/video API daily upload cap, setting title, 10-language description, custom thumbnail,
   NOT_MFK, and PUBLIC visibility.
4. Immediately after each upload, calls YouTube Data API v3 (`token.json`) to:
   - Apply official 10-language `localizations` (en, ko, ja, zh-Hans, zh-Hant, es, fr, de, id, vi)
     so viewers worldwide see titles & descriptions in their own YouTube language automatically.
   - Add the video to the official playlist in exact EP01 -> EP20 order.
   - Optionally attach EN & KO `.srt` captions (via API if quota allows, graceful skip on quota).
5. Persists resumable state in `output/studio_anime/youtube_20eps_upload_state.json`.
"""

import argparse
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import certifi
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from PIL import Image
from playwright.sync_api import sync_playwright

os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())

ROOT = Path("/Users/dayyoung/project/snshero")
OUT_ROOT = ROOT / "output" / "studio_anime"
THUMB_DIR = OUT_ROOT / "thumbs"
STATE_PATH = OUT_ROOT / "youtube_20eps_upload_state.json"

TOKEN_PATH = Path("/Users/dayyoung/.gemini/config/snshero_youtube/token.json")
CHANNEL_ID = "UCA6QmKiPstbiyBUHtnSMxyA"
TMP_CHROME_DIR = Path("/tmp/yt_studio_snshero_anime_profile6")
PROFILE_DIR_NAME = "Profile 6"

PLAYLIST_TITLE_DEFAULT = "SNSHero: Kadan's Journey | Official Studio Anime (EP01–EP20)"
PLAYLIST_DESC_DEFAULT = (
    "Official dark-fantasy Studio Anime series of SNSHero: Kadan's Journey (Episodes 01–20).\n"
    "Dynamic cel-shaded action, voice-acted English episodes with official 10-language metadata.\n\n"
    "🎁 FREE PLAYER REWARDS — Claim free starter card packs, daily free summons, and collect 382 tactical cards with zero download!\n"
    "⚔️ Play the anime's story battles right now in your browser: https://snshero.com"
)

# 10-language localized playlist metadata
PLAYLIST_LOCALIZATIONS: Dict[str, Dict[str, str]] = {
    "en": {
        "title": PLAYLIST_TITLE_DEFAULT,
        "description": PLAYLIST_DESC_DEFAULT,
    },
    "ko": {
        "title": "눈히어로: 카단의 여정 | 공식 스튜디오 애니메이션 (1화~20화)",
        "description": "『눈히어로: 카단의 여정』 공식 다크 판타지 스튜디오 애니메이션 1화~20화 정주행 재생목록입니다.\n🎁 지금 접속 시 무료 스타터 카드팩 · 매일 무료 소환 · 382종 전략 카드 수집 보상 즉시 지급!\n⚔️ 무설치 웹 카드 RPG & 40화 보스전 바로 플레이: https://snshero.com",
    },
    "ja": {
        "title": "SNSHero：カダンの旅｜公式スタジオアニメ（第1話〜第20話）",
        "description": "ダークファンタジー『SNSHero：カダンの旅』公式アニメーション第1話〜第20話。\n🎁 今すぐプレイで無料スターターパック＆毎日無料召喚・382枚のカード報酬をゲット！\n⚔️ インストール不要・無料ブラウザカードRPG：https://snshero.com",
    },
    "zh-Hans": {
        "title": "SNSHero：卡丹的旅程｜官方工作室动画（第1集–第20集）",
        "description": "暗黑奇幻《SNSHero：卡丹的旅程》官方动画第1集至第20集完整合集。\n🎁 立即畅玩领取免费新手卡包、每日免费召唤与382张策略卡牌奖励！\n⚔️ 免安装网页卡牌RPG立即开战：https://snshero.com",
    },
    "zh-Hant": {
        "title": "SNSHero：卡丹的旅程｜官方工作室動畫（第1集–第20集）",
        "description": "暗黑奇幻《SNSHero：卡丹的旅程》官方動畫第1集至第20集完整合集。\n🎁 立即暢玩領取免費新手卡包、每日免費召喚與382張策略卡牌獎勵！\n⚔️ 免安裝網頁卡牌RPG立即開戰：https://snshero.com",
    },
    "es": {
        "title": "SNSHero: El Viaje de Kadan | Anime Oficial de Estudio (EP01–EP20)",
        "description": "Serie oficial de anime de fantasía oscura SNSHero: El Viaje de Kadan (Episodios 1 al 20).\n🎁 ¡RECOMPENSAS GRATIS! Reclama sobres iniciales, invocaciones diarias gratis y 382 cartas tácticas.\n⚔️ Juega gratis sin descargas en tu navegador: https://snshero.com",
    },
    "fr": {
        "title": "SNSHero : Le Voyage de Kadan | Anime Officiel de Studio (EP01–EP20)",
        "description": "Série animée officielle de dark fantasy SNSHero : Le Voyage de Kadan (Épisodes 1 à 20).\n🎁 RÉCOMPENSES GRATUITES : packs de départ offerts, invocations gratuites chaque jour et 382 cartes tactiques !\n⚔️ Jouez gratuitement sans téléchargement : https://snshero.com",
    },
    "de": {
        "title": "SNSHero: Kadans Reise | Offizielle Studio-Anime-Serie (EP01–EP20)",
        "description": "Offizielle Dark-Fantasy-Anime-Serie SNSHero: Kadans Reise (Folgen 1–20).\n🎁 GRATIS-BELOHNUNGEN: Hol dir kostenlose Starter-Kartenpacks, tägliche Gratis-Beschwörungen & 382 Karten!\n⚔️ Jetzt kostenlos ohne Download im Browser spielen: https://snshero.com",
    },
    "id": {
        "title": "SNSHero: Perjalanan Kadan | Anime Studio Resmi (EP01–EP20)",
        "description": "Serial anime fantasi gelap resmi SNSHero: Perjalanan Kadan (Episode 1–20).\n🎁 HADIAH GRATIS: Klaim paket kartu pemula, summon gratis harian, & koleksi 382 kartu taktis!\n⚔️ Mainkan langsung di browser tanpa install: https://snshero.com",
    },
    "vi": {
        "title": "SNSHero: Hành Trình Của Kadan | Anime Studio Chính Thức (Tập 01–20)",
        "description": "Loạt phim hoạt hình giả tưởng đen tối chính thức SNSHero: Hành Trình Của Kadan (Tập 1–20).\n🎁 QUÀ TẶNG MIỄN PHÍ: Nhận gói thẻ tân thủ, triệu hồi miễn phí mỗi ngày & sưu tập 382 thẻ chiến thuật!\n⚔️ Chơi ngay trên trình duyệt không cần tải: https://snshero.com",
    },
}

# 20 Episode titles across all 10 languages
EP_TITLES_10LANG: Dict[int, Dict[str, str]] = {
    1: {
        "en": "Two Vows Beneath the Blizzard",
        "ko": "눈보라 아래 두 개의 맹세",
        "ja": "吹雪の下の二つの誓い",
        "zh-Hans": "暴风雪下的两个誓言",
        "zh-Hant": "暴風雪下的兩個誓言",
        "es": "Dos Juramentos Bajo la Ventisca",
        "fr": "Deux Serments Sous le Blizzard",
        "de": "Zwei Schwüre im Schneesturm",
        "id": "Dua Sumpah di Bawah Badai Salju",
        "vi": "Hai Lời Thề Dưới Bão Tuyết",
    },
    2: {
        "en": "Oath of the Seven Pursuers",
        "ko": "일곱 추격자의 맹세",
        "ja": "七人の追跡者の誓い",
        "zh-Hans": "七位追击者的誓言",
        "zh-Hant": "七位追擊者的誓言",
        "es": "El Juramento de los Siete Perseguidores",
        "fr": "Le Serment des Sept Poursuivants",
        "de": "Der Schwur der Sieben Verfolger",
        "id": "Sumpah Tujuh Pengejar",
        "vi": "Lời Thề Của Bảy Kẻ Truy Đuổi",
    },
    3: {
        "en": "Mistfall Cliff",
        "ko": "안개폭포 절벽",
        "ja": "霧降りの断崖",
        "zh-Hans": "雾落悬崖",
        "zh-Hant": "霧落懸崖",
        "es": "El Acantilado de la Niebla",
        "fr": "La Falaise de Brume",
        "de": "Die Nebelfall-Klippe",
        "id": "Tebing Air Terjun Kabut",
        "vi": "Vách Đá Thác Sương",
    },
    4: {
        "en": "The Child Raised in the Wastes",
        "ko": "황야에서 자란 아이",
        "ja": "荒野に育った子供",
        "zh-Hans": "荒原中长大的孩子",
        "zh-Hant": "荒原中長大的孩子",
        "es": "El Niño Criado en los Yermos",
        "fr": "L'Enfant Élevé dans les Terres Désolées",
        "de": "Das Kind der Einöde",
        "id": "Anak yang Dibesarkan di Gurun Es",
        "vi": "Đứa Trẻ Lớn Lên Nơi Hoang Mạc",
    },
    5: {
        "en": "Phantom in the Downpour",
        "ko": "폭우 속의 환영",
        "ja": "豪雨の中の幻影",
        "zh-Hans": "暴雨中的幻影",
        "zh-Hant": "暴雨中的幻影",
        "es": "Fantasma en el Aguacero",
        "fr": "Fantôme sous le Déluge",
        "de": "Phantom im Wolkenbruch",
        "id": "Bayangan di Tengah Hujan Deras",
        "vi": "Bóng Ma Trong Cơn Mưa Tầm Tã",
    },
    6: {
        "en": "The Art of Breathing Stars",
        "ko": "별을 들이마시는 호흡법",
        "ja": "星を呼吸する秘術",
        "zh-Hans": "星辰呼吸之术",
        "zh-Hant": "星辰呼吸之術",
        "es": "El Arte de Respirar Estrellas",
        "fr": "L'Art de Respirer les Étoiles",
        "de": "Die Kunst des Sternenatems",
        "id": "Seni Pernapasan Bintang",
        "vi": "Bí Thuật Hô Hấp Tinh Tú",
    },
    7: {
        "en": "The Traitors' Camp",
        "ko": "배신자들의 진영",
        "ja": "裏切り者たちの陣営",
        "zh-Hans": "背叛者营地",
        "zh-Hant": "背叛者營地",
        "es": "El Campamento de los Traidores",
        "fr": "Le Camp des Traîtres",
        "de": "Das Lager der Verräter",
        "id": "Perkemahan Para Pengkhianat",
        "vi": "Doanh Trại Của Những Kẻ Phản Bội",
    },
    8: {
        "en": "Rider of the Crimson Mane",
        "ko": "적갈기의 기수",
        "ja": "紅蓮の鬣の騎手",
        "zh-Hans": "赤鬃骑士",
        "zh-Hant": "赤鬃騎士",
        "es": "El Jinete de la Crin Carmesí",
        "fr": "Le Cavalier à la Crinière Pourpre",
        "de": "Der Reiter der Purpurmähne",
        "id": "Penunggang Surai Merah",
        "vi": "Kỵ Sĩ Bờm Đỏ",
    },
    9: {
        "en": "Wind in Beggar's Clothes",
        "ko": "거지 옷을 입은 바람",
        "ja": "ぼろ衣の風",
        "zh-Hans": "乞丐衣中的疾风",
        "zh-Hant": "乞丐衣中的疾風",
        "es": "Viento en Ropas de Mendigo",
        "fr": "Le Vent en Haillons",
        "de": "Wind in Bettlerkleidern",
        "id": "Angin Berbalut Pakaian Pengemis",
        "vi": "Ngọn Gió Trong Áo Hành Khất",
    },
    10: {
        "en": "Prisoner of the Flame Court",
        "ko": "화염 궁정의 죄수",
        "ja": "炎の宮廷の囚人",
        "zh-Hans": "火焰宫廷的囚徒",
        "zh-Hant": "火焰宮廷的囚徒",
        "es": "Prisionero de la Corte de Llamas",
        "fr": "Prisonnier de la Cour des Flammes",
        "de": "Gefangener des Flammenhofs",
        "id": "Tawanan Istana Api",
        "vi": "Tù Nhân Của Hỏa Triều",
    },
    11: {
        "en": "The Dagger That Wakes Memory",
        "ko": "기억을 깨우는 단검",
        "ja": "記憶を呼び覚ます短剣",
        "zh-Hans": "唤醒记忆的匕首",
        "zh-Hant": "喚醒記憶的匕首",
        "es": "La Daga que Despierta la Memoria",
        "fr": "La Dague qui Éveille la Mémoire",
        "de": "Der Dolch der Erinnerungen",
        "id": "Belati Pembangkit Ingatan",
        "vi": "Con Dao Đánh Thức Ký Ức",
    },
    12: {
        "en": "Spring Between Two Graves",
        "ko": "두 무덤 사이의 샘",
        "ja": "二つの墓の間の泉",
        "zh-Hans": "双墓之间的泉水",
        "zh-Hant": "雙墓之間的泉水",
        "es": "Manantial Entre Dos Tumbas",
        "fr": "La Source Entre Deux Tombes",
        "de": "Quelle zwischen zwei Gräbern",
        "id": "Mata Air di Antara Dua Makam",
        "vi": "Dòng Suối Giữa Hai Ngôi Mộ",
    },
    13: {
        "en": "Master of the Jade Staff",
        "ko": "비취 지팡이의 주인",
        "ja": "翡翠の杖の達人",
        "zh-Hans": "翡翠法杖大师",
        "zh-Hant": "翡翠法杖大師",
        "es": "El Maestro del Bastón de Jade",
        "fr": "Le Maître du Bâton de Jade",
        "de": "Meister des Jadestabs",
        "id": "Master Tongkat Giok",
        "vi": "Bậc Thầy Quyền Trượng Ngọc Bích",
    },
    14: {
        "en": "Guests of the Mist Lake",
        "ko": "안개 호수의 손님들",
        "ja": "霧の湖の客人たち",
        "zh-Hans": "迷雾湖的访客",
        "zh-Hant": "迷霧湖的訪客",
        "es": "Huéspedes del Lago de Niebla",
        "fr": "Les Hôtes du Lac de Brume",
        "de": "Gäste des Nebelsees",
        "id": "Tamu Danau Kabut",
        "vi": "Những Vị Khách Của Hồ Sương Mù",
    },
    15: {
        "en": "Night of Serpent and Lion",
        "ko": "뱀과 사자의 밤",
        "ja": "蛇と獅子の夜",
        "zh-Hans": "蛇与狮之夜",
        "zh-Hant": "蛇與獅之夜",
        "es": "Noche de Serpiente y León",
        "fr": "La Nuit du Serpent et du Lion",
        "de": "Nacht von Schlange und Löwe",
        "id": "Malam Ular dan Singa",
        "vi": "Đêm Của Rắn Và Sư Tử",
    },
    16: {
        "en": "Brothers Before the Ruins",
        "ko": "폐허 앞의 형제들",
        "ja": "廃墟の前の兄弟",
        "zh-Hans": "废墟前的兄弟",
        "zh-Hant": "廢墟前的兄弟",
        "es": "Hermanos Ante las Ruinas",
        "fr": "Frères Devant les Ruines",
        "de": "Brüder vor den Ruinen",
        "id": "Saudara di Hadapan Reruntuhan",
        "vi": "Huynh Đệ Trước Tàn Tích",
    },
    17: {
        "en": "Invitation to the Wind Isle",
        "ko": "바람 섬의 초대",
        "ja": "風の島への招待",
        "zh-Hans": "风之岛的邀请",
        "zh-Hant": "風之島的邀請",
        "es": "Invitación a la Isla del Viento",
        "fr": "Invitation sur l'Île du Vent",
        "de": "Einladung zur Windinsel",
        "id": "Undangan ke Pulau Angin",
        "vi": "Lời Mời Đến Đảo Gió",
    },
    18: {
        "en": "Secret of the Black Sanctum",
        "ko": "검은 성소의 비밀",
        "ja": "黒き聖域の秘密",
        "zh-Hans": "黑色圣殿的秘密",
        "zh-Hant": "黑色聖殿的秘密",
        "es": "El Secreto del Santuario Negro",
        "fr": "Le Secret du Sanctuaire Noir",
        "de": "Das Geheimnis des Schwarzen Heiligtums",
        "id": "Rahasia Kuil Hitam",
        "vi": "Bí Mật Của Hắc Thánh Điện",
    },
    19: {
        "en": "Three Trials",
        "ko": "세 가지 시련",
        "ja": "三つの試練",
        "zh-Hans": "三重试炼",
        "zh-Hant": "三重試煉",
        "es": "Las Tres Pruebas",
        "fr": "Les Trois Épreuves",
        "de": "Drei Prüfungen",
        "id": "Tiga Ujian",
        "vi": "Ba Thử Thách",
    },
    20: {
        "en": "The Wave That Swallowed the Flower Ship",
        "ko": "꽃배를 삼킨 파도",
        "ja": "花船を呑み込んだ大波",
        "zh-Hans": "吞噬花船的巨浪",
        "zh-Hant": "吞噬花船的巨浪",
        "es": "La Ola que Tragó el Barco de Flores",
        "fr": "La Vague qui Engloutit le Navire des Fleurs",
        "de": "Die Welle, die das Blumenschiff verschlang",
        "id": "Ombak yang Menelan Kapal Bunga",
        "vi": "Con Sóng Nuốt Chửng Thuyền Hoa",
    },
}

LANG_DESC_TEMPLATES: Dict[str, str] = {
    "en": (
        "SNSHero: Kadan's Journey — Official Studio Anime Episode {ep:02d}: {title}\n\n"
        "{summary_en}\n\n"
        "🎁 FREE GAME REWARDS: Instant starter card packs, daily free summons, 382 collectible tactical cards & 40 story boss battles!\n"
        "⚔️ Play the anime's battles FREE right now (no install): https://snshero.com"
    ),
    "ko": (
        "『눈히어로: 카단의 여정』 공식 스튜디오 애니메이션 제{ep:02d}화 — {title}\n\n"
        "🎁 게임 플레이 보상: 지금 바로 접속하면 무료 스타터 카드팩 · 매일 무료 소환 · 382종 전략 카드 수집 & 40화 스토리 보스전 보상을 즉시 받을 수 있습니다!\n"
        "⚔️ 애니메이션 속 명장면을 지금 무료로 직접 플레이하세요 (무설치): https://snshero.com"
    ),
    "ja": (
        "『SNSHero：カダンの旅』公式スタジオアニメ 第{ep:02d}話 — {title}\n\n"
        "🎁 プレイ特典：今すぐ参加で無料スターターパック・毎日無料召喚・382枚のカード収集＆全40話ボス戦報酬を即獲得！\n"
        "⚔️ アニメの名場面をブラウザで今すぐ無料プレイ（登録不要）：https://snshero.com"
    ),
    "zh-Hans": (
        "《SNSHero：卡丹的旅程》官方工作室动画 第{ep:02d}集 — {title}\n\n"
        "🎁 游戏畅玩奖励：立即进入即可免费领取新手卡包、每日免费召唤、382张策略卡牌与40话剧情Boss战丰厚奖励！\n"
        "⚔️ 亲自体验动画热血战斗，免安装免费开玩：https://snshero.com"
    ),
    "zh-Hant": (
        "《SNSHero：卡丹的旅程》官方工作室動畫 第{ep:02d}集 — {title}\n\n"
        "🎁 遊戲暢玩獎勵：立即進入即可免費領取新手卡包、每日免費召喚、382張策略卡牌與40話劇情Boss戰豐厚獎勵！\n"
        "⚔️ 親自體驗動畫熱血戰鬥，免安裝免費開玩：https://snshero.com"
    ),
    "es": (
        "SNSHero: El Viaje de Kadan — Anime Oficial Episodio {ep:02d}: {title}\n\n"
        "🎁 RECOMPENSAS GRATIS: Reclama sobres de inicio, invocaciones diarias gratuitas, 382 cartas coleccionables y recompensas de 40 jefes de historia.\n"
        "⚔️ ¡Juega ahora las batallas del anime gratis en tu navegador!: https://snshero.com"
    ),
    "fr": (
        "SNSHero : Le Voyage de Kadan — Anime Officiel Épisode {ep:02d} : {title}\n\n"
        "🎁 RÉCOMPENSES GRATUITES : packs de démarrage offerts, invocations gratuites quotidiennes, 382 cartes tactiques et 40 combats de boss !\n"
        "⚔️ Jouez gratuitement aux batailles de l'anime sans téléchargement : https://snshero.com"
    ),
    "de": (
        "SNSHero: Kadans Reise — Offizieller Anime Folge {ep:02d}: {title}\n\n"
        "🎁 KOSTENLOSE SPIELBELOHNUNGEN: Gratis Starter-Packs, tägliche kostenlose Beschwörungen, 382 Sammelkarten & 40 Story-Bosskämpfe!\n"
        "⚔️ Spiele die Schlachten aus dem Anime jetzt kostenlos im Browser: https://snshero.com"
    ),
    "id": (
        "SNSHero: Perjalanan Kadan — Anime Resmi Episode {ep:02d}: {title}\n\n"
        "🎁 HADIAH MAIN GRATIS: Klaim paket kartu pemula, summon gratis setiap hari, 382 kartu taktis & hadiah 40 bos cerita!\n"
        "⚔️ Mainkan pertarungan anime ini gratis langsung di browser: https://snshero.com"
    ),
    "vi": (
        "SNSHero: Hành Trình Của Kadan — Anime Chính Thức Tập {ep:02d}: {title}\n\n"
        "🎁 QUÀ TẶNG CHƠI GAME: Nhận ngay gói thẻ tân thủ miễn phí, triệu hồi miễn phí mỗi ngày, 382 thẻ bài chiến thuật & thưởng 40 màn boss!\n"
        "⚔️ Tham chiến ngay các trận đánh trong anime miễn phí trên trình duyệt: https://snshero.com"
    ),
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
    return {"playlistId": None, "episodes": {}}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_thumbnails(start_ep: int, end_ep: int) -> None:
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    for ep in range(start_ep, end_ep + 1):
        dst = THUMB_DIR / f"ep{ep:02d}_thumb.jpg"
        if dst.exists() and dst.stat().st_size > 15000:
            continue
        src = ROOT / f"public/webtoon-assets/episode_{ep:02d}/scene_00.webp"
        if not src.exists():
            src = OUT_ROOT / f"ep{ep:02d}_en/keyframes/EP{ep:02d}-CUT01_keyframe.png"
        with Image.open(src) as im:
            im.convert("RGB").resize((1280, 720), Image.Resampling.LANCZOS).save(dst, "JPEG", quality=92)


def ensure_playlist(yt, state: dict) -> str:
    if state.get("playlistId"):
        pl_id = state["playlistId"]
        try:
            chk = yt.playlists().list(part="snippet,status", id=pl_id).execute()
            if chk.get("items"):
                log(f"Reusing existing playlist: {pl_id}")
                return pl_id
        except Exception:
            pass

    # Search existing playlists on channel to prevent duplicates
    resp = yt.playlists().list(part="snippet", channelId=CHANNEL_ID, maxResults=50).execute()
    for it in resp.get("items", []):
        if it["snippet"].get("title") == PLAYLIST_TITLE_DEFAULT:
            pl_id = it["id"]
            state["playlistId"] = pl_id
            save_state(state)
            log(f"Found existing matching playlist: {pl_id}")
            return pl_id

    # Create new playlist with 10-language localizations
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
    log(f"Created new 10-language playlist: {pl_id} (https://www.youtube.com/playlist?list={pl_id})")
    return pl_id


def build_episode_metadata(ep: int) -> Tuple[str, str, Dict[str, Dict[str, str]], List[str]]:
    sb = json.loads((OUT_ROOT / f"ep{ep:02d}_en/storyboard_ep{ep:02d}_en.json").read_text(encoding="utf-8"))
    summary_en = sb.get("episodeSummaryEn", "").strip()
    titles = EP_TITLES_10LANG[ep]

    default_title = f"[SNSHero Anime EP{ep:02d}] {titles['en']} | Kadan's Journey"
    if len(default_title) > 100:
        default_title = default_title[:97] + "..."

    global_lines = [
        f"• 🇰🇷 [한국어] 눈히어로 제{ep:02d}화: {titles['ko']}",
        f"• 🇯🇵 [日本語] 第{ep:02d}話: {titles['ja']}",
        f"• 🇨🇳 [简体中文] 第{ep:02d}集: {titles['zh-Hans']}",
        f"• 🇹🇼 [繁體中文] 第{ep:02d}集: {titles['zh-Hant']}",
        f"• 🇪🇸 [Español] Episodio {ep:02d}: {titles['es']}",
        f"• 🇫🇷 [Français] Épisode {ep:02d}: {titles['fr']}",
        f"• 🇩🇪 [Deutsch] Folge {ep:02d}: {titles['de']}",
        f"• 🇮🇩 [Indonesia] Episode {ep:02d}: {titles['id']}",
        f"• 🇻🇳 [Tiếng Việt] Tập {ep:02d}: {titles['vi']}",
    ]

    default_desc = (
        f"🎬 SNSHero: Kadan's Journey — Official Studio Anime Episode {ep:02d}: {titles['en']}\n\n"
        f"{summary_en}\n\n"
        f"🎁 FREE PLAYER REWARDS — Claim free starter card packs, daily free summons, and collect 382 tactical cards with zero download!\n"
        f"⚔️ Play Episode {ep:02d}'s story battles FREE right now in your browser: https://snshero.com\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🌍 10-LANGUAGE GLOBAL EDITION (Free Rewards & Browser Play: https://snshero.com)\n"
        + "\n".join(global_lines)
        + "\n\n#SNSHero #KadansJourney #DarkFantasyAnime #FreeCardGame #Anime #눈히어로 #CardRPG"
    )

    localizations: Dict[str, Dict[str, str]] = {}
    for lang, loc_title in titles.items():
        if lang == "en":
            full_t = default_title
        elif lang == "ko":
            full_t = f"[눈히어로 애니 {ep:02d}화] {loc_title} | 카단의 여정"
        elif lang == "ja":
            full_t = f"[SNSHero アニメ 第{ep:02d}話] {loc_title}｜カダンの旅"
        elif lang == "zh-Hans":
            full_t = f"[SNSHero 动画 第{ep:02d}集] {loc_title}｜卡丹的旅程"
        elif lang == "zh-Hant":
            full_t = f"[SNSHero 動畫 第{ep:02d}集] {loc_title}｜卡丹的旅程"
        elif lang == "es":
            full_t = f"[SNSHero Anime EP{ep:02d}] {loc_title} | El Viaje de Kadan"
        elif lang == "fr":
            full_t = f"[SNSHero Anime EP{ep:02d}] {loc_title} | Le Voyage de Kadan"
        elif lang == "de":
            full_t = f"[SNSHero Anime EP{ep:02d}] {loc_title} | Kadans Reise"
        elif lang == "id":
            full_t = f"[SNSHero Anime EP{ep:02d}] {loc_title} | Perjalanan Kadan"
        else:
            full_t = f"[SNSHero Anime Tập {ep:02d}] {loc_title} | Hành Trình Của Kadan"

        if len(full_t) > 100:
            full_t = full_t[:97] + "..."

        loc_desc = LANG_DESC_TEMPLATES[lang].format(ep=ep, title=loc_title, summary_en=summary_en)
        localizations[lang] = {"title": full_t, "description": loc_desc}

    tags = [
        "SNSHero", "Kadan's Journey", "Dark Fantasy Anime", "Fantasy Anime",
        f"EP{ep:02d}", titles["en"], titles["ko"], "눈히어로", "AI Anime", "Card RPG",
    ]
    return default_title, default_desc, localizations, tags


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


def upload_via_studio(page, ep: int, mp4_path: Path, thumb_path: Path, yt_title: str, yt_desc: str) -> Tuple[Optional[str], bool]:
    upload_url = f"https://studio.youtube.com/channel/{CHANNEL_ID}/content?d=ud"
    log(f"[EP{ep:02d}] Opening YouTube Studio upload dialog for {mp4_path.name} ...")
    page.goto(upload_url, wait_until="domcontentloaded", timeout=45000)
    time.sleep(3.5)

    # Skip interstitial if present
    try:
        skip_btn = page.locator(
            'a:has-text("YOUTUBE 스튜디오로 건너뛰기"), a:has-text("Skip to YouTube Studio")'
        ).first
        if skip_btn.count() > 0 and skip_btn.is_visible():
            skip_btn.click(force=True)
            time.sleep(3.0)
    except Exception:
        pass

    # Check if login gate appeared
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
    for _ in range(60):
        time.sleep(1.0)
        body_txt = dialog.inner_text() if dialog.count() > 0 else page.inner_text("body")
        if "일일 업로드 한도" in body_txt or "Daily upload limit" in body_txt:
            log(f"[EP{ep:02d}] Daily upload limit reached on YouTube Studio!")
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
        log(f"[EP{ep:02d}] Could not detect assigned video_id.")
        return None, False

    log(f"[EP{ep:02d}] Assigned Video ID: {video_id}")

    title_box = dialog.locator("#title-textarea #textbox").first
    title_box.wait_for(state="visible", timeout=20000)
    title_box.click(force=True)
    page.keyboard.press("Meta+A")
    page.keyboard.press("Backspace")
    title_box.fill(yt_title)
    time.sleep(0.3)

    desc_box = dialog.locator("#description-textarea #textbox").first
    if desc_box.count() > 0:
        desc_box.click(force=True)
        page.keyboard.press("Meta+A")
        page.keyboard.press("Backspace")
        desc_box.fill(yt_desc)
        time.sleep(0.3)

    if thumb_path.exists():
        thumb_in = dialog.locator("input#file-loader").first
        if thumb_in.count() > 0:
            thumb_in.set_input_files(str(thumb_path))
            time.sleep(1.2)

    not_mfk = dialog.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first
    not_mfk.scroll_into_view_if_needed()
    not_mfk.click(force=True)
    time.sleep(0.4)
    if not_mfk.get_attribute("aria-checked") != "true":
        not_mfk.click(force=True)
        time.sleep(0.4)

    # Click Next 3 times to reach Visibility step
    for step_idx in range(3):
        nxt = dialog.locator("#next-button").first
        nxt.click(force=True)
        time.sleep(1.0)

    # Select Public visibility
    pub_radio = dialog.locator('tp-yt-paper-radio-button[name="PUBLIC"]').first
    pub_radio.wait_for(state="visible", timeout=15000)
    pub_radio.click(force=True)
    time.sleep(0.5)

    # Wait until upload reaches 100% / processing started before clicking Publish
    for _ in range(180):
        status_txt = dialog.locator(".progress-label").first.inner_text() if dialog.locator(".progress-label").count() > 0 else ""
        if any(k in status_txt for k in ("처리", "Processing", "완료", "complete", "Checks", "검사")):
            break
        if "%" in status_txt and "100%" in status_txt:
            break
        time.sleep(1.5)

    done_btn = dialog.locator("#done-button").first
    done_btn.click(force=True)
    time.sleep(4.0)

    # Close post-publish dialog if visible
    try:
        close_btn = page.locator("ytcp-video-share-dialog #close-button, ytcp-uploads-still-processing-dialog #close-button").first
        if close_btn.count() > 0 and close_btn.is_visible():
            close_btn.click(force=True)
            time.sleep(1.0)
    except Exception:
        pass

    log(f"[EP{ep:02d}] Published on YouTube Studio: https://youtu.be/{video_id}")
    return video_id, False


def apply_api_postprocess(
    yt,
    playlist_id: str,
    ep: int,
    video_id: str,
    yt_title: str,
    yt_desc: str,
    localizations: Dict[str, Dict[str, str]],
    tags: List[str],
    existing_pl_vids: set,
    upload_captions: bool = False,
) -> dict:
    res = {"localized": False, "inPlaylist": False, "captions": []}

    # 1. Apply 10-language localizations + defaultLanguage="en" + tags + categoryId="1" (Film & Animation)
    for attempt in range(3):
        try:
            body = {
                "id": video_id,
                "snippet": {
                    "title": yt_title,
                    "description": yt_desc,
                    "tags": tags,
                    "categoryId": "1",
                    "defaultLanguage": "en",
                    "defaultAudioLanguage": "en",
                },
                "localizations": localizations,
            }
            yt.videos().update(part="snippet,localizations", body=body).execute()
            res["localized"] = True
            log(f"[EP{ep:02d}] Applied 10-language official localizations via API ({video_id})")
            break
        except HttpError as e:
            if e.resp.status == 404 and attempt < 2:
                time.sleep(4)
                continue
            log(f"[EP{ep:02d}] Warning: localizations update failed: {e}")
            break

    # 2. Add to official playlist in order
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
            log(f"[EP{ep:02d}] Added to playlist {playlist_id}")
        except HttpError as e:
            log(f"[EP{ep:02d}] Warning: playlist insert failed: {e}")

    # 3. Optional EN & KO captions via API (only if requested; costs 400 units/track)
    if upload_captions:
        for lang_code, name, fname in [
            ("en", "English", f"SNSHero_StudioAnime_EP{ep:02d}_EN.srt"),
            ("ko", "Korean", f"SNSHero_StudioAnime_EP{ep:02d}_KO.srt"),
        ]:
            srt_path = OUT_ROOT / f"ep{ep:02d}_en" / fname
            if not srt_path.exists():
                continue
            try:
                yt.captions().insert(
                    part="snippet",
                    body={
                        "snippet": {
                            "videoId": video_id,
                            "language": lang_code,
                            "name": name,
                            "isDraft": False,
                        }
                    },
                    media_body=MediaFileUpload(str(srt_path), mimetype="application/octet-stream"),
                ).execute()
                res["captions"].append(lang_code)
            except HttpError as e:
                log(f"[EP{ep:02d}] Caption ({lang_code}) skipped: {e.resp.status}")
                if e.resp.status == 403 and "quotaExceeded" in str(e):
                    break

    return res


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


def main():
    parser = argparse.ArgumentParser(description="Upload EP01-EP20 SNSHero Studio Anime with 10-language localizations & playlist")
    parser.add_argument("--start", type=int, default=1)
    parser.add_argument("--end", type=int, default=20)
    parser.add_argument("--captions", action="store_true", help="Also upload EN/KO SRT captions via API (400 units each)")
    parser.add_argument("--api-only-postprocess", action="store_true", help="Skip browser upload and run API localizations/playlist only for already-uploaded IDs")
    args = parser.parse_args()

    state = load_state()
    ensure_thumbnails(args.start, args.end)
    yt = get_youtube_client()
    playlist_id = ensure_playlist(yt, state)
    existing_pl_vids = fetch_existing_playlist_videos(yt, playlist_id)

    pending_eps = []
    for ep in range(args.start, args.end + 1):
        ep_key = f"{ep:02d}"
        info = state["episodes"].get(ep_key, {})
        if not info.get("videoId"):
            pending_eps.append(ep)

    if pending_eps and not args.api_only_postprocess:
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

            for ep in pending_eps:
                ep_key = f"{ep:02d}"
                mp4_path = OUT_ROOT / f"ep{ep:02d}_en/SNSHero_StudioAnime_EP{ep:02d}_EN_16x9.mp4"
                thumb_path = THUMB_DIR / f"ep{ep:02d}_thumb.jpg"
                yt_title, yt_desc, localizations, tags = build_episode_metadata(ep)

                vid, limit_or_auth = upload_via_studio(page, ep, mp4_path, thumb_path, yt_title, yt_desc)
                if limit_or_auth:
                    log(f"Stopped at EP{ep:02d} due to daily limit or auth gate.")
                    break
                if not vid:
                    continue

                state["episodes"][ep_key] = {
                    "episode": ep,
                    "videoId": vid,
                    "url": f"https://youtu.be/{vid}",
                    "title": yt_title,
                    "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                }
                save_state(state)

                # Immediately apply 10-language localizations & add to playlist
                time.sleep(2.5)
                post = apply_api_postprocess(
                    yt, playlist_id, ep, vid, yt_title, yt_desc, localizations, tags, existing_pl_vids, args.captions
                )
                state["episodes"][ep_key].update(post)
                save_state(state)

            ctx.close()

    # Ensure any previously uploaded episodes also have 10-language localizations & playlist membership
    for ep in range(args.start, args.end + 1):
        ep_key = f"{ep:02d}"
        info = state["episodes"].get(ep_key)
        if not info or not info.get("videoId"):
            continue
        if not info.get("localized") or not info.get("inPlaylist"):
            yt_title, yt_desc, localizations, tags = build_episode_metadata(ep)
            post = apply_api_postprocess(
                yt, playlist_id, ep, info["videoId"], yt_title, yt_desc, localizations, tags, existing_pl_vids, args.captions
            )
            info.update(post)
            save_state(state)

    done_count = sum(1 for ep in range(args.start, args.end + 1) if state["episodes"].get(f"{ep:02d}", {}).get("videoId"))
    log(f"=== SUMMARY: {done_count}/{args.end - args.start + 1} uploaded | Playlist: https://www.youtube.com/playlist?list={playlist_id} ===")


if __name__ == "__main__":
    main()
