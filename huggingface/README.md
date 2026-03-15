-----

## title: AI Gateway Hub
emoji: 🚀
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Universal AI Gateway – any provider to OpenAI API

# AI Gateway Hub

Universal AI API Gateway powered by LiteLLM.
Register any AI provider and get a single OpenAI-compatible endpoint.

## Required Setup

Go to **Space Settings -> Repository secrets** and add:

|Secret              |Required|Description                                              |
|--------------------|--------|---------------------------------------------------------|
|`DATABASE_URL`      |YES     |PostgreSQL direct connection URL (not transaction pooler)|
|`LITELLM_MASTER_KEY`|YES     |Admin key e.g. `sk-gateway-xxxx`                         |
|`LITELLM_SALT_KEY`  |YES     |Encrypts stored API keys. Never change after first use   |
|`JWT_SECRET`        |YES     |Session secret (random string)                           |
|`GATEWAY_PUBLIC_URL`|YES     |`https://username-space-name.hf.space`                   |

### Free PostgreSQL Providers

|Provider|Free Tier|Link                |
|--------|---------|--------------------|
|Neon    |0.5 GB   |https://neon.tech   |
|Supabase|500 MB   |https://supabase.com|
|Railway |$5 credit|https://railway.app |

Use **Direct connection** (port 5432), NOT transaction pooler (port 6432).
LiteLLM uses prepared statements which are incompatible with transaction pooling.

## Quick Start

```python
from openai import OpenAI
client = OpenAI(
    base_url="https://username-space-name.hf.space/v1",
    api_key="any-string",
)
response = client.chat.completions.create(
    model="your-registered-model-alias",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)
```

## Notes

- `DATABASE_URL` is used by LiteLLM internally for dynamic model registration
- Your LLM provider API keys are stored encrypted in DB via `LITELLM_SALT_KEY`
- Set Space visibility to Private for production use