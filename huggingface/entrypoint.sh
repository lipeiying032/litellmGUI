#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh — container startup for Hugging Face Spaces
#
# Responsibilities:
#   1. Apply sensible defaults for any env vars not set via HF Space secrets
#   2. Ensure required directories exist and are writable (ephemeral /tmp)
#   3. Sanity-check required files baked into the image
#   4. Hand off to supervisord (which manages litellm, backend, nginx)
#
# Environment variables (set in HF Space → Settings → Repository secrets):
#
#   LITELLM_MASTER_KEY   Required. Admin key for LiteLLM proxy.
#   JWT_SECRET           Required. Secret for backend session tokens.
#   GATEWAY_PUBLIC_URL   Required. Public URL of this Space, e.g.
#                          https://<user>-<space>.hf.space
#                          (auto-set by the GitHub Actions workflow)
#   DB_PATH              Optional. SQLite path. Default: /app/data/gateway.db
#   LOG_LEVEL            Optional. Winston log level. Default: http
#
#   Provider API keys (optional, set whichever you use):
#   OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, …
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "──────────────────────────────────────────"
echo " AI Gateway Hub — starting (HF Spaces)"
echo "──────────────────────────────────────────"

# ── 1. Defaults for optional / missing env vars ───────────────────────────────

# LITELLM_MASTER_KEY is critical — warn loudly if using the insecure default
if [ -z "${LITELLM_MASTER_KEY:-}" ]; then
  export LITELLM_MASTER_KEY="sk-gateway-hf-insecure-change-me"
  echo "⚠️  WARNING: LITELLM_MASTER_KEY not set. Using insecure default."
  echo "    Set it in: HF Space → Settings → Repository secrets"
fi

if [ -z "${JWT_SECRET:-}" ]; then
  # Generate a random secret at runtime; sessions won't survive restarts
  # but this is acceptable for a demo Space.
  export JWT_SECRET
  JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  echo "ℹ️  JWT_SECRET not set — generated an ephemeral secret for this session."
fi

export GATEWAY_PUBLIC_URL="${GATEWAY_PUBLIC_URL:-http://localhost:7860}"
export DB_PATH="${DB_PATH:-/app/data/gateway.db}"
export LOG_LEVEL="${LOG_LEVEL:-http}"
export NODE_ENV="${NODE_ENV:-production}"

echo "GATEWAY_PUBLIC_URL : ${GATEWAY_PUBLIC_URL}"
echo "DB_PATH            : ${DB_PATH}"
echo "LOG_LEVEL          : ${LOG_LEVEL}"

# ── 2. Create / verify writable directories ───────────────────────────────────

# /app/data persists the SQLite DB; may be ephemeral on free-tier HF Spaces.
mkdir -p "$(dirname "${DB_PATH}")"

# nginx needs these temp dirs when running as non-root
mkdir -p \
  /tmp/nginx/client_body \
  /tmp/nginx/proxy \
  /tmp/nginx/fastcgi \
  /tmp/nginx/uwsgi \
  /tmp/nginx/scgi

# supervisor socket + pid files live in /tmp (non-root writable)
mkdir -p /tmp/supervisor

echo "✅ Directories ready"

# ── 3. Sanity-check required files baked into the image ──────────────────────

if [ ! -f "/app/litellm/config.yaml" ]; then
  echo "❌ /app/litellm/config.yaml not found — aborting."
  exit 1
fi
echo "✅ LiteLLM config found"

if [ ! -f "/app/frontend/dist/index.html" ]; then
  echo "❌ Frontend build missing at /app/frontend/dist/index.html"
  echo "   This should have been built in the Docker image Stage 1."
  exit 1
fi
echo "✅ Frontend build present"

# ── 4. Print startup summary ──────────────────────────────────────────────────
echo ""
echo "Starting services:"
echo "  • LiteLLM proxy    → localhost:4000"
echo "  • Node.js backend  → localhost:3001"
echo "  • nginx (public)   → 0.0.0.0:7860"
echo ""
echo "Access your gateway at: ${GATEWAY_PUBLIC_URL}"
echo "──────────────────────────────────────────"

# ── 5. Exec supervisord (replaces this script as PID 1) ──────────────────────
exec /usr/bin/supervisord -c /app/huggingface/supervisord.conf