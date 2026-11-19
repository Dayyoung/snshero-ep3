import type { HeroLanguage } from './heroLang';

type NonBaseLang = Exclude<HeroLanguage, 'en' | 'ko'>;

interface PatternRule {
  regex: RegExp;
  replace: Record<NonBaseLang, (...args: string[]) => string>;
}

const RULES: PatternRule[] = [
  // Rank N · Title
  {
    regex: /^Rank (\d+)(?:\s*·\s*(.+))?$/,
    replace: {
      ja: (_, n, rest) => (rest ? `ランク ${n} · ${rest}` : `ランク ${n}`),
      'zh-CN': (_, n, rest) => (rest ? `段位 ${n} · ${rest}` : `段位 ${n}`),
      'zh-TW': (_, n, rest) => (rest ? `階級 ${n} · ${rest}` : `階級 ${n}`),
      es: (_, n, rest) => (rest ? `Rango ${n} · ${rest}` : `Rango ${n}`),
      fr: (_, n, rest) => (rest ? `Rang ${n} · ${rest}` : `Rang ${n}`),
      de: (_, n, rest) => (rest ? `Rang ${n} · ${rest}` : `Rang ${n}`),
      pt: (_, n, rest) => (rest ? `Ranque ${n} · ${rest}` : `Ranque ${n}`),
      ru: (_, n, rest) => (rest ? `Ранг ${n} · ${rest}` : `Ранг ${n}`),
    },
  },
  // Turn N
  {
    regex: /^Turn (\d+)$/i,
    replace: {
      ja: (_, n) => `ターン ${n}`,
      'zh-CN': (_, n) => `第 ${n} 回合`,
      'zh-TW': (_, n) => `第 ${n} 回合`,
      es: (_, n) => `Turno ${n}`,
      fr: (_, n) => `Tour ${n}`,
      de: (_, n) => `Zug ${n}`,
      pt: (_, n) => `Turno ${n}`,
      ru: (_, n) => `Ход ${n}`,
    },
  },
  // Top X%
  {
    regex: /^Top (.+)$/,
    replace: {
      ja: (_, x) => `上位 ${x}`,
      'zh-CN': (_, x) => `前 ${x}`,
      'zh-TW': (_, x) => `前 ${x}`,
      es: (_, x) => `Top ${x}`,
      fr: (_, x) => `Top ${x}`,
      de: (_, x) => `Top ${x}`,
      pt: (_, x) => `Top ${x}`,
      ru: (_, x) => `Топ ${x}`,
    },
  },
  // Out of N players
  {
    regex: /^Out of ([\d,]+) players$/,
    replace: {
      ja: (_, n) => `全 ${n} 人中`,
      'zh-CN': (_, n) => `共 ${n} 名玩家`,
      'zh-TW': (_, n) => `共 ${n} 名玩家`,
      es: (_, n) => `De ${n} jugadores`,
      fr: (_, n) => `Sur ${n} joueurs`,
      de: (_, n) => `Von ${n} Spielern`,
      pt: (_, n) => `De ${n} jogadores`,
      ru: (_, n) => `Из ${n} игроков`,
    },
  },
  // 🔥 N Streak
  {
    regex: /^🔥 (\d+) Streak$/,
    replace: {
      ja: (_, n) => `🔥 ${n}連勝`,
      'zh-CN': (_, n) => `🔥 ${n}连胜`,
      'zh-TW': (_, n) => `🔥 ${n}連勝`,
      es: (_, n) => `🔥 Racha de ${n}`,
      fr: (_, n) => `🔥 Série de ${n}`,
      de: (_, n) => `🔥 ${er(n)} Serie`,
      pt: (_, n) => `🔥 ${n} Vitórias`,
      ru: (_, n) => `🔥 Серия ${n}`,
    },
  },
  // N Games
  {
    regex: /^(\d+) Games?$/,
    replace: {
      ja: (_, n) => `${n}戦`,
      'zh-CN': (_, n) => `${n}场`,
      'zh-TW': (_, n) => `${n}場`,
      es: (_, n) => `${n} partidas`,
      fr: (_, n) => `${n} parties`,
      de: (_, n) => `${n} Spiele`,
      pt: (_, n) => `${n} partidas`,
      ru: (_, n) => `${n} игр`,
    },
  },
  // Total N matches
  {
    regex: /^Total (\d+) matches$/,
    replace: {
      ja: (_, n) => `合計 ${n} 戦`,
      'zh-CN': (_, n) => `共 ${n} 场对战`,
      'zh-TW': (_, n) => `共 ${n} 場對戰`,
      es: (_, n) => `Total ${n} partidas`,
      fr: (_, n) => `Total ${n} matchs`,
      de: (_, n) => `Gesamt ${n} Spiele`,
      pt: (_, n) => `Total ${n} partidas`,
      ru: (_, n) => `Всего ${n} матчей`,
    },
  },
  // Owned: N Gold
  {
    regex: /^Owned:\s*([\d,]+)\s*Gold$/,
    replace: {
      ja: (_, n) => `所持: ${n} ゴールド`,
      'zh-CN': (_, n) => `拥有：${n} 金币`,
      'zh-TW': (_, n) => `擁有：${n} 金幣`,
      es: (_, n) => `Disponible: ${n} Oro`,
      fr: (_, n) => `Possédé : ${n} Or`,
      de: (_, n) => `Besitz: ${n} Gold`,
      pt: (_, n) => `Possui: ${n} Ouro`,
      ru: (_, n) => `В наличии: ${n} золота`,
    },
  },
  // Open Card Packs (N packs · MG)
  {
    regex: /^Open Card Packs \((\d+) packs? · ([\d,]+)G\)$/,
    replace: {
      ja: (_, p, g) => `パック開封 (${p}パック · ${g}G)`,
      'zh-CN': (_, p, g) => `开启卡包 (${p}包 · ${g}G)`,
      'zh-TW': (_, p, g) => `開啟卡包 (${p}包 · ${g}G)`,
      es: (_, p, g) => `Abrir sobres (${p} sobres · ${g}G)`,
      fr: (_, p, g) => `Ouvrir des paquets (${p} paquets · ${g}G)`,
      de: (_, p, g) => `Packungen öffnen (${p} Packungen · ${g}G)`,
      pt: (_, p, g) => `Abrir Pacotes (${p} pacotes · ${g}G)`,
      ru: (_, p, g) => `Открыть наборы (${p} наб. · ${g}G)`,
    },
  },
  // Go to Pack Opening (N packs)
  {
    regex: /^Go to Pack Opening \((\d+) packs?\)$/,
    replace: {
      ja: (_, p) => `パック開封へ (${p}パック)`,
      'zh-CN': (_, p) => `前往开包 (${p}包)`,
      'zh-TW': (_, p) => `前往開包 (${p}包)`,
      es: (_, p) => `Ir a abrir sobres (${p})`,
      fr: (_, p) => `Ouvrir les paquets (${p})`,
      de: (_, p) => `Packungen öffnen (${p})`,
      pt: (_, p) => `Ir para Pacotes (${p})`,
      ru: (_, p) => `Открыть наборы (${p})`,
    },
  },
  // Play Kadan's Journey Story (EP.N)
  {
    regex: /^Play Kadan's Journey Story \(EP\.(\d+)\)$/,
    replace: {
      ja: (_, ep) => `カダンの旅ストーリーをプレイ (第${ep}話)`,
      'zh-CN': (_, ep) => `游玩卡丹之旅剧情 (第${ep}章)`,
      'zh-TW': (_, ep) => `遊玩卡丹之旅劇情 (第${ep}話)`,
      es: (_, ep) => `Jugar Historia: Viaje de Kadan (EP.${ep})`,
      fr: (_, ep) => `Jouer l'Histoire : Voyage de Kadan (EP.${ep})`,
      de: (_, ep) => `Kadans Reise spielen (EP.${ep})`,
      pt: (_, ep) => `Jogar História: Jornada de Kadan (EP.${ep})`,
      ru: (_, ep) => `Играть историю: Путь Кадана (Эп.${ep})`,
    },
  },
  // Left Today N/M
  {
    regex: /^Left Today (\d+)\/(\d+)$/,
    replace: {
      ja: (_, a, b) => `本日残り ${a}/${b}`,
      'zh-CN': (_, a, b) => `今日剩余 ${a}/${b}`,
      'zh-TW': (_, a, b) => `今日剩餘 ${a}/${b}`,
      es: (_, a, b) => `Restantes hoy ${a}/${b}`,
      fr: (_, a, b) => `Restant aujourd'hui ${a}/${b}`,
      de: (_, a, b) => `Heute übrig ${a}/${b}`,
      pt: (_, a, b) => `Restam hoje ${a}/${b}`,
      ru: (_, a, b) => `Осталось сегодня ${a}/${b}`,
    },
  },
  // Cooldown Ns
  {
    regex: /^Cooldown (\d+)s$/,
    replace: {
      ja: (_, s) => `待機時間 ${s}秒`,
      'zh-CN': (_, s) => `冷却 ${s}秒`,
      'zh-TW': (_, s) => `冷卻 ${s}秒`,
      es: (_, s) => `Espera ${s}s`,
      fr: (_, s) => `Recharge ${s}s`,
      de: (_, s) => `Abklingzeit ${s}s`,
      pt: (_, s) => `Recarga ${s}s`,
      ru: (_, s) => `Перезарядка ${s}с`,
    },
  },
  // Watch Ad (+NG) / ▶ Watch Video (+NG)
  {
    regex: /^(▶\s*)?Watch (?:Ad|Video) \(\+(\d+)G\)$/,
    replace: {
      ja: (_, p, g) => `${p || ''}広告視聴 (+${g}G)`,
      'zh-CN': (_, p, g) => `${p || ''}观看广告 (+${g}G)`,
      'zh-TW': (_, p, g) => `${p || ''}觀看廣告 (+${g}G)`,
      es: (_, p, g) => `${p || ''}Ver anuncio (+${g}G)`,
      fr: (_, p, g) => `${p || ''}Voir la pub (+${g}G)`,
      de: (_, p, g) => `${p || ''}Werbung ansehen (+${g}G)`,
      pt: (_, p, g) => `${p || ''}Ver anúncio (+${g}G)`,
      ru: (_, p, g) => `${p || ''}Смотреть рекламу (+${g}G)`,
    },
  },
  // 📖 Read EP.N Novel →
  {
    regex: /^📖 Read EP\.(\d+) Novel →$/,
    replace: {
      ja: (_, ep) => `📖 第${ep}話の小説を読む →`,
      'zh-CN': (_, ep) => `📖 阅读第${ep}章小说 →`,
      'zh-TW': (_, ep) => `📖 閱讀第${ep}話小說 →`,
      es: (_, ep) => `📖 Leer novela EP.${ep} →`,
      fr: (_, ep) => `📖 Lire le roman EP.${ep} →`,
      de: (_, ep) => `📖 Roman EP.${ep} lesen →`,
      pt: (_, ep) => `📖 Ler romance EP.${ep} →`,
      ru: (_, ep) => `📖 Читать роман Эп.${ep} →`,
    },
  },
  // ⚔ Battle EP.N
  {
    regex: /^⚔ Battle EP\.(\d+)$/,
    replace: {
      ja: (_, ep) => `⚔ 第${ep}話バトル`,
      'zh-CN': (_, ep) => `⚔ 第${ep}章对战`,
      'zh-TW': (_, ep) => `⚔ 第${ep}話對戰`,
      es: (_, ep) => `⚔ Batalla EP.${ep}`,
      fr: (_, ep) => `⚔ Combat EP.${ep}`,
      de: (_, ep) => `⚔ Kampf EP.${ep}`,
      pt: (_, ep) => `⚔ Batalha EP.${ep}`,
      ru: (_, ep) => `⚔ Бой Эп.${ep}`,
    },
  },
  // Craft X / Dust +Y
  {
    regex: /^Craft ([\d,]+) \/ Dust \+([\d,]+)$/,
    replace: {
      ja: (_, c, d) => `作成 ${c} / 還元 +${d}`,
      'zh-CN': (_, c, d) => `合成 ${c} / 分解 +${d}`,
      'zh-TW': (_, c, d) => `合成 ${c} / 分解 +${d}`,
      es: (_, c, d) => `Crear ${c} / Polvo +${d}`,
      fr: (_, c, d) => `Créer ${c} / Poussière +${d}`,
      de: (_, c, d) => `Herstellen ${c} / Staub +${d}`,
      pt: (_, c, d) => `Criar ${c} / Pó +${d}`,
      ru: (_, c, d) => `Создать ${c} / Пыль +${d}`,
    },
  },
  // Inspect <Name>
  {
    regex: /^Inspect (.+)$/,
    replace: {
      ja: (_, name) => `${name} を確認`,
      'zh-CN': (_, name) => `查看 ${name}`,
      'zh-TW': (_, name) => `查看 ${name}`,
      es: (_, name) => `Inspeccionar ${name}`,
      fr: (_, name) => `Inspecter ${name}`,
      de: (_, name) => `${name} untersuchen`,
      pt: (_, name) => `Inspecionar ${name}`,
      ru: (_, name) => `Осмотреть: ${name}`,
    },
  },
  // Your Secret: <Name>
  {
    regex: /^Your Secret: (.+)$/,
    replace: {
      ja: (_, name) => `自分の秘策: ${name}`,
      'zh-CN': (_, name) => `你的奥秘：${name}`,
      'zh-TW': (_, name) => `你的秘密：${name}`,
      es: (_, name) => `Tu secreto: ${name}`,
      fr: (_, name) => `Votre Secret : ${name}`,
      de: (_, name) => `Dein Geheimnis: ${name}`,
      pt: (_, name) => `Seu Segredo: ${name}`,
      ru: (_, name) => `Ваш секрет: ${name}`,
    },
  },
  // + View Other Quests (N)
  {
    regex: /^\+ View Other Quests \((\d+)\)$/,
    replace: {
      ja: (_, n) => `+ 他のクエストを見る (${n})`,
      'zh-CN': (_, n) => `+ 查看其他任务 (${n})`,
      'zh-TW': (_, n) => `+ 查看其他任務 (${n})`,
      es: (_, n) => `+ Ver otras misiones (${n})`,
      fr: (_, n) => `+ Voir d'autres quêtes (${n})`,
      de: (_, n) => `+ Weitere Quests (${n})`,
      pt: (_, n) => `+ Ver outras missões (${n})`,
      ru: (_, n) => `+ Другие задания (${n})`,
    },
  },
  // Select ($X.XX) →
  {
    regex: /^Select \(\$([\d.]+)\) →$/,
    replace: {
      ja: (_, p) => `選択 ($${p}) →`,
      'zh-CN': (_, p) => `选择 ($${p}) →`,
      'zh-TW': (_, p) => `選擇 ($${p}) →`,
      es: (_, p) => `Seleccionar ($${p}) →`,
      fr: (_, p) => `Choisir ($${p}) →`,
      de: (_, p) => `Auswählen ($${p}) →`,
      pt: (_, p) => `Selecionar ($${p}) →`,
      ru: (_, p) => `Выбрать ($${p}) →`,
    },
  },
  // N cards / N packs
  {
    regex: /^(\d+)\s*cards?$/i,
    replace: {
      ja: (_, n) => `${n}枚`,
      'zh-CN': (_, n) => `${n}张卡牌`,
      'zh-TW': (_, n) => `${n}張卡牌`,
      es: (_, n) => `${n} cartas`,
      fr: (_, n) => `${n} cartes`,
      de: (_, n) => `${n} Karten`,
      pt: (_, n) => `${n} cartas`,
      ru: (_, n) => `${n} карт`,
    },
  },
  {
    regex: /^(\d+)\s*packs?$/i,
    replace: {
      ja: (_, n) => `${n}パック`,
      'zh-CN': (_, n) => `${n}卡包`,
      'zh-TW': (_, n) => `${n}卡包`,
      es: (_, n) => `${n} sobres`,
      fr: (_, n) => `${n} paquets`,
      de: (_, n) => `${n} Packungen`,
      pt: (_, n) => `${n} pacotes`,
      ru: (_, n) => `${n} наб.`,
    },
  },
];

function er(n: string): string {
  return `${n}er`;
}

export function translateDynamicPattern(en: string, lang: HeroLanguage): string | null {
  if (lang === 'en' || lang === 'ko') return null;
  for (const rule of RULES) {
    const match = rule.regex.exec(en);
    if (match) {
      const fn = rule.replace[lang];
      if (fn) {
        return fn(...match);
      }
    }
  }
  return null;
}
