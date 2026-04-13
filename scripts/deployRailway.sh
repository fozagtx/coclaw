#!/usr/bin/env bash
set -euo pipefail

#
# Production Railway deployment for Coclaw.
#
# Architecture: 2 Railway services
#   - api                  (Fastify + in-process BullMQ worker)
#   - agent                (Express + x402 paywall)
#
# Usage:
#   ./scripts/deployRailway.sh               # deploy all services
#   ./scripts/deployRailway.sh api           # deploy only api
#   ./scripts/deployRailway.sh agent         # deploy only agent
#
# Required env vars (set before running — script will NOT use placeholders):
#   DATABASE_URL              Postgres connection string (Neon, Supabase, etc.)
#   REDIS_URL                 Redis connection string (Upstash, Railway Redis, etc.)
#   CALLBACK_HMAC_SECRET      Shared HMAC secret (generate with: openssl rand -hex 32)
#   OPENROUTER_API_KEY        OpenRouter key for the agent LLM
#   STELLAR_PRIVATE_KEY       Stellar secret key (S...) for the supplier wallet
#
# Optional env vars:
#   OPENROUTER_MODEL          default: openai/gpt-4o-mini
#   SUPPLIER_PORT             default: 3003
#
# One-time Railway dashboard setup per service (the config-file path):
#   api                   -> railway.api.json
#   agent                 -> railway.agent.json
# Set these under: Service -> Settings -> Build -> Config-as-code Path.
#

PROJECT_NAME="coclaw"

: "${OPENROUTER_MODEL:=openai/gpt-4o-mini}"

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
  requireVar STELLAR_PRIVATE_KEY

  echo ""
  echo "=== api (+ in-process worker) ==="
  setVars api \
    "NODE_ENV=production" \
    "DATABASE_URL=$DATABASE_URL" \
    "REDIS_URL=$REDIS_URL" \
    "CALLBACK_HMAC_SECRET=$CALLBACK_HMAC_SECRET" \
    "STELLAR_PRIVATE_KEY=$STELLAR_PRIVATE_KEY"
  railway up --service api --ci
}

deployAgent() {
  requireVar CALLBACK_HMAC_SECRET
  requireVar OPENROUTER_API_KEY
  requireVar STELLAR_PRIVATE_KEY

  echo ""
  echo "=== agent ==="
  setVars agent \
    "NODE_ENV=production" \
    "CALLBACK_HMAC_SECRET=$CALLBACK_HMAC_SECRET" \
    "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" \
    "OPENROUTER_MODEL=$OPENROUTER_MODEL" \
    "STELLAR_PRIVATE_KEY=$STELLAR_PRIVATE_KEY"
  railway up --service agent --ci
}

requireCli
ensureLogin
ensureLinked

case "$TARGET" in
  api)       deployApi ;;
  agent)     deployAgent ;;
  all)
    deployApi
    deployAgent
    ;;
  *)
    echo "error: unknown target '$TARGET' (use: api | agent | all)" >&2
    exit 1
    ;;
esac

echo ""
echo "=== done ==="
