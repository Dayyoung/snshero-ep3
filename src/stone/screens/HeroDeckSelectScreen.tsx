import React, { useEffect, useMemo, useState } from 'react';
import { useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import {
  CLASS_CREST_URL,
  cardDb,
  getHeroArtUrl,
} from '../cardDb';
import {
  SPINNER_TITLES_EN,
  getDeckDisplayName,
  getLocalizedHeroInfo,
  getRankTitle,
} from '../i18nData';
import { hsStorage } from '../storage';
import {
  BoardThemeId,
  CLASSIC_HEROES,
  CustomDeck,
  GameMode,
  HERO_CLASS_ORDER,
  HeroClass,
} from '../types';

export interface HeroDeckSelectScreenProps {
  initialMode: GameMode;
  onBack: () => void;
  onEditDecks: () => void;
  onLaunchBattle: (params: {
    mode: GameMode;
    deck: CustomDeck;
    preferredOpponentClass?: HeroClass;
    boardTheme?: BoardThemeId;
  }) => void;
}

const DEFAULT_SPINNER_TITLES = [
  '적절한 상대',
  '마성의 마법사',
  '사나운 사냥꾼',
  '전전긍긍하는 전사',
  '드센 드루이드',
  '도도한 도적',
  '흑심 품은 흑마법사',
  '주제넘은 주술사',
  '성질내는 성기사',
  '사랑받는 사제',
  '밀하우스 마나스톰',
  '답답해 미치는 코볼트',
  '속삭이는 고대 신',
  '블리자드 개발자',
  '하스의 육촌 형',
];

export const HeroDeckSelectScreen: React.FC<HeroDeckSelectScreenProps> = ({
  initialMode,
  onBack,
  onEditDecks,
  onLaunchBattle,
}) => {
  const { lang, isKo, tr } = useHeroLanguage();
  const decks = useMemo(() => hsStorage.getDecks(), []);
  const profile = useMemo(() => hsStorage.getProfile(), []);

  const [mode, setMode] = useState<GameMode>(initialMode);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || 'preset_mage');
  const [practiceOpponentClass, setPracticeOpponentClass] = useState<HeroClass>('WARRIOR');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId | 'RANDOM'>('RANDOM');

  const [matching, setMatching] = useState(false);
  const [wheelIndex, setWheelIndex] = useState(0);
  const [wheelLocked, setWheelLocked] = useState(false);

  const spinnerTitles = useMemo(() => {
    if (!isKo) {
      return SPINNER_TITLES_EN;
    }
    const fromManifest = cardDb.getManifest()?.koKR?.spinnerTitles;
    if (fromManifest && fromManifest.length >= 8) {
      return [
        '적절한 상대',
        ...DEFAULT_SPINNER_TITLES.slice(1, 10),
        ...fromManifest.filter((x) => x !== '적절한 상대' && x !== '가치 있는 상대'),
      ];
    }
    return DEFAULT_SPINNER_TITLES;
  }, [isKo]);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || decks[0],
    [decks, selectedDeckId],
  );
  const hero = CLASSIC_HEROES[selectedDeck.heroClass];
  const localizedHero = getLocalizedHeroInfo(selectedDeck.heroClass, lang);
  const selectedDeckName = getDeckDisplayName(
    selectedDeck.id,
    selectedDeck.name,
    selectedDeck.heroClass,
    lang,
  );
  const isPractice = mode === 'PRACTICE_NORMAL' || mode === 'PRACTICE_EXPERT';

  const selectedDeckStats = useMemo(() => {
    const curve = [0, 0, 0, 0, 0, 0, 0, 0];
    let minions = 0;
    let spells = 0;
    let weapons = 0;
    for (const cid of selectedDeck.cards) {
      const def = cardDb.getCard(cid);
      if (!def) continue;
      curve[Math.min(7, def.cost)] += 1;
      if (def.type === 'MINION') minions += 1;
      else if (def.type === 'SPELL') spells += 1;
      else if (def.type === 'WEAPON') weapons += 1;
    }
    return { curve, minions, spells, weapons };
  }, [selectedDeck]);

  useEffect(() => {
    if (!matching) return;
    let tick = 0;
    const maxTicks = 18;
    let timer: number;

    const step = () => {
      tick += 1;
      if (tick < maxTicks) {
        setWheelIndex((prev) => (prev + 1) % spinnerTitles.length);
        hsAudio.playSfx('ui_hover', 0.45);
        timer = window.setTimeout(step, 65 + tick * 12);
      } else {
        setWheelIndex(0);
        setWheelLocked(true);
        hsAudio.playSfx('menu_select', 0.95);
        timer = window.setTimeout(() => {
          onLaunchBattle({
            mode,
            deck: selectedDeck,
            preferredOpponentClass: isPractice ? practiceOpponentClass : undefined,
            boardTheme: boardTheme === 'RANDOM' ? undefined : boardTheme,
          });
        }, 780);
      }
    };

    timer = window.setTimeout(step, 80);
    return () => clearTimeout(timer);
  }, [
    matching,
    spinnerTitles,
    mode,
    selectedDeck,
    isPractice,
    practiceOpponentClass,
    boardTheme,
    onLaunchBattle,
  ]);

  const handleStartClick = () => {
    if (selectedDeck.cards.length < 30) return;
    hsAudio.playSfx('box_press');
    setWheelLocked(false);
    setMatching(true);
  };

  const rankMedalImg =
    profile.rank === 0 ? '/stone-assets/ui/medal_legend.webp' : '/stone-assets/ui/medal_bronze.webp';

  return (
    <div
      style={{ backgroundImage: 'url(/stone-assets/ui/box_table_bg.webp)' }}
      className="relative flex h-[100dvh] w-full select-none flex-col justify-between overflow-hidden bg-cover bg-center p-2.5 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/62" />

      {/* Top Brass Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('box_close');
            onBack();
          }}
          className="hs-brass-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100 sm:px-4 sm:py-2 sm:text-sm"
        >
          ← {isKo ? (<><span className="hidden sm:inline">여관 </span>상자로</>) : 'Back'}
        </button>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-2xl border-2 border-[#c39c54] bg-stone-950/90 p-1 shadow-xl sm:gap-1.5">
          {!isPractice && mode !== 'TUTORIAL' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setMode('RANKED');
                }}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-4 sm:text-xs ${
                  mode === 'RANKED'
                    ? 'bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                <img src={rankMedalImg} alt="" className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4" />
                <span>{tr('등급전', 'Ranked')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setMode('CASUAL');
                }}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-4 sm:text-xs ${
                  mode === 'CASUAL'
                    ? 'bg-gradient-to-b from-sky-500 to-blue-800 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                <img
                  src="/stone-assets/ui/box_compass_medallion.webp"
                  alt=""
                  className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4"
                />
                <span>{tr('일반전', 'Casual')}</span>
              </button>
            </>
          ) : isPractice ? (
            <>
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setMode('PRACTICE_NORMAL');
                }}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:px-4 sm:text-xs ${
                  mode === 'PRACTICE_NORMAL'
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-800 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                {tr('일반 여관주인', 'Normal AI')}
              </button>
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setMode('PRACTICE_EXPERT');
                }}
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:px-4 sm:text-xs ${
                  mode === 'PRACTICE_EXPERT'
                    ? 'bg-gradient-to-b from-red-600 to-red-900 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                {tr('숙련 여관주인', 'Expert AI')}
              </button>
            </>
          ) : (
            <span className="px-3 py-1 text-xs font-extrabold text-emerald-300">
              {tr('실전 입문 튜토리얼', 'Tavern Tutorial')}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click');
            onEditDecks();
          }}
          className="hs-brass-btn flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <img
            src={CLASS_CREST_URL[selectedDeck.heroClass]}
            alt=""
            className="h-4 w-4 rounded-full object-cover sm:h-5 sm:w-5"
          />
          <span>{tr('덱 편집', 'Edit Decks')}</span>
        </button>
      </header>

      {/* Main Content: Scrollable on Mobile Portrait + Side-by-Side 12-Col on Desktop */}
      <main className="relative z-20 mx-auto my-2 grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 overflow-y-auto pr-0.5 lg:my-auto lg:flex-none lg:grid-cols-12 lg:gap-5 lg:overflow-visible">
        {/* Left 7 Cols: 9-Slot Deck Selection Box (3x3 Visible on Mobile Portrait!) */}
        <section className="hs-wood-panel rounded-2xl p-3 sm:rounded-3xl sm:p-5 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between border-b border-amber-500/25 pb-1.5 sm:mb-3 sm:pb-2">
            <h2 className="hs-title text-sm font-extrabold text-amber-100 sm:text-lg">
              {tr('전투에 출전할 덱 선택', 'Choose Your Deck')}
            </h2>
            <span className="text-[11px] font-bold text-amber-300/85 sm:text-xs">
              {tr(
                `보유 덱 ${decks.length}개 · 30장 완료 덱 출전`,
                `${decks.length} Decks · 30/30 Required`,
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:max-h-[58vh] sm:gap-3 sm:overflow-y-auto sm:pr-1">
            {decks.map((d) => {
              const dh = CLASSIC_HEROES[d.heroClass];
              const dHero = getLocalizedHeroInfo(d.heroClass, lang);
              const dName = getDeckDisplayName(d.id, d.name, d.heroClass, lang);
              const isSelected = d.id === selectedDeck.id;
              const isComplete = d.cards.length === 30;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    hsAudio.playSfx('cm_select_hero', 0.7);
                    setSelectedDeckId(d.id);
                  }}
                  style={{ background: dh.frameGradient }}
                  className={`group relative flex flex-col items-center overflow-hidden rounded-xl border-[2.5px] p-2 text-left transition sm:rounded-2xl sm:border-[3px] sm:p-3 ${
                    isSelected
                      ? 'scale-[1.02] border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.85)]'
                      : 'border-[#b9934c]/70 opacity-90 hover:border-amber-300 hover:opacity-100'
                  }`}
                >
                  {/* Official Class Crest Badge in Top-Right Corner */}
                  <img
                    src={CLASS_CREST_URL[d.heroClass]}
                    alt=""
                    className="absolute right-1.5 top-1.5 z-10 h-5 w-5 rounded-full border border-amber-200/80 object-cover shadow sm:right-2 sm:top-2 sm:h-6 sm:w-6"
                  />

                  <div className="relative h-14 w-14 overflow-hidden rounded-t-[28px] rounded-b-lg border-2 border-[#ebd08e] bg-stone-950 shadow-lg sm:h-20 sm:w-20 sm:rounded-t-[40px] sm:rounded-b-xl">
                    <img
                      src={getHeroArtUrl(dh.heroId)}
                      alt={dHero.name}
                      className="h-full w-full scale-110 object-cover object-top transition group-hover:scale-120"
                    />
                  </div>

                  <div className="mt-1.5 w-full text-center sm:mt-2">
                    <div className="hs-outline-sm truncate text-[11px] font-extrabold text-white sm:text-xs">
                      {dName}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[9.5px] font-bold text-amber-200 sm:gap-1.5 sm:text-[10.5px]">
                      <span>{dHero.className}</span>
                      <span>·</span>
                      <span className={isComplete ? 'text-emerald-300' : 'text-red-300'}>
                        {d.cards.length}/30
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right 5 Cols: Hero Showcase, Rank/Opponent & Carved Swirl PLAY Button */}
        <section className="hs-wood-panel relative flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-amber-100 sm:rounded-3xl sm:p-5 lg:col-span-5">
          {/* Subtle Royal Blue Banner Backdrop */}
          <img
            src="/stone-assets/ui/banner_royal_blue.webp"
            alt=""
            className="pointer-events-none absolute -top-6 right-0 w-56 object-contain opacity-20 sm:w-64"
          />

          <div className="relative z-10 flex items-center gap-3 sm:gap-4">
            <div className="relative h-22 w-19 shrink-0 overflow-hidden rounded-t-[40px] rounded-b-xl border-[3px] border-[#e7c57c] bg-stone-950 shadow-[0_12px_26px_rgba(0,0,0,0.85)] sm:h-28 sm:w-24 sm:rounded-t-[50px] sm:border-[3.5px]">
              <img
                src={getHeroArtUrl(hero.heroId)}
                alt={localizedHero.name}
                className="h-full w-full scale-110 object-cover object-top"
              />
              <img
                src={CLASS_CREST_URL[selectedDeck.heroClass]}
                alt=""
                className="absolute bottom-1 right-1 h-5 w-5 rounded-full border border-amber-200 object-cover shadow sm:h-6 sm:w-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div
                style={{ color: hero.accentColor }}
                className="text-[11px] font-extrabold uppercase tracking-wider sm:text-xs"
              >
                {localizedHero.className} · {localizedHero.title}
              </div>
              <div className="hs-title hs-outline-sm truncate text-lg font-extrabold text-white sm:text-2xl">
                {localizedHero.name}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-bold text-amber-200 sm:text-xs">
                {tr(`출전 덱: ${selectedDeckName}`, `Selected Deck: ${selectedDeckName}`)}
              </div>
              <div className="mt-1.5 rounded-xl border border-[#c8a158]/40 bg-black/45 px-2.5 py-1 text-[10.5px] leading-snug sm:mt-2 sm:py-1.5 sm:text-[11px]">
                <b className="text-sky-300">
                  {tr(`영웅 능력 [${localizedHero.heroPowerName}]:`, `Hero Power [${localizedHero.heroPowerName}]:`)}
                </b>{' '}
                {localizedHero.heroPowerText}
              </div>
            </div>
          </div>

          {/* Selected Deck Mana Curve (0 ~ 7+) & Minion/Spell/Weapon Breakdown */}
          <div className="relative z-10 mt-2 rounded-2xl border border-[#c8a158]/40 bg-black/40 px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[10.5px] font-extrabold">
              <span className="text-amber-200">{tr('덱 마나 커브', 'Deck Mana Curve')}</span>
              <span className="text-sky-200">
                {tr(
                  `하수인 ${selectedDeckStats.minions} · 주문 ${selectedDeckStats.spells}${selectedDeckStats.weapons > 0 ? ` · 무기 ${selectedDeckStats.weapons}` : ''}`,
                  `Minions ${selectedDeckStats.minions} · Spells ${selectedDeckStats.spells}${selectedDeckStats.weapons > 0 ? ` · Weapons ${selectedDeckStats.weapons}` : ''}`,
                )}
              </span>
            </div>
            <div className="flex h-11 items-end gap-1">
              {selectedDeckStats.curve.map((cnt, costBucket) => {
                const maxBar = Math.max(6, ...selectedDeckStats.curve);
                const hPct = Math.round((cnt / maxBar) * 100);
                return (
                  <div key={costBucket} className="flex flex-1 flex-col items-center">
                    <span className="mb-0.5 h-2.5 text-[8.5px] font-extrabold text-amber-200">
                      {cnt > 0 ? cnt : ''}
                    </span>
                    <div className="flex h-6 w-full items-end overflow-hidden rounded-t border border-amber-500/25 bg-stone-900/95">
                      <div
                        style={{ height: `${hPct}%` }}
                        className="w-full rounded-t bg-gradient-to-t from-blue-700 via-sky-500 to-sky-200 transition-all"
                      />
                    </div>
                    <span className="hs-num mt-0.5 text-[9px] text-sky-200">
                      {costBucket === 7 ? '7+' : costBucket}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Practice Opponent Picker OR Classic Rank Medallion */}
          {isPractice ? (
            <div className="relative z-10 my-2.5 rounded-2xl border border-[#c8a158]/40 bg-black/40 p-2.5 sm:my-3 sm:p-3">
              <div className="mb-1.5 text-xs font-extrabold text-amber-200 sm:mb-2">
                {tr('대전할 여관주인 직업 선택', 'Choose Innkeeper Class')}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {HERO_CLASS_ORDER.map((hc) => {
                  const oppInfo = getLocalizedHeroInfo(hc, lang);
                  const active = practiceOpponentClass === hc;
                  return (
                    <button
                      key={hc}
                      type="button"
                      onClick={() => {
                        hsAudio.playSfx('ui_click');
                        setPracticeOpponentClass(hc);
                      }}
                      className={`flex min-h-[36px] items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-2 sm:text-xs ${
                        active
                          ? 'border-yellow-300 bg-gradient-to-b from-amber-600 to-amber-900 text-white shadow'
                          : 'border-stone-700 bg-stone-900/85 text-amber-100/80 hover:border-amber-500'
                      }`}
                    >
                      <img
                        src={CLASS_CREST_URL[hc]}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      <span>{oppInfo.className}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="relative z-10 my-2.5 flex items-center justify-between rounded-2xl border border-[#c8a158]/40 bg-black/40 p-2.5 sm:my-3 sm:p-3.5">
              <div>
                <div className="text-[10.5px] font-bold text-amber-300 sm:text-[11px]">
                  {tr('현재 오리지널 등급', 'Current Classic Rank')}
                </div>
                <div className="hs-title text-base font-extrabold text-white sm:text-lg">
                  {profile.rank === 0
                    ? tr('전설 (LEGEND)', 'LEGEND')
                    : tr(
                        `${profile.rank}등급 · ${getRankTitle(profile.rank, lang)}`,
                        `Rank ${profile.rank} · ${getRankTitle(profile.rank, lang)}`,
                      )}
                </div>
                <div className="mt-0.5 text-[10.5px] text-amber-200/75 sm:text-[11px]">
                  {tr(
                    '승리 시 별 획득 · 연승 보너스 및 3승당 10골드 지급',
                    'Earn Stars for wins · Win Streak bonus & +10 Gold every 3 wins',
                  )}
                </div>
              </div>
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                <img
                  src={rankMedalImg}
                  alt={tr('등급 메달', 'Rank Medal')}
                  className="h-full w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
                />
                {profile.rank > 0 && (
                  <span className="hs-num absolute bottom-0 right-0 rounded-full border border-amber-200 bg-stone-950/90 px-1.5 text-xs text-amber-200">
                    {profile.rank}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Battlefield Theme Selector */}
          <div className="relative z-10 mb-2.5 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#c8a158]/35 bg-black/35 px-2.5 py-2 text-xs sm:mb-3 sm:px-3">
            <span className="font-bold text-amber-200">{tr('전장 보드', 'Battlefield')}</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'RANDOM', label: tr('무작위', 'Random') },
                  { id: 'STORMWIND', label: tr('스톰윈드', 'Stormwind') },
                  { id: 'ORGRIMMAR', label: tr('오그리마', 'Orgrimmar') },
                  { id: 'PANDARIA', label: tr('판다리아', 'Pandaria') },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoardTheme(b.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                    boardTheme === b.id
                      ? 'bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
                      : 'bg-stone-900 text-amber-200/70 hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Iconic Hearthstone Circular Carved-Stone Swirl PLAY Medallion Button (Desktop Inside Right Panel) */}
          <div className="relative z-10 hidden flex-col items-center pt-1 lg:flex">
            <button
              type="button"
              disabled={selectedDeck.cards.length < 30}
              onClick={handleStartClick}
              className="group relative flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-97 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[4px] border-[#f2cf7e] bg-radial from-sky-400 via-blue-700 to-slate-950 shadow-[0_12px_30px_rgba(0,0,0,0.9),0_0_28px_rgba(56,189,248,0.75)] group-hover:shadow-[0_14px_34px_rgba(0,0,0,0.95),0_0_42px_rgba(56,189,248,0.98)]">
                <img
                  src="/stone-assets/ui/hs_thebox_glowring.webp"
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute -inset-3 h-[calc(100%+24px)] w-[calc(100%+24px)] animate-[hsSlowSpin_18s_linear_infinite] rounded-full object-contain opacity-90 mix-blend-screen"
                />
                <img
                  src="/stone-assets/ui/play_swirl_medallion.webp"
                  alt=""
                  draggable={false}
                  className="h-24 w-24 rounded-full object-contain mix-blend-luminosity drop-shadow-[0_0_14px_rgba(125,211,252,0.95)] transition duration-300 group-hover:rotate-12"
                />
                <span className="hs-title hs-outline pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-extrabold tracking-widest text-white">
                  {tr('대전!', 'PLAY')}
                </span>
              </div>
            </button>
          </div>
        </section>
      </main>

      {/* Always-Visible Docked Mobile/Tablet PLAY Button (`< lg`) */}
      <div className="relative z-30 mx-auto w-full max-w-6xl shrink-0 pt-1 lg:hidden">
        <button
          type="button"
          disabled={selectedDeck.cards.length < 30}
          onClick={handleStartClick}
          className="hs-arcane-btn group relative flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl py-2.5 text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <img
            src="/stone-assets/ui/play_swirl_medallion.webp"
            alt=""
            className="h-9 w-9 rounded-full object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]"
          />
          <span className="hs-title hs-outline text-lg font-extrabold tracking-widest">
            {tr(`대전! (${selectedDeckName})`, `PLAY (${selectedDeckName})`)}
          </span>
        </button>
      </div>

      {/* Authentic Hearthstone 5-Row Cylindrical Slot-Machine Matchmaking Wheel Modal */}
      {matching && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/84 p-4 backdrop-blur-sm">
          <div className="hs-wood-panel flex w-full max-w-md flex-col items-center rounded-3xl p-6 text-center sm:p-7">
            <img
              src="/stone-assets/ui/box_compass_medallion.webp"
              alt=""
              draggable={false}
              className={`mb-2 h-14 w-14 object-contain drop-shadow ${
                wheelLocked ? '' : 'animate-[hsSlowSpin_2.2s_linear_infinite]'
              }`}
            />
            <div className="hs-title mb-2 text-lg font-extrabold tracking-wider text-amber-100">
              {wheelLocked
                ? tr('상대를 찾았습니다!', 'Opponent Found!')
                : tr('상대를 찾는 중', 'Finding Opponent')}
            </div>

            {/* Cylindrical Ivory Drum Slot Window (High-Contrast Legibility) */}
            <div className="relative my-2 flex h-44 w-full flex-col items-center justify-between overflow-hidden rounded-2xl border-[4px] border-[#966d35] bg-gradient-to-b from-[#cbb082] via-[#fbf2dc] to-[#c7ac7d] px-5 py-2.5 shadow-[inset_0_12px_22px_rgba(32,18,6,0.62)]">
              {/* Left & Right Brass Pointer Triangles */}
              <div className="pointer-events-none absolute left-1.5 top-1/2 z-20 -translate-y-1/2 text-base font-black text-[#7c2d12]">
                ▶
              </div>
              <div className="pointer-events-none absolute right-1.5 top-1/2 z-20 -translate-y-1/2 text-base font-black text-[#7c2d12]">
                ◀
              </div>

              <div className="truncate text-[11px] font-extrabold text-[#5c3b1c]/65">
                {spinnerTitles[(wheelIndex + spinnerTitles.length - 2) % spinnerTitles.length]}
              </div>
              <div className="truncate text-xs font-extrabold text-[#38210d]/90">
                {spinnerTitles[(wheelIndex + spinnerTitles.length - 1) % spinnerTitles.length]}
              </div>
              <div
                className={`relative z-10 my-0.5 w-full rounded-xl border-y-2 px-4 py-2 text-xl font-black tracking-tight shadow-md transition-all ${
                  wheelLocked
                    ? 'scale-105 border-yellow-300 bg-[#231106] text-[#fde047] shadow-[0_0_20px_rgba(250,204,21,0.55)]'
                    : 'border-amber-600/80 bg-[#2a1508] text-[#fff9e6]'
                }`}
              >
                {spinnerTitles[wheelIndex]}
              </div>
              <div className="truncate text-xs font-extrabold text-[#38210d]/90">
                {spinnerTitles[(wheelIndex + 1) % spinnerTitles.length]}
              </div>
              <div className="truncate text-[11px] font-extrabold text-[#5c3b1c]/65">
                {spinnerTitles[(wheelIndex + 2) % spinnerTitles.length]}
              </div>
            </div>

            <p className="mt-2 text-xs font-semibold text-amber-200/80">
              {tr(
                '여관에서 실력이 비슷한 상대를 탐색하고 있습니다...',
                'Searching the Tavern for an opponent of matching skill...',
              )}
            </p>

            {!wheelLocked && (
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('box_close');
                  setMatching(false);
                }}
                className="hs-brass-btn mt-4 rounded-xl px-7 py-2 text-xs font-extrabold text-amber-100"
              >
                {tr('취소', 'Cancel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
