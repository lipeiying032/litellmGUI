#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# litellmGUI 一键部署脚本（适用于 GitHub Codespaces / Ubuntu VPS）
# 使用方法：直接粘贴整段到终端执行
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN="\033[32m"; CYAN="\033[36m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
ok()   { echo -e "${GREEN}✓${RESET} $1"; }
info() { echo -e "${CYAN}→${RESET} $1"; }
warn() { echo -e "${YELLOW}⚠${RESET} $1"; }
err()  { echo -e "${RED}✗ 错误：$1${RESET}"; exit 1; }

echo ""
echo -e "${CYAN}======================================${RESET}"
echo -e "${CYAN}   litellmGUI 一键部署脚本           ${RESET}"
echo -e "${CYAN}======================================${RESET}"
echo ""

# ── 1. 检查 Docker ────────────────────────────────────────────────────────────
info "检查 Docker 环境..."
command -v docker &>/dev/null || err "未找到 Docker，请先安装：curl -fsSL https://get.docker.com | sh"
docker compose version &>/dev/null 2>&1 || err "未找到 Docker Compose，请先安装：apt install docker-compose-plugin -y"
ok "Docker 环境就绪：$(docker --version)"

# ── 2. 克隆仓库 ───────────────────────────────────────────────────────────────
REPO_DIR="$HOME/litellmGUI"
if [ -d "$REPO_DIR/.git" ]; then
  warn "仓库已存在，执行 git pull 更新..."
  git -C "$REPO_DIR" pull --ff-only
else
  info "克隆仓库..."
  git clone https://github.com/lipeiying032/litellmGUI.git "$REPO_DIR"
fi
cd "$REPO_DIR"
ok "仓库就绪：$REPO_DIR"

# ── 3. 生成密钥 ───────────────────────────────────────────────────────────────
info "生成随机密钥..."
gen_hex() { openssl rand -hex "$1" 2>/dev/null || od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }
MASTER_KEY="sk-gateway-$(gen_hex 16)"
JWT_SECRET="$(gen_hex 32)"

# ── 4. 写入 .env ──────────────────────────────────────────────────────────────
info "生成 .env 配置文件..."

# 判断是 Codespaces 还是 VPS，自动设置 GATEWAY_PUBLIC_URL
if [ -n "${CODESPACE_NAME:-}" ]; then
  # GitHub Codespaces 环境
  PUBLIC_URL="https://${CODESPACE_NAME}-80.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  warn "检测到 Codespaces 环境"
  warn "端口转发 URL（需在 Codespaces 端口面板设置 80 端口为 Public）："
  warn "  $PUBLIC_URL"
else
  # VPS 环境，尝试获取公网 IP
  PUBLIC_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || echo "localhost")
  PUBLIC_URL="http://${PUBLIC_IP}"
  info "检测到 VPS 环境，公网 IP：${PUBLIC_IP}"
fi

cat > .env << EOF
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
LITELLM_MASTER_KEY=${MASTER_KEY}
JWT_SECRET=${JWT_SECRET}
GATEWAY_PUBLIC_URL=${PUBLIC_URL}
HTTP_PORT=80
HTTPS_PORT=443
LOG_LEVEL=http
EOF

ok ".env 已生成"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${YELLOW}  重要！请保存以下信息：${RESET}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  LITELLM_MASTER_KEY = ${GREEN}${MASTER_KEY}${RESET}"
echo -e "  JWT_SECRET         = ${GREEN}${JWT_SECRET}${RESET}"
echo -e "  GATEWAY_PUBLIC_URL = ${GREEN}${PUBLIC_URL}${RESET}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 5. 降低 LiteLLM worker 数（节省内存）────────────────────────────────────
info "优化内存配置（worker 数 4→2）..."
sed -i 's/--num_workers 4/--num_workers 2/g' docker-compose.yml
ok "内存配置优化完成"

# ── 6. 构建并启动 ─────────────────────────────────────────────────────────────
info "开始构建 Docker 镜像（首次约需 3~5 分钟）..."
docker compose pull litellm 2>/dev/null || true
docker compose build --parallel
docker compose up -d
ok "容器已启动"

# ── 7. 等待服务健康 ───────────────────────────────────────────────────────────
echo ""
info "等待服务启动（LiteLLM 初始化约需 60 秒）..."
echo -n "  进度："
HEALTHY=false
for i in $(seq 1 40); do
  sleep 3
  echo -n "."
  if curl -sf http://localhost/api/health &>/dev/null; then
    HEALTHY=true
    echo ""
    break
  fi
done

echo ""
if [ "$HEALTHY" = true ]; then
  # 获取健康状态
  HEALTH=$(curl -s http://localhost/api/health 2>/dev/null || echo "{}")
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}  🚀 部署成功！${RESET}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo -e "  健康状态：${HEALTH}"
  echo ""
  echo -e "  Web UI：    ${CYAN}${PUBLIC_URL}${RESET}"
  echo -e "  API 端点：  ${CYAN}${PUBLIC_URL}/v1${RESET}"
  echo -e "  管理 API：  ${CYAN}${PUBLIC_URL}/api/health${RESET}"
  echo ""
  if [ -n "${CODESPACE_NAME:-}" ]; then
    echo -e "${YELLOW}  Codespaces 提示：${RESET}"
    echo -e "  请在 VS Code 端口面板中将 80 端口设置为 Public"
    echo -e "  才能从外部访问 Web UI"
  fi
  echo ""
  echo -e "  常用命令："
  echo -e "    查看日志：  ${CYAN}cd ~/litellmGUI && docker compose logs -f${RESET}"
  echo -e "    查看状态：  ${CYAN}cd ~/litellmGUI && docker compose ps${RESET}"
  echo -e "    重启服务：  ${CYAN}cd ~/litellmGUI && docker compose restart${RESET}"
  echo -e "    停止服务：  ${CYAN}cd ~/litellmGUI && docker compose down${RESET}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
else
  warn "服务启动超时，请查看日志排查问题："
  echo -e "  ${CYAN}cd ~/litellmGUI && docker compose logs --tail=50${RESET}"
  echo ""
  docker compose ps
fi