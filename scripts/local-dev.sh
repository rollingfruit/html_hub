#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

log() {
  printf '\033[32m[local-dev]\033[0m %s\n' "$1"
}

export SERVER_DATABASE_URL="${DATABASE_URL:-file:./db/dev.db}"
export SERVER_UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
export SERVER_TMP_DIR="${TMP_DIR:-./tmp}"
export SERVER_JWT_SECRET="${JWT_SECRET:-dev_secret}"
export SERVER_ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
export SERVER_ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
export SERVER_PORT="${PORT:-3000}"
export SERVER_HOST="${HOST:-127.0.0.1}"
export CLIENT_PORT="${CLIENT_PORT:-5173}"
export CLIENT_HOST="${CLIENT_HOST:-127.0.0.1}"

cleanup() {
  local exit_code=$?
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    log "停止后端 (PID=$SERVER_PID)"
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]] && kill -0 "$CLIENT_PID" >/dev/null 2>&1; then
    log "停止前端 (PID=$CLIENT_PID)"
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

run_server() {
  cd "$SERVER_DIR"
  log "安装后端依赖"
  npm install >/dev/null
  log "生成 Prisma Client"
  npx prisma generate >/dev/null
  log "同步数据库"
  DATABASE_URL="$SERVER_DATABASE_URL" npx prisma migrate dev --skip-generate >/dev/null
  mkdir -p "$SERVER_UPLOAD_DIR" "$SERVER_TMP_DIR" db
  log "启动后端 (http://$SERVER_HOST:$SERVER_PORT)"
  DATABASE_URL="$SERVER_DATABASE_URL" \
    UPLOAD_DIR="$SERVER_UPLOAD_DIR" \
    TMP_DIR="$SERVER_TMP_DIR" \
    JWT_SECRET="$SERVER_JWT_SECRET" \
    ADMIN_USERNAME="$SERVER_ADMIN_USERNAME" \
    ADMIN_PASSWORD="$SERVER_ADMIN_PASSWORD" \
    PORT="$SERVER_PORT" \
    HOST="$SERVER_HOST" \
    npm run dev
}

run_client() {
  cd "$CLIENT_DIR"
  log "安装前端依赖"
  npm install >/dev/null
  log "启动前端 (http://$CLIENT_HOST:$CLIENT_PORT)"
  npm run dev -- --host "$CLIENT_HOST" --port "$CLIENT_PORT"
}

run_server &
SERVER_PID=$!

sleep 2

run_client &
CLIENT_PID=$!

if [[ -n "${DEV_DURATION:-}" ]]; then
  (
    sleep "$DEV_DURATION"
    log "DEV_DURATION=$DEV_DURATION 已到，准备退出"
    kill -INT "$$" >/dev/null 2>&1 || true
  ) &
fi

wait
