import { tr } from './i18n';

export interface ReaderBossBridgeInfo {
  actNumber: 1 | 2 | 3 | 4;
  actTitleKo: string;
  actTitleEn: string;
  bossNameKo: string;
  bossNameEn: string;
  bossRoleKo: string;
  bossRoleEn: string;
  bossImageUrl: string;
  bossHp: number;
  voiceAudioUrl: string;
  featuredCards: {
    nameKo: string;
    nameEn: string;
    statsLabel: string;
    imgUrl: string;
  }[];
}

export function getEpisodeBridgeInfo(ep: number): ReaderBossBridgeInfo {
  const safeEp = Math.max(1, Math.min(40, Math.floor(ep)));
  const padEp = String(safeEp).padStart(2, '0');
  const voiceAudioUrl = `/hs-assets/snshero-audio/story/ep${padEp}_cut1.mp3`;

  if (safeEp <= 10) {
    return {
      actNumber: 1,
      actTitleKo: '제1막 (1~10화) · 불꽃 궁정의 서막',
      actTitleEn: 'Act I (EP 1–10) · Overture of the Flame Court',
      bossNameKo: safeEp === 10 ? '불꽃 군주 이그니스' : safeEp === 5 ? '폭풍 추적자 카르그' : '붉은 갈기 볼튼',
      bossNameEn: safeEp === 10 ? 'Ignis, Lord of Flame' : safeEp === 5 ? 'Storm Stalker Karg' : 'Crimson Mane Bolton',
      bossRoleKo: safeEp % 5 === 0 ? '보스 레이드 카드팩 +1개 마일스톤' : '제1막 핵심 적장',
      bossRoleEn: safeEp % 5 === 0 ? 'Milestone: +1 Boss Card Pack' : 'Act I Key Rival',
      bossImageUrl:
        safeEp === 10
          ? '/hs-assets/characters/cutouts/011_Ignis.webp'
          : safeEp === 5
            ? '/hs-assets/bosses/boss_karg.webp'
            : '/hs-assets/bosses/boss_bolton.webp',
      bossHp: 18 + safeEp * 2,
      voiceAudioUrl,
      featuredCards: [
        { nameKo: '성기사 카단', nameEn: 'Paladin Kadan', statsLabel: '인간 수호자 · 2마나 영웅 능력', imgUrl: '/hs-assets/bosses/kadan_upper.webp' },
        { nameKo: '불꽃 군주 이그니스', nameEn: 'Ignis of Flame', statsLabel: '불 종족 · 화염 마법 폭딜', imgUrl: '/hs-assets/characters/cutouts/011_Ignis.webp' },
        { nameKo: '바람신 토람', nameEn: 'Wind God Toram', statsLabel: '바람 종족 · 질풍 속공', imgUrl: '/hs-assets/characters/cutouts/030_Wind_God_Toram.webp' },
      ],
    };
  }

  if (safeEp <= 20) {
    return {
      actNumber: 2,
      actTitleKo: '제2막 (11~20화) · 안개 호수와 검은 성전',
      actTitleEn: 'Act II (EP 11–20) · Mist Lake & Black Sanctum',
      bossNameKo: safeEp === 18 ? '대심판관 말라카이' : safeEp === 20 ? '심해 크라켄로드' : '환각마녀 모르가나',
      bossNameEn: safeEp === 18 ? 'Arch-Inquisitor Malakai' : safeEp === 20 ? 'Krakenlord of the Deep' : 'Mirage Witch Morgana',
      bossRoleKo: safeEp % 5 === 0 ? '보스 레이드 카드팩 +1개 마일스톤' : '제2막 핵심 적장',
      bossRoleEn: safeEp % 5 === 0 ? 'Milestone: +1 Boss Card Pack' : 'Act II Key Rival',
      bossImageUrl:
        safeEp === 18
          ? '/hs-assets/bosses/boss_malakai.webp'
          : safeEp === 20
            ? '/hs-assets/bosses/boss_krakenlord.webp'
            : '/hs-assets/bosses/boss_morgana.webp',
      bossHp: 24 + safeEp * 2,
      voiceAudioUrl,
      featuredCards: [
        { nameKo: '대심판관 말라카이', nameEn: 'Arch-Inquisitor Malakai', statsLabel: '광휘 신전 이단심문관', imgUrl: '/hs-assets/bosses/boss_malakai.webp' },
        { nameKo: '환각마녀 모르가나', nameEn: 'Mirage Witch Morgana', statsLabel: '안개 늪 환술 지배자', imgUrl: '/hs-assets/bosses/boss_morgana.webp' },
        { nameKo: '포세이돈', nameEn: 'Poseidon', statsLabel: '물 종족 수호자', imgUrl: '/hs-assets/characters/cutouts/010_Poseidon.webp' },
      ],
    };
  }

  if (safeEp <= 30) {
    return {
      actNumber: 3,
      actTitleKo: '제3막 (21~30화) · 봉인실과 네 관문',
      actTitleEn: 'Act III (EP 21–30) · Sealed Chamber & Four Gates',
      bossNameKo: safeEp >= 29 ? '질풍군주 제피르' : '수문장 발타자르',
      bossNameEn: safeEp >= 29 ? 'Gale Lord Zephyr' : 'Gatekeeper Balthazar',
      bossRoleKo: safeEp % 5 === 0 ? '보스 레이드 카드팩 +1개 마일스톤' : '제3막 핵심 적장',
      bossRoleEn: safeEp % 5 === 0 ? 'Milestone: +1 Boss Card Pack' : 'Act III Key Rival',
      bossImageUrl:
        safeEp >= 29
          ? '/hs-assets/bosses/boss_zephyr.webp'
          : '/hs-assets/bosses/boss_balthazar.webp',
      bossHp: 30 + safeEp * 2,
      voiceAudioUrl,
      featuredCards: [
        { nameKo: '수문장 발타자르', nameEn: 'Gatekeeper Balthazar', statsLabel: '심연 관문의 강철 수호자', imgUrl: '/hs-assets/bosses/boss_balthazar.webp' },
        { nameKo: '질풍군주 제피르', nameEn: 'Gale Lord Zephyr', statsLabel: '바람의 여왕 보좌관', imgUrl: '/hs-assets/bosses/boss_zephyr.webp' },
        { nameKo: '피닉스', nameEn: 'Phoenix', statsLabel: '불사조 · 죽음의 메아리', imgUrl: '/hs-assets/characters/cutouts/019_Phoenix.webp' },
      ],
    };
  }

  return {
    actNumber: 4,
    actTitleKo: '제4막 (31~40화) · 심연화신 루시안 최종 결전',
    actTitleEn: 'Act IV (EP 31–40) · Final Battle vs Abyssal Lucian',
    bossNameKo: safeEp >= 38 ? '심연화신 루시안' : '파멸마인 벨페고르',
    bossNameEn: safeEp >= 38 ? 'Abyssal Avatar Lucian' : 'Doom Fiend Belphegor',
    bossRoleKo:
      safeEp === 40
        ? '최종 보스 · 완주 시 +300G & 3팩 + 무한 환생 개방!'
        : safeEp % 5 === 0
          ? '보스 레이드 카드팩 +1개 마일스톤'
          : '제4막 최종 흑막 군단',
    bossRoleEn:
      safeEp === 40
        ? 'Final Boss · Clear for +300G & 3 Packs + Reincarnation!'
        : safeEp % 5 === 0
          ? 'Milestone: +1 Boss Card Pack'
          : 'Act IV Final Citadel',
    bossImageUrl:
      safeEp >= 38
        ? '/hs-assets/bosses/boss_abyss_lucian.webp'
        : '/hs-assets/characters/cutouts/013_Belphegor.webp',
    bossHp: 40 + safeEp * 2,
    voiceAudioUrl,
    featuredCards: [
      { nameKo: '심연화신 루시안', nameEn: 'Abyssal Avatar Lucian', statsLabel: '최종 흑막 · 40화 대단원 보스', imgUrl: '/hs-assets/bosses/boss_abyss_lucian.webp' },
      { nameKo: '성기사 카단', nameEn: 'Paladin Kadan', statsLabel: '3장=3배 각성 시 3배 스탯 폭발!', imgUrl: '/hs-assets/bosses/kadan_upper.webp' },
      { nameKo: '불멸자 아쉘', nameEn: 'Ashel the Immortal', statsLabel: '화염 전열 수호자', imgUrl: '/hs-assets/characters/cutouts/018_Ashel_the_Immortal.webp' },
    ],
  };
}

export function getActLabel(act: 0 | 1 | 2 | 3 | 4): string {
  if (act === 0) return tr('전체 (1~40화)', 'All (1–40)');
  if (act === 1) return tr('제1막 (1~10)', 'Act I (1–10)');
  if (act === 2) return tr('제2막 (11~20)', 'Act II (11–20)');
  if (act === 3) return tr('제3막 (21~30)', 'Act III (21–30)');
  return tr('제4막 (31~40)', 'Act IV (31–40)');
}
