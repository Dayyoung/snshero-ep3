#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PORT=3000
echo "🚀 [start-server] SNSHero 정적 프리뷰 서버 기동을 시작합니다..."

PID=$(lsof -ti :$PORT || true)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
  sleep 1
fi

WATCH_PID=$(pgrep -f "node scripts/watch-build.js" || true)
if [ -n "$WATCH_PID" ]; then
  kill -9 $WATCH_PID 2>/dev/null || true
fi

if [ ! -f "dist/index.html" ] || [ ! -f "dist/game.html" ] || [ "$1" = "--build" ]; then
  npm run build
fi

cleanup() {
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

node scripts/watch-build.js &
exec npx vite preview --host 0.0.0.0 --port $PORT
