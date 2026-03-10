.PHONY: up down restart logs build clean setup dev

# ── Production ────────────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-litellm:
	docker compose logs -f litellm

status:
	docker compose ps

# ── Setup ─────────────────────────────────────────────────────────────────────
setup:
	chmod +x scripts/setup.sh && ./scripts/setup.sh

env:
	@if [ ! -f .env ]; then cp .env.example .env && echo ".env created"; else echo ".env already exists"; fi

# ── Development ───────────────────────────────────────────────────────────────
dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

dev-install:
	cd backend && npm install
	cd frontend && npm install

# ── Cleanup ───────────────────────────────────────────────────────────────────
clean:
	docker compose down -v --remove-orphans
	docker image prune -f

clean-data:
	docker compose down -v
	@echo "All persistent data removed."
