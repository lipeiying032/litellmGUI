# 🚀 AI Gateway Hub

> **Universal AI API Gateway** — Register any AI provider (OpenAI, Anthropic, Ollama, Gemini, Groq, and 100+ more) and get a single OpenAI-compatible endpoint. Powered by [LiteLLM](https://litellm.ai).

[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://docker.com)
[![LiteLLM](https://img.shields.io/badge/LiteLLM-powered-00d4ff)](https://litellm.ai)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-compatible-00ff87)](https://platform.openai.com/docs/api-reference)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## ✨ Features

- **Any Provider → OpenAI API**: Register models from Anthropic, Google, Ollama, Groq, Mistral, Cohere, HuggingFace, AWS Bedrock, Azure, and [100+ providers](https://docs.litellm.ai/docs/providers)
- **No API Key Passthrough**: Users call your gateway without needing provider API keys
- **Web UI**: Beautiful dashboard for model management, API testing, and code examples
- **OpenAI-Compatible**: Works with any OpenAI SDK — Python, Node.js, LangChain, LlamaIndex, etc.
- **Streaming**: Full SSE streaming support for real-time responses
- **All Model Types**: Chat, completions, embeddings, image generation, audio
- **Docker Deployment**: One-command deployment via Docker Compose

---

## 📸 Architecture

```
Browser / SDK Clients
        │
        ▼
   ┌─────────┐
   │  Nginx  │  :80 / :443
   └────┬────┘
        ├── /v1/*   →  LiteLLM Proxy  (OpenAI-compatible gateway)
        ├── /api/*  →  Backend API    (model registry, management)
        └── /*      →  React Frontend (web UI)

   LiteLLM ──► Anthropic API
               OpenAI API
               Google Gemini
               Ollama (local)
               AWS Bedrock
               ... 100+ providers
```

---

## 🚀 Quick Start

### Prerequisites
- Docker Engine 24+
- Docker Compose v2

### 1. Clone & setup

```bash
git clone https://github.com/your-org/ai-gateway-hub.git
cd ai-gateway-hub

# Automated setup (generates secrets, builds, starts)
make setup
# — or manually —
cp .env.example .env
docker compose up -d
```

### 2. Open the web UI

Navigate to **http://localhost** and click **Add Model**.

### 3. Register a model

Fill in:
| Field | Example |
|---|---|
| **Display Name** | My Claude Proxy |
| **Provider** | `anthropic` |
| **LiteLLM Model Name** | `anthropic/claude-3-5-sonnet-20241022` |
| **API Base** | `https://api.anthropic.com` (or blank for default) |
| **API Key** | `sk-ant-...` (optional — blank for keyless providers) |

The gateway generates your OpenAI-compatible alias instantly.

### 4. Call your model

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost/v1",
    api_key="any-string",           # No real key needed from the caller
)

response = client.chat.completions.create(
    model="anthropic-claude-3-5-sonnet-20241022",  # Generated alias
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

---

## 📦 Supported Providers

| Provider | Prefix | Key Required |
|---|---|---|
| OpenAI | `openai/` | Yes |
| Anthropic | `anthropic/` | Yes |
| Google Gemini | `gemini/` | Yes |
| Ollama (local) | `ollama/` | **No** |
| Groq | `groq/` | Yes |
| Mistral AI | `mistral/` | Yes |
| Cohere | `cohere/` | Yes |
| Together AI | `together_ai/` | Yes |
| AWS Bedrock | `bedrock/` | IAM only |
| Azure OpenAI | `azure/` | Yes |
| HuggingFace | `huggingface/` | Yes |
| DeepSeek | `deepseek/` | Yes |
| Perplexity | `perplexity/` | Yes |
| Replicate | `replicate/` | Yes |
| Any OpenAI-compatible | `openai/` + custom `api_base` | Optional |

→ Full list: [docs.litellm.ai/docs/providers](https://docs.litellm.ai/docs/providers)

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# LiteLLM master key (admin API access)
LITELLM_MASTER_KEY=sk-gateway-master-key-change-me

# JWT secret for sessions
JWT_SECRET=your-secret-here

# Public URL shown in the UI for endpoint generation
GATEWAY_PUBLIC_URL=https://your-domain.com

# HTTP/HTTPS ports
HTTP_PORT=80
HTTPS_PORT=443
```

### Custom `litellm/config.yaml`

You can pre-configure models in `litellm/config.yaml` for static deployments:

```yaml
model_list:
  - model_name: my-gpt4
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: local-llama
    litellm_params:
      model: ollama/llama3
      api_base: http://host.docker.internal:11434
```

---

## 🛠 Development

```bash
# Install dependencies
make dev-install

# Start backend in dev mode (hot reload)
make dev-backend   # http://localhost:3001

# Start frontend in dev mode (Vite HMR)
make dev-frontend  # http://localhost:5173

# Start LiteLLM separately
docker compose up litellm -d
```

---

## 📁 Project Structure

```
ai-gateway-hub/
├── docker-compose.yml        # Service orchestration
├── .env.example              # Environment template
├── Makefile                  # Convenience commands
├── nginx/
│   └── nginx.conf            # Reverse proxy config
├── litellm/
│   └── config.yaml           # LiteLLM static config
├── backend/                  # Node.js management API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js           # Express server
│       ├── database.js        # SQLite (better-sqlite3)
│       ├── litellm.js         # LiteLLM admin API client
│       ├── logger.js          # Winston logger
│       └── routes/
│           ├── models.js      # Model CRUD API
│           └── stats.js       # Stats, health, providers
└── frontend/                 # React + Vite + Tailwind
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── App.jsx
        ├── api.js
        └── components/
            ├── ModelManager.jsx
            ├── ModelCard.jsx
            ├── ModelForm.jsx
            ├── TestPanel.jsx
            ├── DocsView.jsx
            └── StatsBar.jsx
```

---

## 🔌 API Reference

### Management API

```
GET  /api/models          List all models
POST /api/models          Register a new model
GET  /api/models/:id      Get model details
PATCH /api/models/:id     Update model
DELETE /api/models/:id    Remove model
POST /api/models/:id/test Test model connectivity
POST /api/models/:id/toggle Enable/disable model
GET  /api/stats           Dashboard statistics
GET  /api/health          Health check
GET  /api/providers       List known providers with examples
```

### OpenAI-Compatible Gateway

```
POST /v1/chat/completions
POST /v1/completions
POST /v1/embeddings
POST /v1/images/generations
POST /v1/audio/speech
POST /v1/audio/transcriptions
GET  /v1/models
```

---

## 🐳 Docker Deployment

### Custom port
```bash
HTTP_PORT=8080 docker compose up -d
```

### With Watchtower (auto-updates)
```yaml
# Add to docker-compose.yml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 86400
```

### Production with HTTPS

Place your SSL certificates in `nginx/ssl/` and update `nginx/nginx.conf` to enable the HTTPS server block.

---

## 📄 License

MIT © 2024 AI Gateway Hub Contributors

---

## 🙏 Credits

- [LiteLLM](https://litellm.ai) — the underlying AI proxy engine
- [OpenAI API](https://platform.openai.com/docs/api-reference) — compatibility standard
