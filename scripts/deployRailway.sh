#!/usr/bin/env bash
set -euo pipefail

#
# Production Railway deployment for Coclaw.
#
# Architecture: 2 Railway services
#   - api                  (Fastify + in-process chain listener + BullMQ worker)
#   - agent                (Fastify, the "other agent" in A2A demo)
#
# Usage:
#   ./scripts/deployRailway.sh               # deploy all services
#   ./scripts/deployRailway.sh api           # deploy only api
#   ./scripts/deployRailway.sh supplier      # deploy only agent
#
# Required env vars (set before running — script will NOT use placeholders):
#   DATABASE_URL              Postgres connection string (Neon, Supabase, etc.)
#   REDIS_URL                 Redis connection string (Upstash, Railway Redis, etc.)
#   CALLBACK_HMAC_SECRET      Shared HMAC secret for signed callbacks
#   OPENROUTER_API_KEY        OpenRouter key for the agent LLM
#
# Optional env vars (sensible on-chain defaults used if unset):
#   USDT_ADDRESS              default: 0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63
#   PAYMENT_ROUTER_ADDRESS    default: 0x6D92Ef5bF2858c158aAEf035447eEfDB55C0524C
#   RPC_URL                   default: https://rpc-testnet.gokite.ai/
#   CHAIN_ID                  default: 2368
#   OPENROUTER_MODEL          default: openai/gpt-4o-mini
#   SUPPLIER_PORT             default: 3003
#
# One-time Railway dashboard setup per service (the config-file path):
#   api                   -> railway.api.json
#   agent                  -> railway.agent.json
# Set these under: Service -> Settings -> Build -> Config-as-code Path.
#

PROJECT_NAME="coclaw"

# Default on-chain values (Kite testnet) — override via env if needed.
: "${USDT_ADDRESS:=0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63}"
: "${PAYMENT_ROUTER_ADDRESS:=0x6D92Ef5bF2858c158aAEf035447eEfDB55C0524C}"
: "${RPC_URL:=https://rpc-testnet.gokite.ai/}"
: "${CHAIN_ID:=2368}"
: "${OPENROUTER_MODEL:=openai/gpt-4o-mini}"
: "${SUPPLIER_PORT:=3003}"
: "${CALLBACK_BASE_URL:=http://coclawapi.railway.internal}"

TARGET="${1:-all}"

requireCli() {
  if ! command -v railway &>/dev/null; then
    echo "error: railway CLI not found. install: https://docs.railway.com/guides/cli" >&2
    exit 1
  fi
}

requireVar() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "error: required env var $name is not set" >&2
    exit 1
  fi
}

ensureLogin() {
  if ! railway whoami &>/dev/null; then
    echo "not logged in to Railway — running 'railway login'..."
    railway login
  fi
}

ensureLinked() {
  if ! railway status &>/dev/null; then
    echo "project not linked — running 'railway link' (select or create \"$PROJECT_NAME\")..."
    railway link
  fi
}

setVars() {
  local service="$1"
  shift
  local pairs=("$@")
  # railway variables --set accepts one --set per pair.
  local args=(--service "$service")
  for p in "${pairs[@]}"; do
    args+=(--set "$p")
  done
  railway variables "${args[@]}" >/dev/null
}

deployApi() {
  requireVar DATABASE_URL
  requireVar REDIS_URL
  requireVar CALLBACK_HMAC_SECRET

  echo ""
  echo "=== api (+ in-process worker) ==="
  # Note: API_BASE_URL is intentionally NOT set here.
  # The api passes http://127.0.0.1:${PORT} (the port Railway assigns) to the
  # in-process worker at boot. Setting API_BASE_URL here would override that
  # with a wrong port.
  setVars api \
    "NODE_ENV=production" \
    "DATABASE_URL=$DATABASE_URL" \
    "REDIS_URL=$REDIS_URL" \
    "CALLBACK_HMAC_SECRET=$CALLBACK_HMAC_SECRET" \
    "USDT_ADDRESS=$USDT_ADDRESS" \
    "PAYMENT_ROUTER_ADDRESS=$PAYMENT_ROUTER_ADDRESS" \
    "RPC_URL=$RPC_URL" \
    "CHAIN_ID=$CHAIN_ID" \
    "CALLBACK_BASE_URL=$CALLBACK_BASE_URL"
  railway up --service api --ci
}

deploySupplier() {
  requireVar CALLBACK_HMAC_SECRET
  requireVar OPENROUTER_API_KEY

  echo ""
  echo "=== agent ==="
  setVars agent \
    "NODE_ENV=production" \
    "CALLBACK_HMAC_SECRET=$CALLBACK_HMAC_SECRET" \
    "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" \
    "OPENROUTER_MODEL=$OPENROUTER_MODEL" \
    "SUPPLIER_PORT=$SUPPLIER_PORT"
  railway up --service agent --ci
}

requireCli
ensureLogin
ensureLinked

case "$TARGET" in
  api)       deployApi ;;
  supplier)  deploySupplier ;;
  all)
    deployApi
    deploySupplier
    ;;
  *)
    echo "error: unknown target '$TARGET' (use: api | supplier | all)" >&2
    exit 1
    ;;
esac

echo ""
echo "=== done ==="
