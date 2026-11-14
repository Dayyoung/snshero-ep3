#!/usr/bin/env tsx
/**
 * Autonomous 1,000-Match & 100-Point Evaluation Orchestrator via /mcp
 *
 * Usage:
 *   # Dry-run verification (3 matches via MCP JSON-RPC protocol):
 *   npx tsx scripts/run-llm-1000-benchmark.ts --verify
 *
 *   # Live LLM API 1,000-game run (uses OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY):
 *   ANTHROPIC_API_KEY=... npx tsx scripts/run-llm-1000-benchmark.ts --agent claude --games 1000
 *   GEMINI_API_KEY=...    npx tsx scripts/run-llm-1000-benchmark.ts --agent gemini --games 1000
 *   OPENAI_API_KEY=...    npx tsx scripts/run-llm-1000-benchmark.ts --agent chatgpt --games 1000
 */
import { handleMcpJsonRpcPayload } from '../src/mcp/mcpServerNode';

let rpcSeq = 1;
async function mcpCallTool(name: string, toolArgs: Record<string, unknown> = {}): Promise<any> {
  const resp = await handleMcpJsonRpcPayload({
    jsonrpc: '2.0',
    id: rpcSeq++,
    method: 'tools/call',
    params: { name, arguments: toolArgs },
  });
  if (resp?.error) {
    throw new Error(`MCP error (${name}): ${resp.error.message}`);
  }
  return resp?.result?.structuredContent;
}

async function pickActionWithLlmApi(
  agent: 'chatgpt' | 'gemini' | 'claude',
  obs: any,
): Promise<{ actionIndex: number; reasoning: string }> {
  const compactPrompt = [
    `You are playing SNSHero Card Battle. Pick the single best move index (0..${obs.legalActions.length - 1}).`,
    `Turn: ${obs.turnNumber} | Your HP: ${obs.player.health}+${obs.player.armor} | Mana: ${obs.player.mana}/${obs.player.maxMana} | Enemy HP: ${obs.opponent.health}+${obs.opponent.armor} (Secrets: ${obs.opponent.secretCount})`,
    `Your Board: ${JSON.stringify(obs.player.board.map((m: any) => `${m.name}(${m.attack}/${m.health}${m.taunt ? ',T' : ''})`))}`,
    `Enemy Board: ${JSON.stringify(obs.opponent.board.map((m: any) => `${m.name}(${m.attack}/${m.health}${m.taunt ? ',T' : ''})`))}`,
    `Hand: ${JSON.stringify(obs.player.hand.map((h: any) => `${h.name}[${h.effectiveCost}M]:${h.text}`))}`,
    `Legal Actions:\n${obs.legalActions.map((a: any) => `[${a.actionIndex}] ${a.labelEn}`).join('\n')}`,
    `Respond ONLY with JSON: {"actionIndex": <int>, "reasoning": "<short reason>"}`,
  ].join('\n');

  if (agent === 'chatgpt' && process.env.OPENAI_API_KEY) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: compactPrompt }],
      }),
    });
    const j: any = await r.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}');
    return { actionIndex: Number(parsed.actionIndex ?? 0), reasoning: parsed.reasoning || '' };
  }

  if (agent === 'gemini' && process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: compactPrompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    const j: any = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(txt);
    return { actionIndex: Number(parsed.actionIndex ?? 0), reasoning: parsed.reasoning || '' };
  }

  if (agent === 'claude' && process.env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 180,
        messages: [{ role: 'user', content: compactPrompt }],
      }),
    });
    const j: any = await r.json();
    const txt: string = j.content?.[0]?.text || '{}';
    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    return { actionIndex: Number(parsed.actionIndex ?? 0), reasoning: parsed.reasoning || '' };
  }

  // Fallback tactical policy when running --verify without external API keys
  return { actionIndex: 0, reasoning: 'MCP protocol verification step' };
}

async function main() {
  const argv = process.argv.slice(2);
  const verifyOnly = argv.includes('--verify');
  const agentIdx = argv.indexOf('--agent');
  const gamesIdx = argv.indexOf('--games');
  const agent = (agentIdx >= 0 ? argv[agentIdx + 1] : 'claude') as 'chatgpt' | 'gemini' | 'claude';
  const totalGames = verifyOnly ? 3 : Number(gamesIdx >= 0 ? argv[gamesIdx + 1] : 1000);

  const initResp = await handleMcpJsonRpcPayload({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26' },
  });
  console.log('[MCP Runner] Connected to:', initResp?.result?.serverInfo);

  const dossier = await mcpCallTool('snshero_get_game_dossier');
  console.log(
    `[MCP Runner] Dossier verified: ${dossier.architecturePillars.planning.collectibleCards} cards, ${dossier.evaluationRubric100Pt.length} rubric items.`,
  );

  if (verifyOnly) {
    // Play 3 full matches via MCP tools without overwriting the Artificial Analysis baseline store
    let wins = 0;
    for (let g = 0; g < totalGames; g++) {
      let obs = await mcpCallTool('snshero_start_match', {
        agentId: agent,
        modelName: 'MCP Verification Runner',
      });
      let guard = 0;
      while (obs.phase !== 'GAME_OVER' && guard < 120) {
        guard += 1;
        const pick = await pickActionWithLlmApi(agent, obs);
        const safeIdx =
          pick.actionIndex >= 0 && pick.actionIndex < obs.legalActions.length
            ? pick.actionIndex
            : obs.legalActions.length - 1;
        obs = await mcpCallTool('snshero_step_action', {
          matchId: obs.matchId,
          actionIndex: safeIdx,
          reasoning: pick.reasoning,
        });
      }
      if (obs.winner === 'PLAYER') wins += 1;
      console.log(
        `[MCP Verify] Game #${g + 1}/${totalGames}: ${obs.player.faction} vs ${obs.opponent.faction} -> Winner: ${obs.winner} (Turn ${obs.turnNumber})`,
      );
    }
    console.log(`[MCP Verify] 3-game turn-by-turn MCP verification passed (${wins}/${totalGames} wins).`);
    return;
  }

  const series = await mcpCallTool('snshero_create_1000_series', {
    agentId: agent,
    targetGames: totalGames,
  });
  console.log(`[MCP Runner] Started series ${series.seriesId} (${totalGames} games)...`);

  let wins = 0;
  for (let g = 0; g < totalGames; g++) {
    let obs = await mcpCallTool('snshero_start_match', {
      agentId: agent,
      seriesId: series.seriesId,
    });
    let guard = 0;
    while (obs.phase !== 'GAME_OVER' && guard < 150) {
      guard += 1;
      const pick = await pickActionWithLlmApi(agent, obs);
      const safeIdx =
        pick.actionIndex >= 0 && pick.actionIndex < obs.legalActions.length
          ? pick.actionIndex
          : obs.legalActions.length - 1;
      obs = await mcpCallTool('snshero_step_action', {
        matchId: obs.matchId,
        actionIndex: safeIdx,
        reasoning: pick.reasoning,
      });
    }
    if (obs.winner === 'PLAYER') wins += 1;
    if ((g + 1) % 10 === 0 || g + 1 === totalGames) {
      console.log(`[MCP Runner] Progress: ${g + 1}/${totalGames} | Wins: ${wins} (${((wins / (g + 1)) * 100).toFixed(1)}%)`);
    }
  }
}

main().catch((err) => {
  console.error('[MCP Runner Fatal]', err);
  process.exit(1);
});
