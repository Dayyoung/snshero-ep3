import { CLASSIC_PRESET_DECKS, cardDb } from '../hearthstone/cardDb';
import { CARD_SCRIPTS } from '../hearthstone/engine/cardEffects';
import {
  CLASSIC_EXPERT_AI_DECKS,
  computeNextAiAction,
  evaluateStateForAi,
} from '../hearthstone/engine/aiController';
import {
  createBattleMatch,
  createEngine,
  getHeroAttack,
  getMinionAttack,
  getMinionHealth,
  getMinionMaxHealth,
  hasMinionTaunt,
} from '../hearthstone/engine/GameEngine';
import {
  BattleMatchState,
  CLASSIC_HEROES,
  HERO_CLASS_ORDER,
  HeroClass,
  PlayerSide,
} from '../hearthstone/types';
import { FACTION_LABELS_EN, FACTION_LABELS_KO } from './benchmarkData';

export type SimPolicyId =
  | 'SNSHERO_EXPERT'
  | 'SNSHERO_NORMAL'
  | 'LOOKAHEAD_2PLY'
  | 'AGGRO_TEMPO'
  | 'CONTROL_VALUE'
  | 'RANDOM_LEGAL';

export interface LegalMcpAction {
  actionIndex: number;
  kind:
    | 'MULLIGAN_SMART'
    | 'MULLIGAN_KEEP_ALL'
    | 'CHOOSE_TRACKING'
    | 'PLAY_CARD'
    | 'HERO_POWER'
    | 'ATTACK'
    | 'END_TURN'
    | 'CONCEDE';
  handUid?: string;
  cardId?: string;
  targetId?: string;
  insertIndex?: number;
  chooseOptionIndex?: 0 | 1;
  attackerId?: string;
  defenderId?: string;
  trackingCardId?: string;
  labelKo: string;
  labelEn: string;
}

export interface SerializedMinionView {
  uid: string;
  cardId: string;
  name: string;
  attack: number;
  health: number;
  maxHealth: number;
  taunt: boolean;
  divineShield: boolean;
  stealth: boolean;
  windfury: boolean;
  poisonous: boolean;
  frozen: boolean;
  silenced: boolean;
  canAttackNow: boolean;
}

export interface SerializedHandCardView {
  uid: string;
  cardId: string;
  name: string;
  type: string;
  effectiveCost: number;
  baseCost: number;
  attack?: number;
  health?: number;
  text: string;
  canPlay: boolean;
}

export interface MatchObservation {
  matchId: string;
  agentId: string;
  phase: BattleMatchState['phase'];
  turnNumber: number;
  activeSide: PlayerSide;
  winner: PlayerSide | 'DRAW' | null;
  player: {
    faction: HeroClass;
    factionLabelKo: string;
    heroName: string;
    health: number;
    maxHealth: number;
    armor: number;
    attack: number;
    mana: number;
    maxMana: number;
    pendingOverload: number;
    weapon: { name: string; attack: number; durability: number } | null;
    heroPower: { name: string; text: string; usedThisTurn: boolean; canUse: boolean };
    deckRemaining: number;
    secretsActive: string[];
    hand: SerializedHandCardView[];
    board: SerializedMinionView[];
  };
  opponent: {
    faction: HeroClass;
    factionLabelKo: string;
    heroName: string;
    health: number;
    maxHealth: number;
    armor: number;
    attack: number;
    mana: number;
    maxMana: number;
    weapon: { name: string; attack: number; durability: number } | null;
    handCount: number;
    deckRemaining: number;
    secretCount: number;
    board: SerializedMinionView[];
  };
  recentHistory: Array<{ turn: number; actor: PlayerSide; title: string; detail: string }>;
  legalActions: LegalMcpAction[];
}

export interface ActiveMatchSession {
  matchId: string;
  agentId: string;
  modelName: string;
  seriesId?: string;
  opponentDifficulty: 'NORMAL' | 'EXPERT';
  createdAt: number;
  updatedAt: number;
  movesPlayed: number;
  manaAvailableTotal: number;
  manaSpentTotal: number;
  lethalChances: number;
  lethalConverted: number;
  reasoningLogs: Array<{ turn: number; actionLabel: string; reasoning?: string }>;
  state: BattleMatchState;
}

export interface BatchSimulationResult {
  gamesRun: number;
  playerPolicy: SimPolicyId;
  opponentPolicy: 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL';
  wins: number;
  losses: number;
  draws: number;
  winRatePct: number;
  calibratedElo: number;
  gameIqScore: number;
  avgTurns: number;
  firstPlayerWinRatePct: number;
  secondPlayerWinRatePct: number;
  totalDurationMs: number;
  matchesPerSec: number;
  avgDecisionMs: number;
  factionStats: Record<
    HeroClass,
    { games: number; wins: number; losses: number; winRatePct: number }
  >;
  sampleLogs: Array<{
    gameNo: number;
    playerClass: HeroClass;
    opponentClass: HeroClass;
    firstPlayer: PlayerSide;
    winner: 'PLAYER' | 'OPPONENT' | 'DRAW';
    turns: number;
    summaryKo: string;
    summaryEn: string;
  }>;
}

function stripTags(raw: string): string {
  return (raw || '').replace(/<[^>]+>/g, '').replace(/\[x\]/g, '').replace(/\s+/g, ' ').trim();
}

function describeTarget(state: BattleMatchState, targetId?: string): { ko: string; en: string } {
  if (!targetId) return { ko: '', en: '' };
  if (targetId === 'PLAYER_HERO') {
    return {
      ko: `내 영웅(${state.player.heroNameKo} HP:${state.player.health}+${state.player.armor})`,
      en: `Friendly Hero (HP:${state.player.health}+${state.player.armor})`,
    };
  }
  if (targetId === 'OPPONENT_HERO') {
    return {
      ko: `적 영웅(${state.opponent.heroNameKo} HP:${state.opponent.health}+${state.opponent.armor})`,
      en: `Enemy Hero (HP:${state.opponent.health}+${state.opponent.armor})`,
    };
  }
  const fm = state.player.board.find((m) => m.uid === targetId);
  if (fm) {
    return {
      ko: `아군 [${fm.name} ${getMinionAttack(fm)}/${getMinionHealth(fm)}]`,
      en: `Friendly [${fm.name} ${getMinionAttack(fm)}/${getMinionHealth(fm)}]`,
    };
  }
  const em = state.opponent.board.find((m) => m.uid === targetId);
  if (em) {
    return {
      ko: `적군 [${em.name} ${getMinionAttack(em)}/${getMinionHealth(em)}${hasMinionTaunt(em) ? ' 도발' : ''}]`,
      en: `Enemy [${em.name} ${getMinionAttack(em)}/${getMinionHealth(em)}${hasMinionTaunt(em) ? ' Taunt' : ''}]`,
    };
  }
  return { ko: targetId, en: targetId };
}

export function enumerateLegalActions(
  rawState: BattleMatchState,
  side: PlayerSide = 'PLAYER',
): LegalMcpAction[] {
  const actions: LegalMcpAction[] = [];
  if (rawState.phase === 'GAME_OVER') return actions;

  if (rawState.phase === 'MULLIGAN') {
    actions.push({
      actionIndex: 0,
      kind: 'MULLIGAN_SMART',
      labelKo: '멀리건 확정 (4코스트 이상 고비용 카드 자동 교체)',
      labelEn: 'Confirm Mulligan (Smart: replace cards costing 4+ mana)',
    });
    actions.push({
      actionIndex: 1,
      kind: 'MULLIGAN_KEEP_ALL',
      labelKo: '멀리건 확정 (현재 시작 손패 전체 유지)',
      labelEn: 'Confirm Mulligan (Keep all starting cards)',
    });
    return actions;
  }

  if (rawState.activeSide !== side) return actions;

  if (rawState.trackingPrompt && rawState.trackingPrompt.cards.length > 0) {
    rawState.trackingPrompt.cards.forEach((cid, idx) => {
      const def = cardDb.mustGetCard(cid);
      actions.push({
        actionIndex: idx,
        kind: 'CHOOSE_TRACKING',
        trackingCardId: cid,
        labelKo: `[추적 선택] ${def.name} (${def.cost}코스트) 손으로 가져오기`,
        labelEn: `[Tracking] Pick ${def.name} (${def.cost} mana)`,
      });
    });
    return actions;
  }

  const eng = createEngine(rawState);
  const me = side === 'PLAYER' ? rawState.player : rawState.opponent;

  // 1. Hand Cards
  for (const hc of me.hand) {
    const check = eng.inspectPlayability(side, hc);
    if (!check.canPlay) continue;
    const def = cardDb.mustGetCard(hc.cardId);
    const spec = CARD_SCRIPTS[def.id];
    const insertIdx = me.board.length;

    if (check.hasChooseOne && spec?.chooseOne) {
      for (const optIdx of [0, 1] as const) {
        const preview = createEngine(rawState);
        preview.playCardFromHand(side, hc.uid, { insertIndex: insertIdx });
        const opt = preview.state.chooseOnePrompt?.options[optIdx];
        const targets = opt && opt.needsTarget ? opt.validTargets : [undefined];
        for (const tid of targets) {
          const tDesc = describeTarget(rawState, tid);
          actions.push({
            actionIndex: actions.length,
            kind: 'PLAY_CARD',
            handUid: hc.uid,
            cardId: def.id,
            chooseOptionIndex: optIdx,
            targetId: tid,
            insertIndex: insertIdx,
            labelKo: `카드 사용: [${def.name}](${check.cost}코) - 선택${optIdx + 1}(${opt?.title || ''})${tid ? ` -> ${tDesc.ko}` : ''}`,
            labelEn: `Play [${def.name}](${check.cost}M) - Choose #${optIdx + 1}${tid ? ` -> ${tDesc.en}` : ''}`,
          });
        }
      }
      continue;
    }

    const targets = check.needsTarget ? check.validTargets : [undefined];
    for (const tid of targets) {
      const tDesc = describeTarget(rawState, tid);
      actions.push({
        actionIndex: actions.length,
        kind: 'PLAY_CARD',
        handUid: hc.uid,
        cardId: def.id,
        targetId: tid,
        insertIndex: insertIdx,
        labelKo: `카드 사용: [${def.name}] (${check.cost}코스트, ${def.type})${tid ? ` -> ${tDesc.ko}` : ''}`,
        labelEn: `Play [${def.name}] (${check.cost}M ${def.type})${tid ? ` -> ${tDesc.en}` : ''}`,
      });
    }
  }

  // 2. Hero Power
  const hpCheck = eng.inspectHeroPower(side);
  if (hpCheck.canUse) {
    const hpTargets = hpCheck.needsTarget ? hpCheck.validTargets : [undefined];
    for (const tid of hpTargets) {
      const tDesc = describeTarget(rawState, tid);
      actions.push({
        actionIndex: actions.length,
        kind: 'HERO_POWER',
        targetId: tid,
        labelKo: `영웅 능력: [${me.heroPowerNameKo}] (2코스트)${tid ? ` -> ${tDesc.ko}` : ''}`,
        labelEn: `Hero Power: [${me.heroPowerNameKo}] (2M)${tid ? ` -> ${tDesc.en}` : ''}`,
      });
    }
  }

  // 3. Attacks
  const attackerIds = [`${side}_HERO`, ...me.board.map((m) => m.uid)];
  for (const atkId of attackerIds) {
    const validTargets = eng.getValidAttackTargets(side, atkId);
    if (validTargets.length === 0) continue;
    const atkDesc =
      atkId === `${side}_HERO`
        ? {
            ko: `내 영웅(${getHeroAttack(me, true)}공)`,
            en: `Friendly Hero(${getHeroAttack(me, true)} ATK)`,
          }
        : describeTarget(rawState, atkId);

    for (const defId of validTargets) {
      const defDesc = describeTarget(rawState, defId);
      actions.push({
        actionIndex: actions.length,
        kind: 'ATTACK',
        attackerId: atkId,
        defenderId: defId,
        labelKo: `공격: ${atkDesc.ko} -> ${defDesc.ko}`,
        labelEn: `Attack: ${atkDesc.en} -> ${defDesc.en}`,
      });
    }
  }

  // 4. End Turn
  actions.push({
    actionIndex: actions.length,
    kind: 'END_TURN',
    labelKo: '턴 종료 (상대 AI 턴 진행)',
    labelEn: 'End Turn (Pass turn to SNSHero AI)',
  });

  return actions;
}

export function serializeMatchObservation(
  session: ActiveMatchSession,
): MatchObservation {
  const s = session.state;
  const eng = createEngine(s);
  const p = s.player;
  const o = s.opponent;

  return {
    matchId: session.matchId,
    agentId: session.agentId,
    phase: s.phase,
    turnNumber: s.turnNumber,
    activeSide: s.activeSide,
    winner: s.phase === 'GAME_OVER' ? s.winner || 'DRAW' : null,
    player: {
      faction: p.heroClass,
      factionLabelKo: FACTION_LABELS_KO[p.heroClass],
      heroName: p.heroNameKo,
      health: p.health,
      maxHealth: p.maxHealth,
      armor: p.armor,
      attack: getHeroAttack(p, s.activeSide === 'PLAYER'),
      mana: p.mana,
      maxMana: p.maxMana,
      pendingOverload: p.pendingOverload,
      weapon: p.weapon
        ? { name: p.weapon.name, attack: p.weapon.attack, durability: p.weapon.durability }
        : null,
      heroPower: {
        name: p.heroPowerNameKo,
        text: p.heroPowerTextKo,
        usedThisTurn: p.heroPowerUsedThisTurn,
        canUse: eng.inspectHeroPower('PLAYER').canUse,
      },
      deckRemaining: p.deck.length,
      secretsActive: p.secrets.map((sec) => sec.name),
      hand: p.hand.map((hc) => {
        const def = cardDb.mustGetCard(hc.cardId);
        const playInfo = eng.inspectPlayability('PLAYER', hc);
        return {
          uid: hc.uid,
          cardId: def.id,
          name: def.name,
          type: def.type,
          effectiveCost: playInfo.cost,
          baseCost: def.cost,
          attack: def.attack,
          health: def.health,
          text: stripTags(def.text),
          canPlay: playInfo.canPlay,
        };
      }),
      board: p.board.map((m) => ({
        uid: m.uid,
        cardId: m.cardId,
        name: m.name,
        attack: getMinionAttack(m),
        health: getMinionHealth(m),
        maxHealth: getMinionMaxHealth(m),
        taunt: hasMinionTaunt(m),
        divineShield: m.divineShield,
        stealth: m.stealth,
        windfury: m.windfury,
        poisonous: m.poisonous,
        frozen: m.frozen,
        silenced: m.silenced,
        canAttackNow: eng.canAttackerSwing('PLAYER', m.uid).ok,
      })),
    },
    opponent: {
      faction: o.heroClass,
      factionLabelKo: FACTION_LABELS_KO[o.heroClass],
      heroName: o.heroNameKo,
      health: o.health,
      maxHealth: o.maxHealth,
      armor: o.armor,
      attack: getHeroAttack(o, s.activeSide === 'OPPONENT'),
      mana: o.mana,
      maxMana: o.maxMana,
      weapon: o.weapon
        ? { name: o.weapon.name, attack: o.weapon.attack, durability: o.weapon.durability }
        : null,
      handCount: o.hand.length,
      deckRemaining: o.deck.length,
      secretCount: o.secrets.length,
      board: o.board.map((m) => ({
        uid: m.uid,
        cardId: m.cardId,
        name: m.name,
        attack: getMinionAttack(m),
        health: getMinionHealth(m),
        maxHealth: getMinionMaxHealth(m),
        taunt: hasMinionTaunt(m),
        divineShield: m.divineShield,
        stealth: m.stealth,
        windfury: m.windfury,
        poisonous: m.poisonous,
        frozen: m.frozen,
        silenced: m.silenced,
        canAttackNow: false,
      })),
    },
    recentHistory: s.history.slice(0, 10).map((h) => ({
      turn: h.turn,
      actor: h.actorSide,
      title: h.title,
      detail: h.detail,
    })),
    legalActions: enumerateLegalActions(s, 'PLAYER'),
  };
}

export function checkHasBoardLethal(state: BattleMatchState, side: PlayerSide): boolean {
  const me = side === 'PLAYER' ? state.player : state.opponent;
  const foe = side === 'PLAYER' ? state.opponent : state.player;
  if (foe.board.some((m) => !m.stealth && hasMinionTaunt(m))) return false;
  const eng = createEngine(state);
  let dmg = 0;
  if (eng.canAttackerSwing(side, `${side}_HERO`).ok) {
    dmg += getHeroAttack(me, true);
  }
  for (const m of me.board) {
    if (eng.canAttackerSwing(side, m.uid).ok) {
      const swings = Math.max(0, (m.windfury ? 2 : 1) - m.attacksMadeThisTurn);
      dmg += getMinionAttack(m) * swings;
    }
  }
  return dmg >= foe.health + foe.armor;
}

export function runAiTurnToCompletion(
  initialState: BattleMatchState,
  side: PlayerSide,
  difficulty: 'NORMAL' | 'EXPERT' = 'EXPERT',
  trimLogs = false,
): BattleMatchState {
  let state = initialState;
  let safety = 0;
  while (state.phase === 'PLAYING' && state.activeSide === side && safety < 32) {
    safety += 1;
    if (trimLogs) {
      state.vfxQueue.length = 0;
      state.history.length = 0;
    }
    if (state.trackingPrompt && state.trackingPrompt.cards.length > 0) {
      const eng = createEngine(state);
      const bestPick = [...state.trackingPrompt.cards].sort(
        (a, b) => cardDb.mustGetCard(b).cost - cardDb.mustGetCard(a).cost,
      )[0];
      state = eng.resolveTrackingChoice(bestPick);
      continue;
    }

    const act = computeNextAiAction(state, difficulty, side);
    const eng = createEngine(state);
    if (act.kind === 'END_TURN') {
      state = eng.endTurn();
      break;
    }
    if (act.kind === 'PLAY_CARD') {
      const prevLen = (side === 'PLAYER' ? state.player : state.opponent).hand.length;
      state = eng.playCardFromHand(side, act.handUid, {
        targetId: act.targetId,
        insertIndex: act.insertIndex,
        chooseOptionIndex: act.chooseOptionIndex,
      });
      const nextLen = (side === 'PLAYER' ? state.player : state.opponent).hand.length;
      if (nextLen === prevLen && state.phase === 'PLAYING') {
        state = eng.endTurn();
        break;
      }
    } else if (act.kind === 'HERO_POWER') {
      state = eng.useHeroPower(side, act.targetId);
    } else if (act.kind === 'ATTACK') {
      state = eng.performAttack(side, act.attackerId, act.defenderId);
    }
  }

  if (state.phase === 'PLAYING' && state.activeSide === side) {
    state = createEngine(state).endTurn();
  }
  if (trimLogs) {
    state.vfxQueue.length = 0;
    state.history.length = 0;
  }
  return state;
}

export function applyLegalAction(
  session: ActiveMatchSession,
  chosen: LegalMcpAction,
  reasoning?: string,
): ActiveMatchSession {
  let state = session.state;
  const eng = createEngine(state);

  session.movesPlayed += 1;
  session.updatedAt = Date.now();
  if (reasoning) {
    session.reasoningLogs.unshift({
      turn: state.turnNumber,
      actionLabel: chosen.labelKo,
      reasoning,
    });
    if (session.reasoningLogs.length > 30) session.reasoningLogs.length = 30;
  }

  if (chosen.kind === 'MULLIGAN_SMART' || chosen.kind === 'MULLIGAN_KEEP_ALL') {
    const replaceUids =
      chosen.kind === 'MULLIGAN_SMART'
        ? state.player.hand
            .filter((hc) => cardDb.mustGetCard(hc.cardId).cost >= 4)
            .map((hc) => hc.uid)
        : [];
    state = eng.confirmMulligan(replaceUids);
    if (state.phase === 'PLAYING' && state.activeSide === 'OPPONENT') {
      state = runAiTurnToCompletion(state, 'OPPONENT', session.opponentDifficulty);
    }
    session.state = state;
    return session;
  }

  if (chosen.kind === 'CHOOSE_TRACKING' && chosen.trackingCardId) {
    session.state = eng.resolveTrackingChoice(chosen.trackingCardId);
    return session;
  }

  if (chosen.kind === 'CONCEDE') {
    session.state = eng.concede('PLAYER');
    return session;
  }

  const hadLethalAtDecision = checkHasBoardLethal(state, 'PLAYER');

  if (chosen.kind === 'PLAY_CARD' && chosen.handUid) {
    const beforeMana = state.player.mana;
    state = eng.playCardFromHand('PLAYER', chosen.handUid, {
      targetId: chosen.targetId,
      insertIndex: chosen.insertIndex,
      chooseOptionIndex: chosen.chooseOptionIndex,
    });
    const spent = Math.max(0, beforeMana - state.player.mana);
    session.manaSpentTotal += spent;
  } else if (chosen.kind === 'HERO_POWER') {
    const beforeMana = state.player.mana;
    state = eng.useHeroPower('PLAYER', chosen.targetId);
    session.manaSpentTotal += Math.max(0, beforeMana - state.player.mana);
  } else if (chosen.kind === 'ATTACK' && chosen.attackerId && chosen.defenderId) {
    state = eng.performAttack('PLAYER', chosen.attackerId, chosen.defenderId);
    if (hadLethalAtDecision && state.phase === 'GAME_OVER' && state.winner === 'PLAYER') {
      session.lethalChances += 1;
      session.lethalConverted += 1;
    }
  } else if (chosen.kind === 'END_TURN') {
    if (hadLethalAtDecision) {
      session.lethalChances += 1;
    }
    session.manaAvailableTotal += state.player.maxMana;
    state = eng.endTurn();
    if (state.phase === 'PLAYING' && state.activeSide === 'OPPONENT') {
      state = runAiTurnToCompletion(state, 'OPPONENT', session.opponentDifficulty);
    }
  }

  session.state = state;
  return session;
}

export function createNewMatchSession(opts: {
  agentId?: string;
  modelName?: string;
  playerClass?: HeroClass | 'RANDOM';
  opponentClass?: HeroClass | 'RANDOM';
  opponentDifficulty?: 'NORMAL' | 'EXPERT';
  autoMulligan?: boolean;
  seriesId?: string;
}): ActiveMatchSession {
  const pClass: HeroClass =
    !opts.playerClass || opts.playerClass === 'RANDOM'
      ? HERO_CLASS_ORDER[Math.floor(Math.random() * HERO_CLASS_ORDER.length)]
      : opts.playerClass;
  const oClass: HeroClass =
    !opts.opponentClass || opts.opponentClass === 'RANDOM'
      ? HERO_CLASS_ORDER[Math.floor(Math.random() * HERO_CLASS_ORDER.length)]
      : opts.opponentClass;

  const difficulty = opts.opponentDifficulty || 'EXPERT';
  const playerDeck = CLASSIC_EXPERT_AI_DECKS[pClass]?.cards || CLASSIC_PRESET_DECKS[0].cards;
  const opponentDeck =
    difficulty === 'EXPERT'
      ? CLASSIC_EXPERT_AI_DECKS[oClass].cards
      : (CLASSIC_PRESET_DECKS.find((d) => d.heroClass === oClass) || CLASSIC_PRESET_DECKS[0]).cards;

  const rawState = createBattleMatch({
    mode: difficulty === 'EXPERT' ? 'PRACTICE_EXPERT' : 'PRACTICE_NORMAL',
    playerName: opts.modelName || opts.agentId || 'MCP Agent',
    playerClass: pClass,
    playerDeck: [...playerDeck],
    opponentName: `SNSHero ${difficulty} AI (${CLASSIC_HEROES[oClass].nameKo})`,
    opponentClass: oClass,
    opponentDeck: [...opponentDeck],
  });

  const session: ActiveMatchSession = {
    matchId: rawState.matchId,
    agentId: opts.agentId || 'mcp_agent',
    modelName: opts.modelName || opts.agentId || 'MCP Agent',
    seriesId: opts.seriesId,
    opponentDifficulty: difficulty,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    movesPlayed: 0,
    manaAvailableTotal: 0,
    manaSpentTotal: 0,
    lethalChances: 0,
    lethalConverted: 0,
    reasoningLogs: [],
    state: rawState,
  };

  if (opts.autoMulligan !== false) {
    const mulliganAct = enumerateLegalActions(session.state, 'PLAYER')[0];
    if (mulliganAct) {
      applyLegalAction(session, mulliganAct, 'Auto Smart Mulligan');
    }
  }

  return session;
}

function choosePolicyAction(
  state: BattleMatchState,
  side: PlayerSide,
  policy: SimPolicyId,
): LegalMcpAction | null {
  const legal = enumerateLegalActions(state, side);
  if (legal.length === 0) return null;

  if (policy === 'RANDOM_LEGAL') {
    const nonEnd = legal.filter((a) => a.kind !== 'END_TURN');
    if (nonEnd.length > 0 && Math.random() < 0.82) {
      return nonEnd[Math.floor(Math.random() * nonEnd.length)];
    }
    return legal[legal.length - 1];
  }

  if (policy === 'SNSHERO_EXPERT' || policy === 'SNSHERO_NORMAL') {
    const aiMove = computeNextAiAction(
      state,
      policy === 'SNSHERO_EXPERT' ? 'EXPERT' : 'NORMAL',
      side,
    );
    if (aiMove.kind === 'END_TURN') {
      return legal.find((l) => l.kind === 'END_TURN') || legal[legal.length - 1];
    }
    const matched = legal.find((l) => {
      if (aiMove.kind === 'PLAY_CARD' && l.kind === 'PLAY_CARD') {
        return (
          l.handUid === aiMove.handUid &&
          l.targetId === aiMove.targetId &&
          l.chooseOptionIndex === aiMove.chooseOptionIndex
        );
      }
      if (aiMove.kind === 'HERO_POWER' && l.kind === 'HERO_POWER') {
        return l.targetId === aiMove.targetId;
      }
      if (aiMove.kind === 'ATTACK' && l.kind === 'ATTACK') {
        return l.attackerId === aiMove.attackerId && l.defenderId === aiMove.defenderId;
      }
      return false;
    });
    return matched || legal.find((l) => l.kind === 'END_TURN') || legal[0];
  }

  // Policy scoring variants (LOOKAHEAD_2PLY, AGGRO_TEMPO, CONTROL_VALUE)
  const enemyHeroId = side === 'PLAYER' ? 'OPPONENT_HERO' : 'PLAYER_HERO';
  let bestAction: LegalMcpAction = legal[legal.length - 1];
  let bestScore = evaluateStateForAi(state, side) - 0.3;

  for (const cand of legal) {
    if (cand.kind === 'END_TURN' || cand.kind === 'CONCEDE') continue;
    const sim = createEngine(state);
    if (cand.kind === 'PLAY_CARD' && cand.handUid) {
      sim.playCardFromHand(side, cand.handUid, {
        targetId: cand.targetId,
        insertIndex: cand.insertIndex,
        chooseOptionIndex: cand.chooseOptionIndex,
      });
    } else if (cand.kind === 'HERO_POWER') {
      sim.useHeroPower(side, cand.targetId);
    } else if (cand.kind === 'ATTACK' && cand.attackerId && cand.defenderId) {
      sim.performAttack(side, cand.attackerId, cand.defenderId);
    } else if (cand.kind === 'CHOOSE_TRACKING' && cand.trackingCardId) {
      sim.resolveTrackingChoice(cand.trackingCardId);
    }

    let sc = evaluateStateForAi(sim.state, side) + 1.0;

    if (policy === 'AGGRO_TEMPO') {
      const foe = side === 'PLAYER' ? sim.state.opponent : sim.state.player;
      sc += (30 - foe.health) * 1.4;
      if (cand.defenderId === enemyHeroId) sc += 2.2;
    } else if (policy === 'CONTROL_VALUE') {
      const foe = side === 'PLAYER' ? sim.state.opponent : sim.state.player;
      sc -= foe.board.length * 2.8;
    } else if (policy === 'LOOKAHEAD_2PLY') {
      // 2-step greedy continuation bonus (simulates follow-up combo/lethal within the same turn!)
      if (sim.state.phase === 'PLAYING' && sim.state.activeSide === side) {
        const followUp = computeNextAiAction(sim.state, 'EXPERT', side);
        if (followUp.kind !== 'END_TURN') {
          const sim2 = createEngine(sim.state);
          if (followUp.kind === 'PLAY_CARD') {
            sim2.playCardFromHand(side, followUp.handUid, {
              targetId: followUp.targetId,
              insertIndex: followUp.insertIndex,
              chooseOptionIndex: followUp.chooseOptionIndex,
            });
          } else if (followUp.kind === 'HERO_POWER') {
            sim2.useHeroPower(side, followUp.targetId);
          } else if (followUp.kind === 'ATTACK') {
            sim2.performAttack(side, followUp.attackerId, followUp.defenderId);
          }
          sc = Math.max(sc, evaluateStateForAi(sim2.state, side) * 0.65 + sc * 0.35 + 1.2);
        }
      }
    }

    if (sc > bestScore) {
      bestScore = sc;
      bestAction = cand;
    }
  }

  return bestAction;
}

export function simulateSingleHeadlessGame(opts: {
  playerClass: HeroClass;
  opponentClass: HeroClass;
  playerPolicy: SimPolicyId;
  opponentPolicy: 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL';
  forceFirstPlayer?: PlayerSide;
}): {
  winner: 'PLAYER' | 'OPPONENT' | 'DRAW';
  turns: number;
  firstPlayer: PlayerSide;
  decisionsCount: number;
} {
  const pDeck = CLASSIC_EXPERT_AI_DECKS[opts.playerClass].cards;
  const oDeck =
    opts.opponentPolicy === 'SNSHERO_EXPERT'
      ? CLASSIC_EXPERT_AI_DECKS[opts.opponentClass].cards
      : (CLASSIC_PRESET_DECKS.find((d) => d.heroClass === opts.opponentClass) || CLASSIC_PRESET_DECKS[0])
          .cards;

  let state = createBattleMatch({
    mode: opts.opponentPolicy === 'SNSHERO_EXPERT' ? 'PRACTICE_EXPERT' : 'PRACTICE_NORMAL',
    playerName: opts.playerPolicy,
    playerClass: opts.playerClass,
    playerDeck: [...pDeck],
    opponentName: opts.opponentPolicy,
    opponentClass: opts.opponentClass,
    opponentDeck: [...oDeck],
  });

  if (opts.forceFirstPlayer && state.firstPlayer !== opts.forceFirstPlayer) {
    state.firstPlayer = opts.forceFirstPlayer;
    state.activeSide = opts.forceFirstPlayer;
  }

  // Smart Mulligan for both sides
  const replaceUids = state.player.hand
    .filter((hc) => cardDb.mustGetCard(hc.cardId).cost >= 4)
    .map((hc) => hc.uid);
  state = createEngine(state).confirmMulligan(replaceUids);

  let decisionsCount = 0;
  let halfTurnSafety = 0;

  while (state.phase === 'PLAYING' && halfTurnSafety < 90) {
    halfTurnSafety += 1;
    state.vfxQueue.length = 0;
    state.history.length = 0;
    if (state.activeSide === 'PLAYER') {
      if (opts.playerPolicy === 'SNSHERO_EXPERT' || opts.playerPolicy === 'SNSHERO_NORMAL') {
        decisionsCount += 3;
        state = runAiTurnToCompletion(
          state,
          'PLAYER',
          opts.playerPolicy === 'SNSHERO_EXPERT' ? 'EXPERT' : 'NORMAL',
          true,
        );
      } else {
        let stepGuard = 0;
        while (state.phase === 'PLAYING' && state.activeSide === 'PLAYER' && stepGuard < 28) {
          stepGuard += 1;
          decisionsCount += 1;
          state.vfxQueue.length = 0;
          state.history.length = 0;
          const chosen = choosePolicyAction(state, 'PLAYER', opts.playerPolicy);
          const eng = createEngine(state);
          if (!chosen || chosen.kind === 'END_TURN') {
            state = eng.endTurn();
            break;
          }
          if (chosen.kind === 'CHOOSE_TRACKING' && chosen.trackingCardId) {
            state = eng.resolveTrackingChoice(chosen.trackingCardId);
          } else if (chosen.kind === 'PLAY_CARD' && chosen.handUid) {
            const prevHand = state.player.hand.length;
            state = eng.playCardFromHand('PLAYER', chosen.handUid, {
              targetId: chosen.targetId,
              insertIndex: chosen.insertIndex,
              chooseOptionIndex: chosen.chooseOptionIndex,
            });
            if (state.player.hand.length === prevHand && state.phase === 'PLAYING') {
              state = eng.endTurn();
              break;
            }
          } else if (chosen.kind === 'HERO_POWER') {
            state = eng.useHeroPower('PLAYER', chosen.targetId);
          } else if (chosen.kind === 'ATTACK' && chosen.attackerId && chosen.defenderId) {
            state = eng.performAttack('PLAYER', chosen.attackerId, chosen.defenderId);
          } else {
            state = eng.endTurn();
            break;
          }
        }
        if (state.phase === 'PLAYING' && state.activeSide === 'PLAYER') {
          state = createEngine(state).endTurn();
        }
      }
    } else {
      decisionsCount += 3;
      state = runAiTurnToCompletion(
        state,
        'OPPONENT',
        opts.opponentPolicy === 'SNSHERO_EXPERT' ? 'EXPERT' : 'NORMAL',
        true,
      );
    }
  }

  const winner: 'PLAYER' | 'OPPONENT' | 'DRAW' =
    state.phase === 'GAME_OVER' && state.winner ? state.winner : 'DRAW';
  const turns = Math.max(1, Math.ceil(state.turnNumber / 2));

  return {
    winner,
    turns,
    firstPlayer: state.firstPlayer,
    decisionsCount: Math.max(1, decisionsCount),
  };
}

export function computeCalibratedEloAndIq(
  winRatePct: number,
  opponentPolicy: 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL',
): { elo: number; gameIq: number } {
  const anchorElo = opponentPolicy === 'SNSHERO_EXPERT' ? 1765 : 1520;
  const clampedW = Math.min(0.96, Math.max(0.04, winRatePct / 100));
  const eloDelta = 400 * Math.log10(clampedW / (1 - clampedW));
  const elo = Math.round(anchorElo + eloDelta);
  // Map Elo (1300..2150) cleanly onto SNSHero Tactical Game IQ (55..99)
  const gameIq = Number(
    Math.min(99.2, Math.max(50.0, 86.5 + (elo - 1765) * 0.0428)).toFixed(1),
  );
  return { elo, gameIq };
}

export async function runHeadlessSeriesAsync(opts: {
  games: number;
  playerPolicy: SimPolicyId;
  opponentPolicy?: 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL';
  fixedPlayerClass?: HeroClass;
  onProgress?: (done: number, total: number, winsSoFar: number) => void;
}): Promise<BatchSimulationResult> {
  const totalGames = Math.min(1000, Math.max(1, Math.floor(opts.games)));
  const oppPol = opts.opponentPolicy || 'SNSHERO_EXPERT';
  const t0 = performance.now();

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalTurns = 0;
  let totalDecisions = 0;
  let firstGames = 0;
  let firstWins = 0;
  let secondGames = 0;
  let secondWins = 0;

  const factionStats = {} as BatchSimulationResult['factionStats'];
  for (const cls of HERO_CLASS_ORDER) {
    factionStats[cls] = { games: 0, wins: 0, losses: 0, winRatePct: 0 };
  }

  const sampleLogs: BatchSimulationResult['sampleLogs'] = [];

  for (let i = 0; i < totalGames; i++) {
    const pClass =
      opts.fixedPlayerClass || HERO_CLASS_ORDER[i % HERO_CLASS_ORDER.length];
    const oClass =
      HERO_CLASS_ORDER[(Math.floor(i / HERO_CLASS_ORDER.length) + i + 3) % HERO_CLASS_ORDER.length];
    const firstSide: PlayerSide = i % 2 === 0 ? 'PLAYER' : 'OPPONENT';

    const res = simulateSingleHeadlessGame({
      playerClass: pClass,
      opponentClass: oClass,
      playerPolicy: opts.playerPolicy,
      opponentPolicy: oppPol,
      forceFirstPlayer: firstSide,
    });

    totalTurns += res.turns;
    totalDecisions += res.decisionsCount;
    factionStats[pClass].games += 1;

    if (res.firstPlayer === 'PLAYER') {
      firstGames += 1;
      if (res.winner === 'PLAYER') firstWins += 1;
    } else {
      secondGames += 1;
      if (res.winner === 'PLAYER') secondWins += 1;
    }

    if (res.winner === 'PLAYER') {
      wins += 1;
      factionStats[pClass].wins += 1;
    } else if (res.winner === 'OPPONENT') {
      losses += 1;
      factionStats[pClass].losses += 1;
    } else {
      draws += 1;
    }

    if (sampleLogs.length < 12 || i >= totalGames - 4) {
      sampleLogs.push({
        gameNo: i + 1,
        playerClass: pClass,
        opponentClass: oClass,
        firstPlayer: res.firstPlayer,
        winner: res.winner,
        turns: res.turns,
        summaryKo: `#${i + 1} [${FACTION_LABELS_KO[pClass]}] vs [${FACTION_LABELS_KO[oClass]}] — ${res.turns}턴 ${res.winner === 'PLAYER' ? '승리' : res.winner === 'OPPONENT' ? '패배' : '무승부'} (${res.firstPlayer === 'PLAYER' ? '선공' : '후공+동전'})`,
        summaryEn: `#${i + 1} [${FACTION_LABELS_EN[pClass]}] vs [${FACTION_LABELS_EN[oClass]}] — ${res.turns}T ${res.winner} (${res.firstPlayer === 'PLAYER' ? '1st' : '2nd+Coin'})`,
      });
      if (sampleLogs.length > 16) sampleLogs.shift();
    }

    if (opts.onProgress && ((i + 1) % 10 === 0 || i + 1 === totalGames)) {
      opts.onProgress(i + 1, totalGames, wins);
      await new Promise((r) => setTimeout(r, 0));
    } else if ((i + 1) % 25 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const totalDurationMs = Math.max(1, performance.now() - t0);
  const winRatePct = Number(((wins / totalGames) * 100).toFixed(1));
  const { elo, gameIq } = computeCalibratedEloAndIq(winRatePct, oppPol);

  for (const cls of HERO_CLASS_ORDER) {
    const fs = factionStats[cls];
    fs.winRatePct = fs.games > 0 ? Number(((fs.wins / fs.games) * 100).toFixed(1)) : 0;
  }

  return {
    gamesRun: totalGames,
    playerPolicy: opts.playerPolicy,
    opponentPolicy: oppPol,
    wins,
    losses,
    draws,
    winRatePct,
    calibratedElo: elo,
    gameIqScore: gameIq,
    avgTurns: Number((totalTurns / totalGames).toFixed(1)),
    firstPlayerWinRatePct:
      firstGames > 0 ? Number(((firstWins / firstGames) * 100).toFixed(1)) : 50,
    secondPlayerWinRatePct:
      secondGames > 0 ? Number(((secondWins / secondGames) * 100).toFixed(1)) : 50,
    totalDurationMs: Number(totalDurationMs.toFixed(1)),
    matchesPerSec: Number(((totalGames / totalDurationMs) * 1000).toFixed(1)),
    avgDecisionMs: Number((totalDurationMs / Math.max(1, totalDecisions)).toFixed(3)),
    factionStats,
    sampleLogs,
  };
}
