#!/usr/bin/env tsx
import http from 'http';
import readline from 'readline';
import {
  createMcpHttpMiddleware,
  ensureNodeCardDbLoaded,
  executeMcpTool,
  handleMcpJsonRpcPayload,
  loadBenchmarkStore,
} from '../src/mcp/mcpServerNode';

const args = process.argv.slice(2);
const isStdio = args.includes('--stdio');
const isCalibrate = args.includes('--calibrate');
const portIdx = args.indexOf('--port');
const httpPort = portIdx >= 0 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 3100;

async function runStdioMode(): Promise<void> {
  ensureNodeCardDbLoaded();
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false,
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      const resp = Array.isArray(parsed)
        ? (await Promise.all(parsed.map((item) => handleMcpJsonRpcPayload(item)))).filter(Boolean)
        : await handleMcpJsonRpcPayload(parsed);

      if (resp && (!Array.isArray(resp) || resp.length > 0)) {
        process.stdout.write(`${JSON.stringify(resp)}\n`);
      }
    } catch (err: any) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: err?.message || 'Parse error' },
        })}\n`,
      );
    }
  });
}

async function runCalibrateMode(): Promise<void> {
  const gamesArgIdx = args.indexOf('--games');
  const games = gamesArgIdx >= 0 && args[gamesArgIdx + 1] ? Number(args[gamesArgIdx + 1]) : 1000;
  console.log(`[MCP Calibrate] Running ${games} real SNSHero GameEngine matches across 9 factions...`);
  loadBenchmarkStore();
  const result = await executeMcpTool('snshero_run_batch_simulation', {
    games,
    playerPolicy: 'SNSHERO_EXPERT',
    opponentPolicy: 'SNSHERO_EXPERT',
    updateEngineBaseline: true,
  });
  console.log(
    `[MCP Calibrate] Completed ${result.gamesRun} games in ${result.totalDurationMs}ms (${result.matchesPerSec} games/sec, ${result.avgDecisionMs}ms/decision).`,
  );
  console.log(
    `[MCP Calibrate] Mirror Balance: ${result.wins}W-${result.losses}L (${result.winRatePct}%), 1st-Player: ${result.firstPlayerWinRatePct}%, Avg Turns: ${result.avgTurns}`,
  );
}

async function runHttpMode(): Promise<void> {
  ensureNodeCardDbLoaded();
  loadBenchmarkStore();
  const mcpMiddleware = createMcpHttpMiddleware();
  const server = http.createServer((req, res) => {
    mcpMiddleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: 'Route not found. Use /mcp for Model Context Protocol JSON-RPC 2.0.',
        }),
      );
    });
  });

  server.listen(httpPort, '0.0.0.0', () => {
    console.log(`[SNSHero MCP Server] Online at http://localhost:${httpPort}/mcp`);
    console.log(`  - Streamable HTTP (JSON-RPC 2.0): POST http://localhost:${httpPort}/mcp`);
    console.log(`  - SSE Transport                 : GET  http://localhost:${httpPort}/mcp/sse`);
    console.log(`  - OpenAPI 3.1 (ChatGPT Actions) : GET  http://localhost:${httpPort}/mcp/openapi.json`);
    console.log(`  - Claude Code CLI               : claude mcp add --transport http snshero http://localhost:${httpPort}/mcp`);
  });
}

if (isStdio) {
  runStdioMode();
} else if (isCalibrate) {
  runCalibrateMode();
} else {
  runHttpMode();
}
