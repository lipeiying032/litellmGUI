import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

export default function DocsView() {
  const [copied, setCopied] = useState(null);
  const BASE = window.location.origin;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const sections = [
    {
      id: "overview",
      title: "Overview",
      content: (
        <div className="space-y-3 text-text-secondary text-sm leading-relaxed">
          <p>
            AI Gateway Hub proxies any AI provider through a single{" "}
            <span className="badge badge-green font-mono text-xs">OpenAI-compatible</span>{" "}
            API endpoint. Add any model via the UI, then call it using the standard OpenAI SDK
            from any language.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {[
              { label: "Base URL", value: `${BASE}/v1`, badge: "green" },
              { label: "Auth", value: "Any bearer token (passthrough)", badge: "cyan" },
              { label: "Protocol", value: "OpenAI API v1", badge: "purple" },
            ].map(({ label, value, badge }) => (
              <div key={label} className="card p-3">
                <div className={`badge badge-${badge} mb-2`}>{label}</div>
                <p className="font-mono text-xs text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "python",
      title: "Python (openai SDK)",
      lang: "python",
      code: `from openai import OpenAI

# Point the official OpenAI SDK at your gateway
client = OpenAI(
    base_url="${BASE}/v1",
    api_key="any-string",   # No real key needed for keyless providers
)

# Chat completions
response = client.chat.completions.create(
    model="anthropic-claude-3-5-sonnet-20241022",  # Your registered alias
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum entanglement simply."},
    ],
    temperature=0.7,
)
print(response.choices[0].message.content)

# Streaming
stream = client.chat.completions.create(
    model="ollama-llama3",
    messages=[{"role": "user", "content": "Write a haiku."}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)

# Embeddings
embedding = client.embeddings.create(
    model="openai-text-embedding-3-small",
    input="Hello world",
)
print(embedding.data[0].embedding[:5])`,
    },
    {
      id: "nodejs",
      title: "Node.js / TypeScript",
      lang: "javascript",
      code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE}/v1",
  apiKey: "any-string",
});

// Chat completions
const response = await client.chat.completions.create({
  model: "anthropic-claude-3-5-sonnet-20241022",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "What is the capital of France?" },
  ],
});
console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: "ollama-llama3",
  messages: [{ role: "user", content: "Count to 10." }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
    },
    {
      id: "curl",
      title: "cURL",
      lang: "bash",
      code: `# Chat completion
curl ${BASE}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer any-key" \\
  -d '{
    "model": "anthropic-claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello, who are you?"}
    ]
  }'

# List available models
curl ${BASE}/v1/models \\
  -H "Authorization: Bearer any-key"

# Embeddings
curl ${BASE}/v1/embeddings \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer any-key" \\
  -d '{
    "model": "openai-text-embedding-3-small",
    "input": "The food was delicious."
  }'`,
    },
    {
      id: "langchain",
      title: "LangChain",
      lang: "python",
      code: `from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Drop-in replacement — just change base_url
llm = ChatOpenAI(
    base_url="${BASE}/v1",
    api_key="any-key",
    model="anthropic-claude-3-5-sonnet-20241022",
    temperature=0,
)

result = llm.invoke("What are the benefits of LangChain?")
print(result.content)

# Embeddings
embeddings = OpenAIEmbeddings(
    base_url="${BASE}/v1",
    api_key="any-key",
    model="openai-text-embedding-3-small",
)
vector = embeddings.embed_query("Hello world")`,
    },
    {
      id: "litellm_sdk",
      title: "LiteLLM SDK",
      lang: "python",
      code: `import litellm

# Call via gateway
response = litellm.completion(
    model="openai/anthropic-claude-3-5-sonnet-20241022",
    api_base="${BASE}/v1",
    api_key="any-key",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`,
    },
    {
      id: "endpoints",
      title: "Supported Endpoints",
      content: (
        <div className="space-y-2">
          {[
            { method: "POST", path: "/v1/chat/completions",    desc: "Chat completions (streaming supported)" },
            { method: "POST", path: "/v1/completions",         desc: "Text completions" },
            { method: "POST", path: "/v1/embeddings",          desc: "Text embeddings" },
            { method: "POST", path: "/v1/images/generations",  desc: "Image generation (DALL-E / Stable Diffusion)" },
            { method: "POST", path: "/v1/audio/speech",        desc: "Text-to-speech" },
            { method: "POST", path: "/v1/audio/transcriptions",desc: "Speech-to-text (Whisper)" },
            { method: "GET",  path: "/v1/models",              desc: "List all registered models" },
          ].map(({ method, path, desc }) => (
            <div key={path} className="flex items-center gap-3 text-sm py-2 border-b border-white/5 last:border-0">
              <span className={`badge flex-shrink-0 ${
                method === "GET" ? "badge-cyan" : "badge-green"
              }`}>{method}</span>
              <span className="font-mono text-text-primary text-xs flex-shrink-0">{path}</span>
              <span className="text-text-muted text-xs">{desc}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const [active, setActive] = useState("overview");
  const [codeTab, setCodeTab] = useState("curl"); // BUG FIX: removed unused `lang` state

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-text-primary">Integration Docs</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Use any OpenAI-compatible client to connect to your registered models.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="hidden lg:block w-44 flex-shrink-0 space-y-0.5">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                active === s.id
                  ? "bg-accent-green/10 text-accent-green"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              }`}
            >
              {s.title}
            </button>
          ))}
          <div className="pt-3 border-t border-white/5 mt-3">
            <a
              href="https://docs.litellm.ai/docs/providers"
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-text-muted hover:text-accent-cyan"
            >
              <ExternalLink size={10} />
              LiteLLM Providers
            </a>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile tab strip */}
          <div className="lg:hidden flex gap-1 flex-wrap mb-4">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`badge cursor-pointer ${active === s.id ? "badge-green" : "badge-gray"}`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {sections
            .filter(s => s.id === active)
            .map(s => (
              <div key={s.id} className="card p-5 animate-slide-in">
                <h2 className="font-display font-semibold text-text-primary mb-4">{s.title}</h2>
                {s.content && s.content}
                {s.code && (
                  <div className="relative">
                    <button
                      onClick={() => copy(s.code, s.id)}
                      className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors z-10"
                    >
                      {copied === s.id
                        ? <Check size={13} className="text-accent-green" />
                        : <Copy size={13} />
                      }
                    </button>
                    <div className="code-block text-text-secondary text-[0.75rem] leading-relaxed">
                      {s.code}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
