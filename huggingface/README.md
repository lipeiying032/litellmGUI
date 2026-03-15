-----

## title: AI Gateway Hub
emoji: rocket
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

|Secret            |Required|Description                                                    |
|------------------|--------|---------------------------------------------------------------|
|DATABASE_URL      |YES     |PostgreSQL URL. LiteLLM v1.81+ requires this for /model/new API|
|LITELLM_MASTER_KEY|YES     |Admin key e.g. sk-gateway-xxxx                                 |
|LITELLM_SALT_KEY  |YES     |Encrypts stored API keys. Never change after first use         |
|JWT_SECRET        |YES     |Session secret (random string)                                 |
|GATEWAY_PUBLIC_URL|YES     |https://username-space-name.hf.space                           |

### Free PostgreSQL Providers

|Provider|Free Tier|Link                |
|--------|---------|--------------------|
|Neon    |0.5 GB   |https://neon.tech   |
|Supabase|500 MB   |https://supabase.com|
|Railway |$5 credit|https://railway.app |

Copy the connection string (format: postgresql://user:pass@host:5432/dbname)
and paste it as the DATABASE_URL secret.

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

- DATABASE_URL is used by LiteLLM internally for model registration
- Your LLM provider API keys are stored encrypted in DB via LITELLM_SALT_KEY
- Set Space visibility to Private for production use
- Replace the GitHub link above with your actual repository URL