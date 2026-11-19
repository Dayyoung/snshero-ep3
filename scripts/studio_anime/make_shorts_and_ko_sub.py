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
    3: [
        "<i>험준한 봉우리를 넘어, 일곱 추적자는 안개폭포 절벽에 들어섰다.</i>",
        "금지된 암흑 강령술이야.\n이 안개가 살아 있는 마력을 빨아들이고 있어.",
        "침착해, 모두 검을 뽑아라.\n악의가 이 안개를 엮어냈어.",
        "내 망치 앞에 서는 악마는\n누구든 모루 꼴이 될 뿐이지!",
        "긴장 풀어, 동료들.\n두려움은 줄타기 곡예사를 무너뜨리는 법이야.",
        "돌 위의 여덟 발소리…\n위다! 당장 흩어져!",
        "어리석은 벌레들 같으니,\n제 발로 무덤에 기어들어오다니!",
        "숨을 참아!\n보랏빛 맹독이 마력을 부식시켜!",
        "그 더러운 발톱을\n내 형제들에게서 당장 치워!",
        "지금이야, 아일라, 그림리!\n서로의 숨소리에 귀를 기울여!",
        "일곱 추적자들…\n이 대가는 천 배로 되갚아주마!",
        "울지 마, 친구들.\n저 괴물을 막은 목숨 하나면 충분해.",
        "북쪽으로 가… 아이를 찾아…\n우리의 맹세를 지켜줘.",
        "로빈야드, 정신 차려!\n아직 내가 치유할 수 있어!",
        "방울이 울릴 때마다\n네가 우리 곁에서 춤추는 줄 알마, 형제여.",
        "우린 여섯이지만,\n그는 언제나 우리와 함께 걷는다.",
        "무기를 들어라!\n북부 황야를 향해 전진한다!",
        "<i>희생으로 단련된 여섯 수호자가 서리 속으로 말을 달렸다.</i>",
    ],
    4: [
        "<i>혹독한 여섯 번의 겨울이 북부 초원을 지나갔다.</i>",
        "어머니, 밖에서 얼어붙은\n어린 늑대를 발견했어요.",
        "아버지의 은단검으로\n얼음을 깨서 구해냈어요.",
        "잘했구나, 카단.\n생명을 지키는 일은 그 어떤 마법보다 위대하단다.",
        "저도 아버지처럼\n단단한 방패가 될 수 있을까요?",
        "그럼, 내 아가.\n거친 바람이 가장 깊은 뿌리를 키우는 법이란다.",
        "거기 서!\n그 애한테 손대지 마!",
        "미쳤어?\n나 두고 어서 도망쳐!",
        "화살을 쏴라!\n두 녀석을 지금 당장 가라앉혀!",
        "어째서 목숨을 걸고 내 아들을 구했느냐,\n시골 소년아?",
        "다친 아이를 절대 버려두지 말라고\n어머니가 가르쳐주셨어요.",
        "사자의 심장이로군!\n이제부터 넌 길가메시의 의형제다!",
        "내 목숨은 네 거야, 카단.\n넌 내 형제다.",
        "찾았다!\n세상에, 알렉산다르의 아들을 찾았어!",
        "살아 있었구나, 꼬마야…\n꼬박 6년을 찾아 헤맸단다.",
        "여섯 겨울이 지났는데도\n알렉산다르의 맹세를 잊지 않으셨군요.",
        "아드님을 결코 부서지지 않는\n방패로 단련시켜 드리겠소.",
        "<i>북부 천막의 모닥불 아래, 어린 묘목이 깊이 뿌리를 내렸다.</i>",
    ],
    5: [
        "<i>보랏빛 번개가 여섯 스승과 카단을 지하 동굴로 몰아넣었다.</i>",
        "뒤틀린 마력의 실타래야.\n흑마법이 이 폭풍을 조종하고 있어.",
        "유황과 흑요석의 부패가\n이 동굴 샘을 오염시켰어.",
        "여섯 겨울을 쫓았건만…\n알렉산다르의 핏줄이 제 발로 내 거미줄에 들었구나.",
        "카단, 엎드려!\n네 그림자 뒤에 있어!",
        "눈을 감아라, 카단!\n시야는 너를 속일 뿐이다!",
        "빗줄기를 느껴라!\n어떤 환영도 바람 앞엔 숨지 못한다!",
        "건방진 애송이!\n내 일격을 어떻게 읽어냈지?",
        "로빈야드의 복수다,\n이 추악한 그림자 마녀야!",
        "발리안의 아들은 루시안을 섬기고…\n바람섬의 폭풍이 일어난다!",
        "닥쳐라, 마녀!\n도망치지 말고 강철을 받아라!",
        "스승님… 바람섬의 실리아란\n누구인가요?",
        "현자 아이올로스의 예리한 딸이지.\n그림자가 그녀의 힘을 노린다.",
        "그 아이도 저처럼 쫓기며\n두려워하고 있을까요?",
        "그렇다면 더 강해져라, 카단.\n진정한 방패는 기다리지 않는다.",
        "어둠 속 멋진 받아치기였다!\n내일은 바위 훈련을 세 배로 늘린다!",
        "흉터를 두려워 마라.\n아문 상처는 더 단단한 갑옷이 되니까.",
        "<i>어둠 너머의 소리에 귀 기울이며, 카단은 새벽별을 마주했다.</i>",
    ],
    6: [
        "<i>여섯 스승은 어린 카단을 저마다 다른 여섯 길로 이끌었다.</i>",
        "두 발을 강철처럼 박아라!\n단 한 걸음도 물러서지 마!",
        "둔한 곰은 죽을 뿐!\n반 치만 옆으로 흘려 넘겨!",
        "숨을 완전히 멈춰라!\n고요함만이 그림자를 꿰뚫는다.",
        "손목이 굳었다!\n알렉산다르는 바람처럼 싸웠어!",
        "힘만 앞세우면\n산이 너를 거부할 뿐이다.",
        "차가운 절벽이 정말로\n사람을 거부할 수 있나요?",
        "세상의 숨결을 외면하면\n강철도 너를 외면한다.",
        "사흘 뒤 밤,\n저 정상에서 나를 만나거라.",
        "앉아라, 카단.\n별을 들이마시고 눈을 내쉬어라.",
        "이그니스는 거센 불을 다룬다.\n너는 별을 숨 쉬어야 한다.",
        "별빛에 눈이 멀어 벗을 못 본다면,\n누구를 지키려는 게냐?",
        "제 방패는 등 뒤에서 떨고 있는\n온기를 지키기 위한 겁니다.",
        "그 진실을 붙들어라.\n그것이 결코 부서지지 않는 방패다.",
        "발소리가 바람 속으로 사라졌구나.\n겸손함을 잃지 마라, 카단.",
        "눈빛이 깊어졌네.\n그 안에 새벽별이 빛나고 있어.",
        "하하! 뼈대에 강철이 박혔군!\n다시 훈련 시작이다!",
        "<i>마침내 별빛이 젊은 전사의 방패 속에 깃들었다.</i>",
    ],
    7: [
        "<i>열여덟이 된 카단은 어두운 채석장으로 고르고를 쫓았다.</i>",
        "내일 밤, 펜리르의 연회 뿔잔에\n마비 독이 들어갈 것이다.",
        "펜리르가 쓰러져 부족이 갈라지면,\n지휘권은 내 손에 떨어진다.",
        "이그니스가 백염을 이끌고 북상한다.\n네가 북부를 지배하게 될 거다.",
        "바르가스트는 30년을 나와 싸웠다!\n증거를 대라!",
        "주군, 남쪽과 내통하던\n이 원로를 붙잡았습니다!",
        "왜 자유로운 서른 부족을\n하나의 왕관 아래 묶으려 하십니까?",
        "우리 아이들이 얼어붙은 우물을 두고\n피 흘리지 않게 하려는 거다!",
        "무력한 포로를 해치는 건 승리가 아니야.\n치료해 줘.",
        "동정 따윈 치워!\n아버지가 너희를 짓밟아주실 거다!",
        "탐욕에 목숨을 버리지 마.\n진실을 똑바로 지켜봐.",
        "상을 말해라, 카단.\n초원의 절반을 내어주마.",
        "바르가스트의 희생된 징집병들을\n우리 추모비에 새겨주십시오.",
        "내 딸 티타니아를 지켜다오—\n북부 부족들을 이끌어라!",
        "난 선물처럼 건네질\n전리품이 아니야, 카단.",
        "남부 궁정에서 돌아온 뒤에—\n그때 내 마음을 물어봐.",
        "네 자긍심을 기억할게, 티타니아.\n언제까지나.",
        "<i>한밤의 별빛 아래, 카단의 남부 여정이 시작되었다.</i>",
    ],
    8: [
        "<i>남쪽으로 말을 달린 열여덟의 카단은 국경 마을에 다다랐다.</i>",
        "은화 세 닢!\n붉은 갈기를 차지할 자 누구인가?",
        "미쳤나, 애송이!\n당장 뒤로 물러서!",
        "도둑놈 같은 거지 녀석!\n내 창고에서 밀가루를 훔쳤지!",
        "밀가루 자국을 보세요!\n무거운 군화 발자국뿐이잖아요!",
        "저 아이 말이 맞소.\n무거운 몽둥이를 내리시오.",
        "낯선 사람을 참 쉽게 믿네.\n내가 소매치기면 어쩌려고?",
        "진실을 위해 매를 맞는 사람이\n비뚤어졌을 리 없잖아.",
        "난 실리아. 수도의\n대아카데미로 가는 길이야.",
        "난 카단이야. 남쪽의\n최고사령관 이그니스를 찾고 있어.",
        "이그니스—불꽃 궁정의 꼭두각시지.\n그자에겐 가까이 가지 마.",
        "그 붉은 군마와 은화를\n순순히 내놔라!",
        "무식한 완력은 여기선 서툴지.\n바람이 어떻게 일하는지 봐.",
        "넌 결코 평범한\n거지 소녀가 아니군, 실리아.",
        "당연하지. 그러니까 앞으로는\n내 충고를 귀담아들어.",
        "이미 이겼잖아.\n쓰러진 상대를 왜 모욕하는 거지?",
        "떠돌이가 설교라니?\n그 녹슨 방패를 지금 시험해보마!",
        "<i>마침내 운명의 두 아들이 서로 마주 섰다.</i>",
    ],
    9: [
        "<i>라이트헤이븐의 결투장 위로 얼어붙는 듯한 긴장이 감돌았다.</i>",
        "내 무대에 떠돌이라니?\n네 방패를 불태워주마!",
        "숨겨진 결계가 그의 마력을 채우고 있어!\n물러서, 카단!",
        "그 저주받은 그림자 발톱—\n성스러운 불꽃을 욕보이다니!",
        "고르고의 생명 흡수 맹독이야.\n치료하지 않으면 널 삼켜버려.",
        "그 고운 비단옷, 오늘 밤엔\n꽤 쌀쌀해 보이는데, 공주님.",
        "바보 같은 녀석!\n남의 결투엔 왜 뛰어든 거야?",
        "18년 전, 알렉산다르와 발리안은\n형제의 맹세를 맺었다.",
        "부패한 귀족들이 갓난아기 이그니스—\n발리안의 아들을 훔쳐갔지.",
        "그렇다면 이그니스는 적이 아니라…\n내 형제잖아.",
        "왕실 약초원의 달빛약초만이\n그 맹독을 정화할 수 있다.",
        "이 은단검은 어떤 결계든 풀어내.\n내가 다녀올게.",
        "혼자는 안 돼.\n그 통로는 내 바람만이 통과할 수 있어.",
        "저기—빛나는 달빛약초야!\n어서 챙겨!",
        "잠깐… 제7노역장—\n대사부 발리안이 살아 계셔!",
        "발리안 숙부님이 살아 계셔.\n반드시 사슬을 끊어드리겠어.",
        "먼저 워커를 치료하자—\n그다음 우리 바람이 그곳으로 향한다!",
        "<i>천창의 달빛 아래, 두 젊은 영웅이 앞으로 내디뎠다.</i>",
    ],
    10: [
        "<i>붉은 흑요석 탑들이 라이트헤이븐의 적유리궁을 왕관처럼 둘러쌌다.</i>",
        "훌륭하구나, 이그니스.\n이제 망설임 없이 충성을 증명해라.",
        "재상님, 아버지는 이미 모든 걸 잃으셨습니다.\n풀어주십시오.",
        "발리안이 고대 왕좌의 인장을\n내놓기 전까지는 어림없다.",
        "멈춰, 카단!\n무턱대고 돌진하면 루시안의 살상 결계가 터져!",
        "고르고의 망각 주술이 묶고 있어.\n내 바람으로 풀어낼게.",
        "이셀라 숙모님, 눈보라 치던\n엘윈마을이 기억나세요?",
        "발리안… 내 남편…\n그리고 빼앗긴 내 아기!",
        "루시안이 얼어붙은 눈 속에서\n내 아이를 찢어 빼앗아갔어!",
        "이그니스는 살아 계세요, 숙모님.\n제가 반드시 데려오겠습니다.",
        "정원의 쥐새끼들 같으니! 훌륭해, 이셀라—\n기억이 돌아왔으니 가치가 두 배군.",
        "질풍의 결계여, 일어나\n우리의 길을 열어라!",
        "멈춰! 잠깐… 저 눈빛—\n저 여인은 누구지?",
        "어머니…? 정말로\n내 진짜 어머니란 말인가?",
        "카단, 저 악마의 손아귀에서\n내 아들 이그니스를 구해다오.",
        "북극성에 걸고 맹세하겠습니다,\n이셀라 숙모님.",
        "우리가 그들의 사슬을 부수고\n모두를 자유롭게 할 겁니다.",
        "<i>찬란한 붉은 여명이 그들의 새로운 길을 비추었다.</i>",
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


def _norm_en(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"</?i>", "", text).strip()).lower()


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

    matched_ko: List[str] = []
    if len(translations) == len(en_blocks):
        matched_ko = list(translations)
    else:
        # Handle episodes with intentionally excluded cuts (e.g. EP04-CUT09) by mapping
        # storyboard spoken lines -> KO_TRANSLATIONS_BY_EP[ep_num] and looking up each EN.srt cue.
        sb_path = en_srt_path.parent / f"storyboard_ep{ep_num:02d}_en.json"
        if not sb_path.is_file():
            raise RuntimeError(
                f"EP{ep_num:02d} Korean translation count ({len(translations)}) != EN.srt cue count ({len(en_blocks)})."
            )
        sb = json.loads(sb_path.read_text(encoding="utf-8"))
        spoken_en = [
            _norm_en(c.get("dialogueEn", ""))
            for c in sb.get("cuts", [])
            if c.get("audioMode") in ("character_dialogue", "offscreen_narration") and c.get("dialogueEn", "").strip()
        ]
        if len(spoken_en) != len(translations):
            raise RuntimeError(
                f"Storyboard spoken count ({len(spoken_en)}) != KO translations ({len(translations)})."
            )
        en_to_ko = dict(zip(spoken_en, translations))
        for _, _, body in en_blocks:
            key = _norm_en(body)
            if key not in en_to_ko:
                raise RuntimeError(f"Could not match EN.srt cue to KO translation: {body!r}")
            matched_ko.append(en_to_ko[key])

    entries: List[str] = []
    for (idx_str, timing_line, _), ko_text in zip(en_blocks, matched_ko):
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
