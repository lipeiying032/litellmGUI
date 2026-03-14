import { useState, useEffect } from "react";
import { Copy, Check, Zap } from "lucide-react";
import { api } from "../api";

export default function TestPanel() {
  const [models, setModels] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello! Tell me what model you are in one sentence." },
  ]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api.listModels()
      .then(r => {
        const enabled = r.data.filter(m => m.enabled && m.modelType === "chat");
        setModels(enabled);
        if (enabled.length > 0) setSelectedId(enabled[0].id);
      })
      .catch(() => {});
  }, []);

  const selected = models.find(m => m.id === selectedId);

  const addMessage = () => {
    setMessages(m => [...m, { role: "user", content: "" }]);
  };

  const updateMessage = (i, field, value) => {
    setMessages(m => m.map((msg, idx) => idx === i ? { ...msg, [field]: value } : msg));
  };

  const removeMessage = (i) => {
    setMessages(m => m.filter((_, idx) => idx !== i));
  };

  const runTest = async () => {
    const validMessages = messages.filter(m => m.content.trim());
    if (!selected || !validMessages.length) return;
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      const res = await api.testModel(selectedId, validMessages);
      setResponse({ ...res.data, _latency: Date.now() - start });
    } catch (e) {
      setResponse({ error: e.message, _latency: Date.now() - start });
    } finally {
      setLoading(false);
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const curlCode = selected
    ? `curl ${selected.openaiEndpoint}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer any-key" \\
  -d '${JSON.stringify({ model: selected.openaiModelName, messages: messages.filter(m => m.content.trim()) }, null, 2)}'`
    : "";

  const pythonCode = selected
    ? `from openai import OpenAI

client = OpenAI(
    base_url="${selected.openaiEndpoint}",
    api_key="any-key",
)

response = client.chat.completions.create(
    model="${selected.openaiModelName}",
    messages=${JSON.stringify(messages.filter(m => m.content.trim()), null, 4).replace(/^/gm, "    ").trim()},
)
print(response.choices[0].message.content)`
    : "";

  const jsCode = selected
    ? `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${selected.openaiEndpoint}",
  apiKey: "any-key",
  dangerouslyAllowBrowser: true,
});

const response = await client.chat.completions.create({
  model: "${selected.openaiModelName}",
  messages: ${JSON.stringify(messages.filter(m => m.content.trim()), null, 2)},
});
console.log(response.choices[0].message.content);`
    : "";

  const [codeTab, setCodeTab] = useState("curl");
  const codeMap = { curl: curlCode, python: pythonCode, javascript: jsCode };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-xl font-semibold text-text-primary">API Tester</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          Test your registered models with real requests.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Left: Request builder ── */}
        <div className="space-y-4">
          {/* Model select */}
          <div className="card p-4">
            <label className="text-xs font-medium text-text-secondary mb-2 block">
              Select Model
            </label>
            {models.length === 0 ? (
              <p className="text-text-muted text-sm">No chat models registered yet.</p>
            ) : (
              <select className="select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName} — {m.openaiModelName}</option>
                ))}
              </select>
            )}
            {selected && (
              <div className="mt-3 p-2.5 bg-surface-2 rounded-lg">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-muted">Endpoint:</span>
                  <span className="font-mono text-accent-cyan flex-1 truncate">{selected.openaiEndpoint}</span>
                  <button onClick={() => copy(selected.openaiEndpoint, "ep")}
                    className="text-text-muted hover:text-text-primary">
                    {copied === "ep" ? <Check size={11} className="text-accent-green" /> : <Copy size={11} />}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  <span className="text-text-muted">Model:</span>
                  <span className="font-mono text-accent-green flex-1 truncate">{selected.openaiModelName}</span>
                  <button onClick={() => copy(selected.openaiModelName, "mn")}
                    className="text-text-muted hover:text-text-primary">
                    {copied === "mn" ? <Check size={11} className="text-accent-green" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-text-secondary">Messages</label>
              <button onClick={addMessage} className="text-xs text-accent-green hover:underline">
                + Add message
              </button>
            </div>
            {messages.map((msg, i) => (
              <div key={i} className="flex gap-2 items-start">
                <select
                  className="select w-24 flex-shrink-0 text-xs py-1.5"
                  value={msg.role}
                  onChange={e => updateMessage(i, "role", e.target.value)}
                >
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
                <textarea
                  className="input flex-1 resize-none text-xs"
                  rows={msg.role === "system" ? 1 : 2}
                  value={msg.content}
                  onChange={e => updateMessage(i, "content", e.target.value)}
                  placeholder={`${msg.role} message…`}
                />
                {messages.length > 1 && (
                  <button onClick={() => removeMessage(i)}
                    className="text-text-muted hover:text-accent-red transition-colors mt-1.5">
                    <span className="text-xs">✕</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={runTest}
            disabled={loading || !selected}
            className="btn-primary w-full justify-center"
          >
            <Zap size={14} />
            {loading ? "Sending request…" : "Send Request"}
          </button>
        </div>

        {/* ── Right: Response + Code ── */}
        <div className="space-y-4">
          {/* Response */}
          <div className="card">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Response</span>
              {response && (
                <span className="text-xs font-mono text-text-muted">
                  {response._latency}ms
                </span>
              )}
            </div>
            <div className="p-4 min-h-[160px]">
              {loading && (
                <div className="flex items-center gap-2 text-text-muted text-sm">
                  <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
                  Waiting for response…
                </div>
              )}
              {!loading && !response && (
                <p className="text-text-muted text-sm">Response will appear here.</p>
              )}
              {!loading && response && (
                <>
                  {response.error ? (
                    <div className="text-accent-red text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(response.error, null, 2)}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-surface-2 rounded-lg">
                        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                          {/* FIX: response state shape is { success, latencyMs, response: <LiteLLM data>, _latency }
                               The actual LiteLLM chat completion object lives at response.response,
                               not at the top level. Previously accessed response.choices which was
                               always undefined, causing "No content in response" on every call. */}
                          {response.response?.choices?.[0]?.message?.content || "No content in response"}
                        </p>
                      </div>
                      {response.response?.usage && (
                        <div className="flex gap-4 text-xs text-text-muted font-mono">
                          <span>in: {response.response.usage.prompt_tokens}</span>
                          <span>out: {response.response.usage.completion_tokens}</span>
                          <span>total: {response.response.usage.total_tokens}</span>
                          <span>model: {response.response.model}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Code examples */}
          {selected && (
            <div className="card">
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                {["curl", "python", "javascript"].map(t => (
                  <button
                    key={t}
                    onClick={() => setCodeTab(t)}
                    className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                      codeTab === t
                        ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  onClick={() => copy(codeMap[codeTab], "code")}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {copied === "code"
                    ? <Check size={13} className="text-accent-green" />
                    : <Copy size={13} />
                  }
                </button>
              </div>
              <div className="code-block m-4 mt-3 text-text-secondary max-h-56 overflow-y-auto">
                {codeMap[codeTab]}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}