#!/bin/bash
# Development script - runs Bassline daemon + editor together

set -e

# Configuration
DATA_DIR="${BL_DATA:-.bassline-dev}"
HTTP_PORT="${BL_HTTP_PORT:-9111}"
WS_PORT="${BL_WS_PORT:-9112}"
EDITOR_PORT="${EDITOR_PORT:-5173}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Bassline Development Environment${NC}"
echo ""

# Cleanup function
cleanup() {
  echo ""
  echo -e "${BLUE}Shutting down...${NC}"
  kill $DAEMON_PID 2>/dev/null || true
  kill $EDITOR_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start daemon in background
echo -e "${GREEN}Starting Bassline daemon...${NC}"
echo "  Data:  $DATA_DIR"
echo "  HTTP:  http://localhost:$HTTP_PORT"
echo "  WS:    ws://localhost:$WS_PORT"
echo ""

BL_DATA="$DATA_DIR" BL_HTTP_PORT="$HTTP_PORT" BL_WS_PORT="$WS_PORT" \
  node apps/cli/src/daemon.js &
DAEMON_PID=$!

# Wait for daemon to be ready
sleep 2

# Start editor in background
echo -e "${GREEN}Starting Editor...${NC}"
echo "  URL:   http://localhost:$EDITOR_PORT"
echo ""

cd apps/editor && pnpm dev --port $EDITOR_PORT &
EDITOR_PID=$!

echo ""
echo -e "${GREEN}Development environment ready!${NC}"
echo ""
echo "  Editor:    http://localhost:$EDITOR_PORT"
echo "  Dashboard: http://localhost:$EDITOR_PORT (navigate to bl:///dashboard)"
echo "  API:       http://localhost:$HTTP_PORT?uri=bl:///data"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Wait for either process to exit
wait
