#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Gateway Hub — Quick Setup Script
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()     { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${RESET} $1"; }
err()    { echo -e "  ${RED}✗${RESET} $1"; exit 1; }

echo -e "${BOLD}${GREEN}"
cat <<'EOF'
   _   _____   _____       _                           _   _       _     
  /_\ |_   _| |  __ \     | |                         | | | |     | |    
 / _ \  | |   | |  \/ __ _| |_ _____      ____ _ _   _| |_| |_   _| |__  
/ ___ \ | |   | | __ / _` | __/ _ \ \ /\ / / _` | | | |  _  | | | | '_ \ 
\/_/\_\|_|   | |_\ \ (_| | ||  __/\ V  V / (_| | |_| | | | | |_| | |_) |
             \____/\__,_|\__\___| \_/\_/ \__,_|\__, \_| |_/\__,_|_.__/ 
                                                __/ |                    
                                               |___/                     
EOF
echo -e "${RESET}"

header "Checking prerequisites"
command -v docker   &>/dev/null || err "Docker is not installed. https://docs.docker.com/get-docker/"
command -v docker   compose version &>/dev/null 2>&1 || \
  docker-compose version &>/dev/null 2>&1 || err "Docker Compose is not installed."
ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
ok "Docker Compose available"

header "Setting up environment"
if [ ! -f .env ]; then
  cp .env.example .env
  # Generate random secrets
  MASTER_KEY="sk-gateway-$(openssl rand -hex 16 2>/dev/null || cat /dev/urandom | head -c 16 | xxd -p)"
  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | head -c 32 | xxd -p)"
  sed -i.bak "s/sk-gateway-master-key-change-me/${MASTER_KEY}/" .env
  sed -i.bak "s/super-secret-jwt-key-change-in-production/${JWT_SECRET}/" .env
  rm -f .env.bak
  ok ".env created with random secrets"
else
  warn ".env already exists — skipping"
fi

header "Creating SSL directory"
mkdir -p nginx/ssl
ok "nginx/ssl/ created"

header "Building and starting services"
docker compose pull litellm 2>/dev/null || true
docker compose build --parallel
docker compose up -d

header "Waiting for services to be healthy"
echo -n "  Waiting"
for i in $(seq 1 30); do
  sleep 2
  echo -n "."
  if curl -sf http://localhost/api/health &>/dev/null; then
    echo ""
    ok "Gateway is ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo ""
    warn "Timeout waiting for health check. Check logs: docker compose logs"
  fi
done

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  🚀 AI Gateway Hub is running!${RESET}"
echo ""
echo -e "  ${CYAN}Web UI:${RESET}      http://localhost"
echo -e "  ${CYAN}API Endpoint:${RESET} http://localhost/v1"
echo -e "  ${CYAN}Management API:${RESET} http://localhost/api"
echo ""
echo -e "  ${YELLOW}Next steps:${RESET}"
echo -e "  1. Open http://localhost in your browser"
echo -e "  2. Click 'Add Model' to register your first AI model"
echo -e "  3. Use the generated endpoint with any OpenAI SDK"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${RESET}"
