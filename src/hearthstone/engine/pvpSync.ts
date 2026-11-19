import { cardDb } from '../cardDb';
import {
  BattleMatchState,
  MinionInstance,
  PlayerBattleState,
  PlayerSide,
} from '../types';

export type PvpGuestAction =
  | {
      kind: 'MULLIGAN_CONFIRM';
      replaceUids: string[];
    }
  | {
      kind: 'PLAY_CARD';
      handUid: string;
      opts?: {
        targetId?: string;
        insertIndex?: number;
        chooseOptionIndex?: 0 | 1;
      };
    }
  | {
      kind: 'USE_HERO_POWER';
      targetId?: string;
    }
  | {
      kind: 'PERFORM_ATTACK';
      attackerId: string;
      defenderId: string;
    }
  | {
      kind: 'RESOLVE_TRACKING';
      cardId: string;
    }
  | {
      kind: 'END_TURN';
    }
  | {
      kind: 'CONCEDE';
    };

export function flipSide(side: PlayerSide): PlayerSide {
  return side === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
}

export function flipEntityId(entityId?: string): string | undefined {
  if (!entityId) return entityId;
  if (entityId === 'PLAYER_HERO') return 'OPPONENT_HERO';
  if (entityId === 'OPPONENT_HERO') return 'PLAYER_HERO';
  if (entityId === 'PLAYER_DECK') return 'OPPONENT_DECK';
  if (entityId === 'OPPONENT_DECK') return 'PLAYER_DECK';
  return entityId;
}

function mirrorMinion(m: MinionInstance, targetOwner: PlayerSide): MinionInstance {
  return {
    ...m,
    owner: targetOwner,
    blessingOfWisdomOwners: m.blessingOfWisdomOwners.map(flipSide),
    corruptionOwner: m.corruptionOwner ? flipSide(m.corruptionOwner) : null,
    nightmareDestroyOwnerTurn: m.nightmareDestroyOwnerTurn
      ? flipSide(m.nightmareDestroyOwnerTurn)
      : null,
  };
}

function mirrorPlayerState(p: PlayerBattleState, targetSide: PlayerSide): PlayerBattleState {
  return {
    ...p,
    side: targetSide,
    deck: [...p.deck],
    hand: p.hand.map((h) => ({ ...h })),
    board: p.board.map((m) => mirrorMinion(m, targetSide)),
    secrets: p.secrets.map((s) => ({ ...s })),
    graveyard: [...p.graveyard],
    weapon: p.weapon ? { ...p.weapon } : null,
  };
}

function swapTurnBanner(banner: string | null): string | null {
  if (!banner) return null;
  if (banner === '내 턴!') return '상대 턴';
  if (banner === '상대 턴') return '내 턴!';
  if (banner === 'YOUR TURN!') return 'ENEMY TURN';
  if (banner === 'ENEMY TURN') return 'YOUR TURN!';
  return banner;
}

/**
 * Converts Host's authoritative `BattleMatchState` (where Host = `PLAYER`, Guest = `OPPONENT`)
 * into Guest's local perspective (where Guest = `PLAYER`, Host = `OPPONENT`).
 */
export function mirrorMatchStateForGuest(hostState: BattleMatchState): BattleMatchState {
  const cloned = structuredClone(hostState);
  const nextPlayer = mirrorPlayerState(cloned.opponent, 'PLAYER');
  const nextOpponent = mirrorPlayerState(cloned.player, 'OPPONENT');

  return {
    ...cloned,
    activeSide: flipSide(cloned.activeSide),
    firstPlayer: flipSide(cloned.firstPlayer),
    winner: cloned.winner ? flipSide(cloned.winner) : null,
    player: nextPlayer,
    opponent: nextOpponent,
    mulliganSelectedUids: [],
    chooseOnePrompt:
      cloned.chooseOnePrompt && cloned.activeSide === 'OPPONENT'
        ? {
            ...cloned.chooseOnePrompt,
            options: cloned.chooseOnePrompt.options.map((opt) => ({
              ...opt,
              validTargets: opt.validTargets.map((t) => flipEntityId(t)!),
            })),
          }
        : null,
    trackingPrompt:
      cloned.trackingPrompt && cloned.activeSide === 'OPPONENT'
        ? { cards: [...cloned.trackingPrompt.cards] }
        : null,
    history: cloned.history.map((item) => {
      const mirroredSide = flipSide(item.actorSide);
      const def = cardDb.getCard(item.cardId);
      const isSecretCast =
        item.kind === 'CAST_SPELL' && Boolean(def?.mechanics.includes('SECRET'));
      return {
        ...item,
        actorSide: mirroredSide,
        isHiddenSecret: isSecretCast && mirroredSide === 'OPPONENT',
      };
    }),
    vfxQueue: cloned.vfxQueue.map((ev) => ({
      ...ev,
      sourceId: flipEntityId(ev.sourceId),
      targetId: flipEntityId(ev.targetId),
    })),
    bannerMessage: swapTurnBanner(cloned.bannerMessage),
    errorBanner: cloned.activeSide === 'OPPONENT' ? cloned.errorBanner : null,
    livePvpMeta: cloned.livePvpMeta
      ? {
          ...cloned.livePvpMeta,
          role: 'GUEST',
        }
      : undefined,
  };
}
