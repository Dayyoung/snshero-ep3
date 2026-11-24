// SNSHero: Card Duel Demo — GDevelop 5 Runtime Event Script
// Target resolution: 1280x720 (Landscape 16:9, responsive)
// Uses GDevelop Cloud objects: Bg, Logo, Unit, Card, UiElem, GameText
// Uses GDevelop Cloud audio: bgm_duel.mp3, sfx_pack_open.mp3, sfx_card_flip.mp3, sfx_card_place.mp3, sfx_attack.mp3, sfx_victory.mp3

(function (runtimeScene) {
  const W = 1280;
  const H = 720;
  const CTA_URL = "https://snshero.com/game.html?utm_source=gdgames&utm_medium=promo_demo";

  // Helper to get/init persistent scene state
  if (!runtimeScene._snsDemo) {
    runtimeScene._snsDemo = {
      initialized: false,
      lang: "en",
      phase: "PACK_IDLE", // PACK_IDLE | PACK_REVEAL | DUEL | RESULT
      phaseTime: 0,
      prevDown: false,
      bgmStarted: false,
      // Pack reveal
      packOpenedAt: 0,
      flipped: [false, false, false],
      // Duel state
      turn: 1,
      isPlayerTurn: true,
      mana: 3,
      maxMana: 3,
      heroPowerUsed: false,
      playerHp: 15,
      playerMaxHp: 15,
      bossHp: 14,
      bossMaxHp: 14,
      selectedMinionIdx: -1,
      enemyStepTimer: 0,
      enemyStepPhase: 0,
      bannerTimer: 0,
      bannerEn: "",
      bannerKo: "",
      shakeTime: 0,
      shakeAmp: 0,
      resultWin: false,
      hand: [],
      playerBoard: [],
      enemyBoard: [],
      fxList: [],
      lungeAnim: null,
      pool: { sprites: [], texts: [] },
      clickZones: [],
    };
  }

  const S = runtimeScene._snsDemo;
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000 || 0.016);
  S.phaseTime += dt;
  if (S.bannerTimer > 0) S.bannerTimer = Math.max(0, S.bannerTimer - dt);
  if (S.shakeTime > 0) S.shakeTime = Math.max(0, S.shakeTime - dt);

  const CARDS = {
    ivar: {
      id: "ivar",
      anim: "_ivar",
      type: "MINION",
      cost: 2,
      atk: 4,
      hp: 4,
      charge: true,
      nameEn: "Ivar, Arcane Duke",
      nameKo: "마도공작 이바르",
      descEn: "Charge (Attacks right away)",
      descKo: "돌진 (소환 즉시 공격)",
    },
    poseidon: {
      id: "poseidon",
      anim: "_poseidon",
      type: "MINION",
      cost: 3,
      atk: 5,
      hp: 6,
      charge: false,
      nameEn: "Poseidon, Sea Lord",
      nameKo: "바다신 포세이돈",
      descEn: "Abyssal Guardian (5/6)",
      descKo: "심연의 수호신 (5/6)",
    },
    holyblast: {
      id: "holyblast",
      anim: "_holyblast",
      type: "SPELL",
      cost: 2,
      dmg: 6,
      heal: 3,
      nameEn: "Dawnstar Blast",
      nameKo: "새벽별 성광폭발",
      descEn: "Deal 6 to ALL & Heal +3",
      descKo: "적 전체 6 피해 & 치유 +3",
    },
    fenrir: {
      id: "fenrir",
      anim: "_fenrir",
      type: "MINION",
      cost: 4,
      atk: 6,
      hp: 6,
      charge: true,
      nameEn: "Fenrir, Frost King",
      nameKo: "빙결늑대왕 펜릴",
      descEn: "Charge · Frost Finisher",
      descKo: "돌진 · 설원 피니셔",
    },
  };

  function tr(en, ko) {
    return S.lang === "ko" ? ko : en;
  }

  function playSfx(name, vol) {
    try {
      runtimeScene.getSoundManager().playSound(name, false, vol || 80, 1);
    } catch (e) {}
  }

  function ensureBgm() {
    if (S.bgmStarted) return;
    S.bgmStarted = true;
    try {
      runtimeScene.getSoundManager().playMusicOnChannel("bgm_duel.mp3", 0, true, 32, 1);
    } catch (e) {}
  }

  function setBanner(en, ko, duration) {
    S.bannerEn = en;
    S.bannerKo = ko;
    S.bannerTimer = duration || 2.6;
  }

  function spawnPopup(x, y, text, color) {
    S.fxList.push({ kind: "text", x, y, text, color: color || "254;240;138", t: 0, maxT: 0.9 });
  }

  function spawnSlash(x, y) {
    S.fxList.push({ kind: "slash", x, y, t: 0, maxT: 0.36 });
  }

  function triggerShake(amp, time) {
    S.shakeAmp = Math.max(S.shakeAmp, amp);
    S.shakeTime = Math.max(S.shakeTime, time);
  }

  function startPackAltar() {
    S.phase = "PACK_IDLE";
    S.phaseTime = 0;
    S.flipped = [false, false, false];
    S.bannerTimer = 0;
  }

  function openPack() {
    ensureBgm();
    playSfx("sfx_pack_open.mp3", 85);
    S.phase = "PACK_REVEAL";
    S.phaseTime = 0;
    S.packOpenedAt = 0;
    S.flipped = [false, false, false];
    triggerShake(6, 0.22);
  }

  function startDuel() {
    ensureBgm();
    playSfx("sfx_card_place.mp3", 80);
    S.phase = "DUEL";
    S.phaseTime = 0;
    S.turn = 1;
    S.isPlayerTurn = true;
    S.mana = 3;
    S.maxMana = 3;
    S.heroPowerUsed = false;
    S.playerHp = 15;
    S.playerMaxHp = 15;
    S.bossHp = 14;
    S.bossMaxHp = 14;
    S.selectedMinionIdx = -1;
    S.enemyStepTimer = 0;
    S.enemyStepPhase = 0;
    S.lungeAnim = null;
    S.hand = [
      { ...CARDS.ivar },
      { ...CARDS.poseidon },
      { ...CARDS.holyblast },
    ];
    S.playerBoard = [];
    S.enemyBoard = [
      {
        uid: "scarecrow",
        objType: "Unit",
        anim: "minion_scarecrow",
        nameEn: "Iron Scarecrow",
        nameKo: "강철 허수아비",
        atk: 2,
        hp: 4,
        maxHp: 4,
      },
    ];
    setBanner(
      "Turn 1: Play a card from your hand!",
      "1턴: 손패에서 카드를 클릭해 소환하거나 시전하세요!",
      3.5
    );
  }

  function finishGame(win) {
    S.phase = "RESULT";
    S.phaseTime = 0;
    S.resultWin = win;
    S.selectedMinionIdx = -1;
    if (win) {
      playSfx("sfx_victory.mp3", 90);
      triggerShake(10, 0.35);
    } else {
      playSfx("sfx_attack.mp3", 85);
    }
  }

  function checkEndConditions() {
    if (S.bossHp <= 0) {
      S.bossHp = 0;
      finishGame(true);
      return true;
    }
    if (S.playerHp <= 0) {
      S.playerHp = 0;
      finishGame(false);
      return true;
    }
    return false;
  }

  function playHandCard(idx) {
    if (!S.isPlayerTurn || S.phase !== "DUEL") return;
    const card = S.hand[idx];
    if (!card) return;
    if (S.mana < card.cost) {
      setBanner("Not enough Mana!", "마나가 부족합니다!", 1.8);
      return;
    }
    S.mana -= card.cost;
    S.hand.splice(idx, 1);
    S.selectedMinionIdx = -1;

    if (card.type === "MINION") {
      playSfx("sfx_card_place.mp3", 85);
      const newMinion = {
        uid: card.id + "_" + Math.random().toString(36).slice(2, 6),
        objType: "Card",
        anim: card.anim,
        nameEn: card.nameEn,
        nameKo: card.nameKo,
        atk: card.atk,
        hp: card.hp,
        maxHp: card.hp,
        canAttack: !!card.charge,
      };
      S.playerBoard.push(newMinion);
      if (card.charge) {
        setBanner(
          card.nameEn + " has Charge! Click it to attack!",
          card.nameKo + " 돌진! 클릭한 뒤 적을 공격하세요!",
          2.8
        );
      } else {
        setBanner(
          "Summoned " + card.nameEn + "!",
          card.nameKo + " 소환 완료!",
          2.0
        );
      }
    } else if (card.type === "SPELL") {
      playSfx("sfx_attack.mp3", 95);
      triggerShake(9, 0.3);
      // AoE damage to all enemy minions + Boss Lucian, plus Heal Hero
      const dmg = card.dmg;
      for (let i = S.enemyBoard.length - 1; i >= 0; i--) {
        const em = S.enemyBoard[i];
        em.hp -= dmg;
        const pos = getEnemyBoardPos(i, S.enemyBoard.length);
        spawnSlash(pos.x, pos.y);
        spawnPopup(pos.x, pos.y - 35, "-" + dmg, "252;165;165");
        if (em.hp <= 0) {
          S.enemyBoard.splice(i, 1);
        }
      }
      S.bossHp = Math.max(0, S.bossHp - dmg);
      spawnSlash(640, 120);
      spawnPopup(640, 70, "-" + dmg + "!", "254;240;138");

      const oldHp = S.playerHp;
      S.playerHp = Math.min(S.playerMaxHp, S.playerHp + card.heal);
      const healed = S.playerHp - oldHp;
      if (healed > 0) {
        spawnPopup(180, 520, "+" + healed + " HP", "74;222;128");
      }
      setBanner(
        "Dawnstar Holy Blast! -" + dmg + " to ALL enemies!",
        "새벽별 성광폭발! 적 전체 피해 " + dmg + "!",
        2.6
      );
      checkEndConditions();
    }
  }

  function useHeroPower() {
    if (!S.isPlayerTurn || S.phase !== "DUEL" || S.heroPowerUsed) return;
    if (S.mana < 2) {
      setBanner("Need 2 Mana for Snowfield Heal!", "설원 치유에는 마나 2가 필요합니다!", 1.8);
      return;
    }
    S.mana -= 2;
    S.heroPowerUsed = true;
    playSfx("sfx_card_place.mp3", 80);
    const oldHp = S.playerHp;
    S.playerHp = Math.min(S.playerMaxHp, S.playerHp + 3);
    spawnPopup(180, 520, "+" + (S.playerHp - oldHp || 3) + " HP", "74;222;128");
    setBanner("Snowfield Heal: Restored 3 HP!", "설원 치유: 생명력 +3 회복!", 2.0);
  }

  function attackWithMinion(mIdx, targetType, enemyIdx) {
    const m = S.playerBoard[mIdx];
    if (!m || !m.canAttack) return;
    m.canAttack = false;
    S.selectedMinionIdx = -1;
    playSfx("sfx_attack.mp3", 90);
    triggerShake(8, 0.24);

    const srcPos = getPlayerBoardPos(mIdx, S.playerBoard.length);
    if (targetType === "BOSS") {
      S.lungeAnim = { sx: srcPos.x, sy: srcPos.y, tx: 640, ty: 120, t: 0, maxT: 0.24, uid: m.uid };
      S.bossHp = Math.max(0, S.bossHp - m.atk);
      spawnSlash(640, 120);
      spawnPopup(640, 70, "-" + m.atk + "!", "254;240;138");
      setBanner(m.nameEn + " strikes Boss Lucian for " + m.atk + "!", m.nameKo + " 공격! 루시안 -" + m.atk + "!", 2.2);
      checkEndConditions();
    } else if (targetType === "MINION") {
      const em = S.enemyBoard[enemyIdx];
      if (!em) return;
      const dstPos = getEnemyBoardPos(enemyIdx, S.enemyBoard.length);
      S.lungeAnim = { sx: srcPos.x, sy: srcPos.y, tx: dstPos.x, ty: dstPos.y, t: 0, maxT: 0.24, uid: m.uid };
      em.hp -= m.atk;
      m.hp -= em.atk;
      spawnSlash(dstPos.x, dstPos.y);
      spawnPopup(dstPos.x, dstPos.y - 30, "-" + m.atk, "252;165;165");
      if (em.atk > 0) {
        spawnPopup(srcPos.x, srcPos.y - 30, "-" + em.atk, "252;165;165");
      }
      if (em.hp <= 0) S.enemyBoard.splice(enemyIdx, 1);
      if (m.hp <= 0) S.playerBoard.splice(mIdx, 1);
      setBanner("Minion clash!", "하수인 격돌!", 1.8);
    }
  }

  function endPlayerTurn() {
    if (!S.isPlayerTurn || S.phase !== "DUEL") return;
    S.isPlayerTurn = false;
    S.selectedMinionIdx = -1;
    S.enemyStepPhase = 0;
    S.enemyStepTimer = 0.55;
    playSfx("sfx_card_flip.mp3", 70);
    setBanner("Abyssal Knight Lucian's Turn...", "심연 기사 루시안의 턴...", 2.2);
  }

  function stepEnemyTurn() {
    S.enemyStepTimer -= dt;
    if (S.enemyStepTimer > 0) return;

    if (S.enemyStepPhase === 0) {
      // Enemy minions attack Hero Kadan
      if (S.enemyBoard.length > 0) {
        let totalDmg = 0;
        for (const em of S.enemyBoard) {
          totalDmg += em.atk;
        }
        if (totalDmg > 0) {
          playSfx("sfx_attack.mp3", 85);
          triggerShake(7, 0.22);
          S.playerHp = Math.max(0, S.playerHp - totalDmg);
          spawnSlash(180, 565);
          spawnPopup(180, 510, "-" + totalDmg + "!", "248;113;113");
          if (checkEndConditions()) return;
        }
      }
      S.enemyStepPhase = 1;
      S.enemyStepTimer = 0.65;
      return;
    }

    if (S.enemyStepPhase === 1) {
      // Boss Lucian summons Thunder God Raijin on Turn 1 (or Abyssal Strike on Turn 2+)
      if (S.turn === 1 && S.enemyBoard.length < 3) {
        playSfx("sfx_card_place.mp3", 85);
        S.enemyBoard.push({
          uid: "raijin_" + S.turn,
          objType: "Card",
          anim: "_raijin",
          nameEn: "Thunder God Raijin",
          nameKo: "천둥괴신 뇌신",
          atk: 4,
          hp: 4,
          maxHp: 4,
        });
        setBanner("Lucian summons Thunder God Raijin (4/4)!", "루시안이 천둥괴신 뇌신(4/4)을 소환했습니다!", 2.5);
      } else {
        playSfx("sfx_attack.mp3", 80);
        S.playerHp = Math.max(0, S.playerHp - 3);
        spawnSlash(180, 565);
        spawnPopup(180, 510, "-3!", "248;113;113");
        setBanner("Lucian casts Abyssal Bolt (-3 HP)!", "루시안의 심연 암흑탄 (-3 HP)!", 2.2);
        if (checkEndConditions()) return;
      }
      S.enemyStepPhase = 2;
      S.enemyStepTimer = 0.75;
      return;
    }

    // Start next Player Turn!
    S.turn += 1;
    S.isPlayerTurn = true;
    S.maxMana = Math.min(10, S.turn * 3);
    S.mana = S.maxMana;
    S.heroPowerUsed = false;
    for (const pm of S.playerBoard) {
      pm.canAttack = true;
    }
    if (S.turn === 2) {
      S.hand.push({ ...CARDS.fenrir });
      playSfx("sfx_card_flip.mp3", 85);
      setBanner(
        "Turn 2: Drew Fenrir, Frost King (6/6 Charge)! Finish Lucian!",
        "2턴: 빙결늑대왕 펜릴(6/6 돌진) 드로우! 루시안을 쓰러트리세요!",
        3.8
      );
    } else {
      playSfx("sfx_card_flip.mp3", 75);
      setBanner("Turn " + S.turn + ": Your move!", S.turn + "턴: 공격하세요!", 2.4);
    }
  }

  function getEnemyBoardPos(idx, total) {
    const gap = 175;
    const startX = 640 - ((total - 1) * gap) / 2;
    return { x: startX + idx * gap, y: 254 };
  }

  function getPlayerBoardPos(idx, total) {
    const gap = 175;
    const startX = 640 - ((total - 1) * gap) / 2;
    return { x: startX + idx * gap, y: 418 };
  }

  // --- Object Pool Render Helpers ---
  function beginFrameRender() {
    S.clickZones = [];
    for (const sp of S.pool.sprites) {
      sp.used = false;
    }
    for (const tx of S.pool.texts) {
      tx.used = false;
    }
  }

  function drawSprite(objName, animName, cx, cy, w, h, z, opts) {
    let slot = S.pool.sprites.find((s) => !s.used && s.objName === objName);
    if (!slot) {
      const obj = runtimeScene.createObject(objName);
      if (!obj) return null;
      slot = { objName, obj, used: true };
      S.pool.sprites.push(slot);
    }
    slot.used = true;
    const o = slot.obj;
    o.hide(false);
    if (typeof animName === "number") {
      if (o.getAnimationIndex() !== animName) {
        o.setAnimationIndex(animName);
      }
    } else if (o.getAnimationName() !== animName) {
      o.setAnimationName(animName);
    }
    o.pauseAnimation();
    o.setWidth(w);
    o.setHeight(h);
    o.setPosition(cx - w / 2, cy - h / 2);
    o.setZOrder(z);
    o.setOpacity(opts && opts.opacity !== undefined ? opts.opacity : 255);
    o.setAngle(opts && opts.angle !== undefined ? opts.angle : 0);
    if (opts && opts.onClick) {
      S.clickZones.push({ obj: o, z, fn: opts.onClick });
    }
    return o;
  }

  function drawText(str, cx, cy, wrapW, size, color, z, opts) {
    let slot = S.pool.texts.find((t) => !t.used);
    if (!slot) {
      const obj = runtimeScene.createObject("GameText");
      if (!obj) return null;
      slot = { obj, used: true };
      S.pool.texts.push(slot);
    }
    slot.used = true;
    const t = slot.obj;
    t.hide(false);
    t.setString(String(str));
    t.setCharacterSize(size || 20);
    t.setColor(color || "255;255;255");
    t.setBold(opts && opts.bold !== undefined ? opts.bold : true);
    t.setTextAlignment((opts && opts.align) || "center");
    t.setWrapping(true);
    t.setWrappingWidth(wrapW || 400);
    t.setOutline("10;15;28", (opts && opts.outline) !== undefined ? opts.outline : 3);
    t.setOutlineEnabled(true);
    t.setOpacity(opts && opts.opacity !== undefined ? opts.opacity : 255);
    t.setZOrder(z);
    const align = (opts && opts.align) || "center";
    const xPos = align === "left" ? cx : align === "right" ? cx - wrapW : cx - wrapW / 2;
    t.setPosition(xPos, cy - (size || 20) * 0.62);
    return t;
  }

  function endFrameRender() {
    for (const sp of S.pool.sprites) {
      if (!sp.used) sp.obj.hide(true);
    }
    for (const tx of S.pool.texts) {
      if (!tx.used) tx.obj.hide(true);
    }
  }

  // --- Update Lunge & FX ---
  if (S.lungeAnim) {
    S.lungeAnim.t += dt;
    if (S.lungeAnim.t >= S.lungeAnim.maxT) {
      S.lungeAnim = null;
    }
  }
  for (let i = S.fxList.length - 1; i >= 0; i--) {
    S.fxList[i].t += dt;
    if (S.fxList[i].t >= S.fxList[i].maxT) {
      S.fxList.splice(i, 1);
    }
  }

  if (S.phase === "DUEL" && !S.isPlayerTurn) {
    stepEnemyTurn();
  }

  // Camera shake offset
  const sx = S.shakeTime > 0 ? (Math.random() - 0.5) * 2 * S.shakeAmp : 0;
  const sy = S.shakeTime > 0 ? (Math.random() - 0.5) * 2 * S.shakeAmp : 0;
  try {
    const layer = runtimeScene.getLayer("");
    layer.setCameraX(W / 2 + sx);
    layer.setCameraY(H / 2 + sy);
  } catch (e) {}

  // --- Render Current Phase ---
  beginFrameRender();

  // Language Toggle (always top-right)
  drawSprite("UiElem", "btn_slate", 1185, 36, 150, 40, 80, {
    onClick: () => {
      S.lang = S.lang === "en" ? "ko" : "en";
      playSfx("sfx_card_flip.mp3", 55);
    },
  });
  drawText(S.lang === "en" ? "🌐 EN / 한국어" : "🌐 한국어 / EN", 1185, 36, 145, 16, "226;232;240", 81);

  if (S.phase === "PACK_IDLE" || S.phase === "PACK_REVEAL") {
    drawSprite("Bg", 0, 640, 360, 1280, 720, 0);
    const bob = Math.sin(S.phaseTime * 2.4) * 5;
    drawSprite("Logo", S.lang === "ko" ? "ko" : "en", 640, 84 + bob * 0.5, 340, 112, 10);

    if (S.phase === "PACK_IDLE") {
      drawText(
        tr("ELWIN SANCTUARY HERO PACK · FREE PREVIEW", "엘윈 성소 영웅 카드팩 · 무료 체험판"),
        640,
        172,
        820,
        24,
        "253;224;71",
        12
      );
      const pulse = 1 + Math.sin(S.phaseTime * 4) * 0.04;
      drawSprite("UiElem", "card_glow", 640, 375 + bob, 290 * pulse, 395 * pulse, 15, {
        opacity: 185 + Math.sin(S.phaseTime * 4) * 55,
      });
      drawSprite("Card", "back_sanctuary", 640, 375 + bob, 246 * pulse, 342 * pulse, 20, {
        onClick: openPack,
      });
      drawSprite("UiElem", "btn_gold", 640, 616, 390, 66, 25, {
        onClick: openPack,
      });
      drawText(
        tr("✨ TAP TO OPEN FREE PACK!", "✨ 터치하여 무료 카드팩 열기!"),
        640,
        616,
        370,
        22,
        "255;255;255",
        26
      );
    } else {
      // PACK_REVEAL
      const revealCards = [CARDS.ivar, CARDS.poseidon, CARDS.holyblast];
      const revealTimes = [0.1, 0.42, 0.74];
      const xs = [300, 640, 980];
      drawText(
        tr("🎉 HEROIC CARDS UNLOCKED!", "🎉 전설 & 시그니처 카드 획득!"),
        640,
        166,
        760,
        26,
        "253;224;71",
        15
      );
      for (let i = 0; i < 3; i++) {
        const c = revealCards[i];
        const unlocked = S.phaseTime >= revealTimes[i];
        if (unlocked && !S.flipped[i]) {
          S.flipped[i] = true;
          playSfx("sfx_card_flip.mp3", 85);
        }
        const cy = 355 + Math.sin(S.phaseTime * 2.5 + i) * 4;
        if (unlocked) {
          drawSprite("UiElem", "card_glow", xs[i], cy, 260, 355, 18, { opacity: 190 });
          drawSprite("Card", c.anim, xs[i], cy, 224, 310, 20);
          drawText(tr(c.nameEn, c.nameKo), xs[i], 534, 240, 19, "255;255;255", 22);
          drawText(tr(c.descEn, c.descKo), xs[i], 560, 250, 14, "148;163;184", 22);
        } else {
          drawSprite("Card", "back_sanctuary", xs[i], cy, 224, 310, 20);
        }
      }
      if (S.phaseTime >= 0.9) {
        const btnPulse = 1 + Math.sin(S.phaseTime * 4) * 0.03;
        drawSprite("UiElem", "btn_gold", 640, 640, 410 * btnPulse, 68 * btnPulse, 30, {
          onClick: startDuel,
        });
        drawText(
          tr("⚔ ENTER QUICK DUEL →", "⚔ 퀵 듀얼 출격하기 →"),
          640,
          640,
          390,
          24,
          "255;255;255",
          31
        );
      }
    }
  } else if (S.phase === "DUEL" || S.phase === "RESULT") {
    drawSprite("Bg", 1, 640, 360, 1280, 720, 0);

    // Top-left mini logo
    drawSprite("Logo", S.lang === "ko" ? "ko" : "en", 132, 46, 210, 70, 10);

    // Top Boss Lucian
    const bossTargeted = S.isPlayerTurn && S.selectedMinionIdx >= 0;
    if (bossTargeted) {
      drawSprite("UiElem", "card_glow", 640, 104, 168, 168, 12, {
        opacity: 190 + Math.sin(S.phaseTime * 8) * 60,
      });
    }
    drawSprite("Unit", "boss_lucian", 640, 104, 132, 132, 15, {
      onClick: () => {
        if (S.isPlayerTurn && S.selectedMinionIdx >= 0) {
          attackWithMinion(S.selectedMinionIdx, "BOSS", -1);
        }
      },
    });
    drawSprite("UiElem", "badge_hp", 708, 136, 54, 54, 20);
    drawText(S.bossHp, 708, 137, 58, 23, "255;255;255", 21);
    drawText(
      tr("Abyssal Knight Lucian", "심연 기사 루시안") + (bossTargeted ? tr("  [CLICK TO ATTACK!]", "  [클릭해 공격!]") : ""),
      640,
      24,
      540,
      20,
      bossTargeted ? "253;224;71" : "248;250;252",
      22
    );

    // Enemy Board Minions
    for (let i = 0; i < S.enemyBoard.length; i++) {
      const em = S.enemyBoard[i];
      const pos = getEnemyBoardPos(i, S.enemyBoard.length);
      if (bossTargeted) {
        drawSprite("UiElem", "card_glow", pos.x, pos.y, 140, 158, 14, {
          opacity: 180 + Math.sin(S.phaseTime * 8) * 60,
        });
      }
      const ew = em.objType === "Unit" ? 128 : 112;
      const eh = em.objType === "Unit" ? 128 : 140;
      drawSprite(em.objType, em.anim, pos.x, pos.y, ew, eh, 16, {
        onClick: () => {
          if (S.isPlayerTurn && S.selectedMinionIdx >= 0) {
            attackWithMinion(S.selectedMinionIdx, "MINION", i);
          }
        },
      });
      drawSprite("UiElem", "badge_atk", pos.x - 42, pos.y + 48, 42, 42, 22);
      drawText(em.atk, pos.x - 42, pos.y + 47, 42, 19, "255;255;255", 23);
      drawSprite("UiElem", "badge_hp", pos.x + 42, pos.y + 48, 42, 42, 22);
      drawText(em.hp, pos.x + 42, pos.y + 47, 42, 19, "255;255;255", 23);
      drawText(tr(em.nameEn, em.nameKo), pos.x, pos.y - 76, 160, 14, "254;202;202", 24);
    }

    // Player Board Minions
    for (let i = 0; i < S.playerBoard.length; i++) {
      const pm = S.playerBoard[i];
      let pos = getPlayerBoardPos(i, S.playerBoard.length);
      if (S.lungeAnim && S.lungeAnim.uid === pm.uid) {
        const p = S.lungeAnim.t / S.lungeAnim.maxT;
        const k = p < 0.5 ? p * 2 : (1 - p) * 2;
        pos = {
          x: pos.x + (S.lungeAnim.tx - S.lungeAnim.sx) * k * 0.78,
          y: pos.y + (S.lungeAnim.ty - S.lungeAnim.sy) * k * 0.78,
        };
      }
      const isSelected = S.selectedMinionIdx === i;
      if (S.isPlayerTurn && pm.canAttack) {
        drawSprite("UiElem", "card_glow", pos.x, pos.y, isSelected ? 156 : 138, isSelected ? 178 : 158, 14, {
          opacity: isSelected ? 255 : 170 + Math.sin(S.phaseTime * 6) * 55,
        });
      }
      const w = isSelected ? 124 : 112;
      const h = isSelected ? 156 : 140;
      drawSprite(pm.objType, pm.anim, pos.x, pos.y, w, h, isSelected ? 25 : 17, {
        onClick: () => {
          if (!S.isPlayerTurn || S.phase !== "DUEL") return;
          if (!pm.canAttack) {
            setBanner("This minion already attacked or is summoning!", "이번 턴에 이미 공격했거나 소환 대기 중입니다!", 1.8);
            return;
          }
          if (S.selectedMinionIdx === i) {
            S.selectedMinionIdx = -1;
          } else {
            S.selectedMinionIdx = i;
            playSfx("sfx_card_flip.mp3", 60);
            setBanner("Now click Enemy Minion or Boss Lucian!", "공격할 적 하수인 또는 보스 루시안을 클릭하세요!", 2.5);
          }
        },
      });
      drawSprite("UiElem", "badge_atk", pos.x - 42, pos.y + 48, 42, 42, 26);
      drawText(pm.atk, pos.x - 42, pos.y + 47, 42, 19, "255;255;255", 27);
      drawSprite("UiElem", "badge_hp", pos.x + 42, pos.y + 48, 42, 42, 26);
      drawText(pm.hp, pos.x + 42, pos.y + 47, 42, 19, "255;255;255", 27);
      if (pm.canAttack && S.isPlayerTurn) {
        drawText(isSelected ? tr("⚔ READY!", "⚔ 조준중!") : tr("CLICK TO ATTACK", "클릭해 공격"), pos.x, pos.y - 76, 160, 14, "134;239;172", 28);
      }
    }

    // Player Hero Kadan (bottom-left)
    drawSprite("Unit", "hero_kadan", 136, 580, 144, 144, 18);
    drawSprite("UiElem", "badge_hp", 206, 616, 56, 56, 22);
    drawText(S.playerHp, 206, 617, 60, 24, "255;255;255", 23);
    drawText(tr("Hero Kadan", "영웅 카단"), 136, 666, 180, 18, "226;232;240", 24);

    // Hero Power button
    const canHeroPower = S.isPlayerTurn && !S.heroPowerUsed && S.mana >= 2;
    drawSprite("UiElem", "btn_slate", 312, 594, 154, 64, 20, {
      opacity: canHeroPower ? 255 : 130,
      onClick: useHeroPower,
    });
    drawText(
      tr("✨ Heal +3\n(2 Mana)", "✨ 설원 치유 +3\n(2 마나)"),
      312,
      584,
      146,
      15,
      canHeroPower ? "134;239;172" : "148;163;184",
      21
    );

    // Player Hand (bottom center)
    const hCount = S.hand.length;
    const hGap = 150;
    const hStartX = 670 - ((hCount - 1) * hGap) / 2;
    for (let i = 0; i < hCount; i++) {
      const c = S.hand[i];
      const cx = hStartX + i * hGap;
      const cy = 588;
      const playable = S.isPlayerTurn && S.mana >= c.cost;
      if (playable) {
        drawSprite("UiElem", "card_glow", cx, cy, 146, 198, 19, {
          opacity: 165 + Math.sin(S.phaseTime * 5 + i) * 55,
        });
      }
      drawSprite("Card", c.anim, cx, cy, 124, 174, 21, {
        opacity: playable ? 255 : 175,
        onClick: () => playHandCard(i),
      });
      // Cost crystal top-left
      drawSprite("UiElem", "mana_gem", cx - 44, cy - 68, 36, 36, 23);
      drawText(c.cost, cx - 44, cy - 68, 34, 18, "255;255;255", 24);
      if (c.type === "MINION") {
        drawSprite("UiElem", "badge_atk", cx - 40, cy + 68, 34, 34, 23);
        drawText(c.atk, cx - 40, cy + 68, 34, 15, "255;255;255", 24);
        drawSprite("UiElem", "badge_hp", cx + 40, cy + 68, 34, 34, 23);
        drawText(c.hp, cx + 40, cy + 68, 34, 15, "255;255;255", 24);
      } else {
        drawText(tr("SPELL", "주문"), cx, cy + 70, 110, 14, "253;224;71", 24);
      }
      drawText(tr(c.nameEn, c.nameKo), cx, cy + 95, 144, 14, "255;255;255", 24);
    }

    // Mana & End Turn (bottom-right)
    drawSprite("UiElem", "mana_gem", 1076, 514, 38, 38, 22);
    drawText(
      tr("MANA ", "마나 ") + S.mana + " / " + S.maxMana,
      1158,
      514,
      150,
      22,
      "147;197;253",
      22
    );
    const hasMoves =
      S.isPlayerTurn &&
      (S.hand.some((c) => c.cost <= S.mana) || S.playerBoard.some((m) => m.canAttack));
    drawSprite("UiElem", S.isPlayerTurn && !hasMoves ? "btn_gold" : "btn_crimson", 1138, 588, 200, 64, 25, {
      opacity: S.isPlayerTurn ? 255 : 130,
      onClick: endPlayerTurn,
    });
    drawText(
      S.isPlayerTurn ? tr("END TURN ⏭", "턴 종료 ⏭") : tr("ENEMY TURN...", "상대 턴..."),
      1138,
      588,
      190,
      20,
      "255;255;255",
      26
    );

    // Status Banner
    if (S.bannerTimer > 0 && S.phase === "DUEL") {
      drawSprite("UiElem", "btn_slate", 640, 352, 680, 44, 40, { opacity: 220 });
      drawText(tr(S.bannerEn, S.bannerKo), 640, 352, 660, 18, "253;224;71", 41);
    }

    // Active Combat FX (slashes & popups)
    for (const fx of S.fxList) {
      const p = fx.t / fx.maxT;
      if (fx.kind === "slash") {
        const sc = 0.7 + p * 0.75;
        drawSprite("UiElem", "slash_fx", fx.x, fx.y, 190 * sc, 190 * sc, 55, {
          opacity: (1 - p) * 255,
          angle: p * 35,
        });
      } else if (fx.kind === "text") {
        drawText(fx.text, fx.x, fx.y - p * 44, 180, 30, fx.color, 58, {
          opacity: (1 - p * p) * 255,
        });
      }
    }

    // Victory / Defeat CTA Modal
    if (S.phase === "RESULT") {
      drawSprite("UiElem", "panel_dark", 640, 360, 820, 460, 60);
      drawSprite("Logo", S.lang === "ko" ? "ko" : "en", 640, 206, 260, 86, 62);
      drawText(
        S.resultWin
          ? tr("🏆 VICTORY! LUCIAN DEFEATED!", "🏆 승리! 심연 기사 루시안 격파!")
          : tr("💀 DEFEATED! TRY AGAIN!", "💀 패배! 다시 도전하세요!"),
        640,
        292,
        740,
        32,
        S.resultWin ? "253;224;71" : "248;113;113",
        63
      );
      drawText(
        tr(
          "Play the FULL version FREE: 382 Cards, 40 Story Episodes & 110 Mini-Games!",
          "SNSHero 본편을 100% 무료로 플레이하세요: 382장 카드 · 40화 스토리 보스전!"
        ),
        640,
        352,
        740,
        20,
        "226;232;240",
        63
      );
      drawSprite("UiElem", "btn_gold", 640, 444, 520, 70, 65, {
        onClick: () => {
          playSfx("sfx_card_place.mp3", 80);
          try {
            gdjs.evtTools.window.openURL(CTA_URL, runtimeScene);
          } catch (e) {
            if (typeof window !== "undefined") window.open(CTA_URL, "_blank");
          }
        },
      });
      drawText(
        tr("🔥 PLAY FULL GAME ON SNSHERO.COM →", "🔥 SNSHERO.COM 본편 바로가기 →"),
        640,
        444,
        500,
        21,
        "255;255;255",
        66
      );
      drawSprite("UiElem", "btn_slate", 640, 532, 240, 52, 65, {
        onClick: startPackAltar,
      });
      drawText(tr("↻ PLAY DEMO AGAIN", "↻ 데모 다시 플레이"), 640, 532, 220, 18, "226;232;240", 66);
    }
  }

  endFrameRender();

  // --- Handle Click / Tap Input (Top-most ZOrder wins) ---
  const input = runtimeScene.getGame().getInputManager();
  const isDown = input.isMouseButtonPressed(0) || input.getAllTouchIdentifiers().length > 0;
  const justClicked = isDown && !S.prevDown;
  S.prevDown = isDown;

  if (justClicked) {
    S.clickZones.sort((a, b) => b.z - a.z);
    for (const zone of S.clickZones) {
      if (zone.obj.cursorOnObject()) {
        zone.fn();
        break;
      }
    }
  }
})(runtimeScene);
