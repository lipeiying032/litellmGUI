#!/usr/bin/env bash
# entrypoint.sh - HF Spaces container startup
# LiteLLM v1.81+ requires PostgreSQL for /model/new API.
set -euo pipefail

echo "AI Gateway Hub - starting (HF Spaces)"
echo "======================================"

# 1. DATABASE_URL - required for LiteLLM v1.81+ model registration
if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL is not set."
  echo "LiteLLM v1.81+ requires PostgreSQL for /model/new API."
  echo "Without it all model registrations return HTTP 500."
  echo ""
  echo "Get a free PostgreSQL URL from:"
  echo "  Neon:     https://neon.tech"
  echo "  Supabase: https://supabase.com"
  echo "  Railway:  https://railway.app"
  echo ""
  echo "Add to HF Space Settings -> Repository secrets:"
  echo "  DATABASE_URL = postgresql://user:pass@host:5432/dbname"
fi
export DATABASE_URL="${DATABASE_URL:-}"

# 2. LITELLM_SALT_KEY - encrypts API keys stored in DB
if [ -z "${LITELLM_SALT_KEY:-}" ]; then
  echo "WARNING: LITELLM_SALT_KEY not set - stored API keys will not be encrypted."
  echo "IMPORTANT: Never change this after adding models."
fi
export LITELLM_SALT_KEY="${LITELLM_SALT_KEY:-}"

# 3. Other secrets
if [ -z "${LITELLM_MASTER_KEY:-}" ]; then
  export LITELLM_MASTER_KEY="sk-gateway-hf-insecure-change-me"
  echo "WARNING: LITELLM_MASTER_KEY not set. Using insecure default."
fi

if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET
  JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  echo "INFO: JWT_SECRET not set - generated ephemeral secret."
fi

export GATEWAY_PUBLIC_URL="${GATEWAY_PUBLIC_URL:-http://localhost:7860}"
export DB_PATH="${DB_PATH:-/app/data/gateway.db}"
export LOG_LEVEL="${LOG_LEVEL:-http}"
export NODE_ENV="${NODE_ENV:-production}"

echo "GATEWAY_PUBLIC_URL : ${GATEWAY_PUBLIC_URL}"
echo "DATABASE_URL set   : $([ -n "${DATABASE_URL}" ] && echo YES || echo NO)"
echo "SALT_KEY set       : $([ -n "${LITELLM_SALT_KEY}" ] && echo YES || echo NO)"

# 4. Inject database_url into config.yaml at runtime if DATABASE_URL is set
# entrypoint runs as user:user who owns /app/litellm/config.yaml (set in Dockerfile)
CONFIG="/app/litellm/config.yaml"
if [ -n "${DATABASE_URL}" ]; then
  if ! grep -q "database_url" "${CONFIG}"; then
    python3 << PYEOF
import re
with open("${CONFIG}", "r") as f:
    content = f.read()
content = re.sub(
    r"(master_key:\s*os\.environ/LITELLM_MASTER_KEY)",
    r"\1\n  database_url: os.environ/DATABASE_URL",
    content
)
with open("${CONFIG}", "w") as f:
    f.write(content)
print("INFO: database_url injected into config.yaml")
PYEOF
  else
    echo "INFO: database_url already present in config.yaml"
  fi
fi

# 5. Directories
mkdir -p "$(dirname "${DB_PATH}")"
mkdir -p /tmp/nginx/client_body /tmp/nginx/proxy \
         /tmp/nginx/fastcgi /tmp/nginx/uwsgi /tmp/nginx/scgi
mkdir -p /tmp/supervisor
echo "Directories ready"

# 6. Sanity checks
if [ ! -f "${CONFIG}" ]; then
  echo "ERROR: ${CONFIG} not found - aborting."
  exit 1
fi
if [ ! -f "/app/frontend/dist/index.html" ]; then
  echo "ERROR: frontend build missing - aborting."
  exit 1
fi
echo "Config and frontend OK"

echo "Starting services:"
echo "  LiteLLM  -> localhost:4000  (priority 10)"
echo "  Backend  -> localhost:3001  (priority 20)"
echo "  nginx    -> 0.0.0.0:7860   (priority 30)"
echo "Gateway URL: ${GATEWAY_PUBLIC_URL}"

exec /usr/bin/supervisord -c /app/huggingface/supervisord.conf