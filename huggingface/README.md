---
title: AI Gateway Hub
emoji: 🚀
colorFrom: green
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Universal AI API Gateway — any provider → OpenAI-compatible endpoint
---

# 🚀 AI Gateway Hub

> **Universal AI API Gateway** — Register any AI provider (OpenAI, Anthropic, Ollama, Gemini, Groq, and 100+ more) and get a single OpenAI-compatible endpoint. Powered by [LiteLLM](https://litellm.ai).

## ⚙️ Setup (Required Before First Use)

This Space needs a few secrets set before it will work correctly.

Go to **Space Settings → Repository secrets** and add:

| Secret | Required | Description |
|---|---|---|
| `LITELLM_MASTER_KEY` | ✅ Yes | Admin key for the LiteLLM proxy. Use a strong random string, e.g. `sk-gateway-xxxxxxxx` |
| `JWT_SECRET` | ✅ Yes | Secret for backend session tokens. Any long random string |
| `GATEWAY_PUBLIC_URL` | ✅ Yes | The public URL of this Space: `https://<your-username>-<space-name>.hf.space` |
| `OPENAI_API_KEY` | Optional | Required only if you register OpenAI models |
| `ANTHROPIC_API_KEY` | Optional | Required only if you register Anthropic models |
| `GROQ_API_KEY` | Optional | Required only if you register Groq models |
| `GEMINI_API_KEY` | Optional | Required only if you register Google Gemini models |

> **Tip:** `GATEWAY_PUBLIC_URL` is set automatically on the **first** deploy by the GitHub Actions workflow and is never overwritten afterward, so you can safely customise it to a custom domain later.

> **Tip:** Any provider API key you register through the UI is stored encrypted in the Space's SQLite database and never exposed to callers of the gateway.

## 🚀 Quick Start

1. After setting secrets above, wait for the Space to restart (it rebuilds automatically)
2. Open the Space — you'll see the **AI Gateway Hub** dashboard
3. Click **Add Model** and fill in your provider details
4. Use the generated `model name` with any OpenAI SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://<your-username>-<space-name>.hf.space/v1",
    api_key="any-string",   # callers don't need the real provider key
)

response = client.chat.completions.create(
    model="anthropic/claude-3-5-sonnet-20241022",  # alias shown in the UI
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

## 📡 API Endpoints

| Path | Description |
|---|---|
| `GET  /` | Web dashboard |
| `POST /v1/chat/completions` | OpenAI-compatible chat (streaming supported) |
| `POST /v1/embeddings` | Text embeddings |
| `GET  /v1/models` | List registered models |
| `GET  /api/models` | Management API — list models |
| `POST /api/models` | Management API — register model |
| `GET  /api/health` | Health check |

## 📦 Supported Providers

OpenAI · Anthropic · Google Gemini · Ollama · Groq · Mistral · Cohere · Together AI · AWS Bedrock · Azure OpenAI · HuggingFace · DeepSeek · Perplexity · Replicate · any OpenAI-compatible endpoint

Full list: [docs.litellm.ai/docs/providers](https://docs.litellm.ai/docs/providers)

## ⚠️ Important Notes

- **Persistence:** The SQLite database (`/app/data/gateway.db`) storing your registered models is **ephemeral** on the free CPU Basic hardware tier — it resets on Space restart. To persist data, upgrade to a paid hardware tier or use an external database.
- **Rate limits:** The free HF Spaces tier has CPU/memory limits. For production use, consider duplicating this Space with upgraded hardware.
- **Security:** This Space is public by default. Anyone can call your `/v1/*` endpoints. For private use, set the Space visibility to **Private** in Space Settings.

## 🔗 Source

This Space is automatically deployed from the [AI Gateway Hub GitHub repository](https://github.com/your-org/ai-gateway-hub).

> Replace `your-org/ai-gateway-hub` above with your actual repository URL.