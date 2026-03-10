import { useState, useEffect } from "react";
import { X, ExternalLink, Info, Eye, EyeOff } from "lucide-react";
import { api } from "../api";

const MODEL_TYPES = [
  { value: "chat",       label: "Chat / Instruct" },
  { value: "completion", label: "Text Completion" },
  { value: "embedding",  label: "Embedding" },
  { value: "image",      label: "Image Generation" },
  { value: "audio",      label: "Audio / Speech" },
];

export default function ModelForm({ initial, onSave, onClose }) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    displayName: initial?.displayName || "",
    provider:    initial?.provider    || "",
    litellmModel:initial?.litellmModel|| "",
    apiBase:     initial?.apiBase     || "",
    apiKey:      "",
    description: initial?.description || "",
    modelType:   initial?.modelType   || "chat",
    tags:        initial?.tags?.join(", ") || "",
  });

  const [providers, setProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);

  useEffect(() => {
    api.getProviders().then(r => setProviders(r.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleProviderSelect = (e) => {
    const prov = providers.find(p => p.id === e.target.value);
    setSelectedProvider(prov || null);
    if (prov) {
      setForm(f => ({
        ...f,
        provider: prov.id,
        apiBase: prov.defaultApiBase || "",
        litellmModel: prov.exampleModels?.[0] || "",
        modelType: prov.modelTypes?.[0] || "chat",
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.displayName.trim() || !form.provider.trim() || !form.litellmModel.trim()) {
      setError("Display name, provider, and LiteLLM model are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        apiKey: form.apiKey || undefined,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl glass rounded-xl border border-white/10
                      shadow-2xl shadow-black/50 animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="font-display font-semibold text-text-primary">
              {isEdit ? "Edit Model" : "Register New Model"}
            </h2>
            <p className="text-text-muted text-xs mt-0.5">
              {isEdit ? "Update model configuration." : "Add any AI model to the gateway."}
            </p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Provider quick-select */}
          {!isEdit && providers.length > 0 && (
            <div>
              <label className="form-label">Quick-select provider</label>
              <select className="select" onChange={handleProviderSelect} defaultValue="">
                <option value="">— choose a provider to pre-fill —</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedProvider && (
                <a
                  href={selectedProvider.docs}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent-cyan text-xs mt-1.5 hover:underline"
                >
                  <ExternalLink size={10} />
                  LiteLLM docs for {selectedProvider.name}
                </a>
              )}
            </div>
          )}

          {/* Display name */}
          <div>
            <label className="form-label">Display Name <Required /></label>
            <input
              className="input"
              placeholder="e.g. My Claude Proxy"
              value={form.displayName}
              onChange={set("displayName")}
            />
          </div>

          {/* Provider */}
          <div>
            <label className="form-label">Provider ID <Required /></label>
            <input
              className="input"
              placeholder="e.g. anthropic, openai, ollama"
              value={form.provider}
              onChange={set("provider")}
            />
            <p className="text-text-muted text-xs mt-1">
              Used to build the OpenAI model alias: <span className="font-mono">provider/model</span>
            </p>
          </div>

          {/* LiteLLM model name */}
          <div>
            <label className="form-label">
              LiteLLM Model Name <Required />
              <a
                href="https://docs.litellm.ai/docs/providers"
                target="_blank" rel="noreferrer"
                className="ml-2 text-accent-cyan text-xs inline-flex items-center gap-0.5 hover:underline"
              >
                <ExternalLink size={9} /> LiteLLM docs
              </a>
            </label>
            <input
              className="input input-mono"
              placeholder="e.g. anthropic/claude-3-5-sonnet-20241022"
              value={form.litellmModel}
              onChange={set("litellmModel")}
            />
            {selectedProvider?.exampleModels?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {selectedProvider.exampleModels.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, litellmModel: m }))}
                    className="badge badge-gray cursor-pointer hover:badge-green font-mono text-[0.65rem]"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API Base */}
          <div>
            <label className="form-label">API Base URL <span className="text-text-muted">(optional)</span></label>
            <input
              className="input input-mono"
              placeholder="e.g. https://api.anthropic.com  or  http://localhost:11434"
              value={form.apiBase}
              onChange={set("apiBase")}
            />
            <p className="text-text-muted text-xs mt-1">
              Leave blank to use LiteLLM's default for this provider.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="form-label">
              API Key <span className="text-text-muted">(optional)</span>
            </label>
            <div className="relative">
              <input
                className="input input-mono pr-9"
                placeholder={isEdit ? "Leave blank to keep existing" : "sk-… (leave empty for keyless providers)"}
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={set("apiKey")}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
              <Info size={10} />
              Keys are stored server-side and masked in the UI.
              For Ollama and local models, no key is needed.
            </p>
          </div>

          {/* Model type */}
          <div>
            <label className="form-label">Model Type</label>
            <select className="select" value={form.modelType} onChange={set("modelType")}>
              {MODEL_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description <span className="text-text-muted">(optional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Brief description of this model endpoint…"
              value={form.description}
              onChange={set("description")}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="form-label">Tags <span className="text-text-muted">(comma-separated)</span></label>
            <input
              className="input"
              placeholder="e.g. production, fast, vision"
              value={form.tags}
              onChange={set("tags")}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/5 bg-surface-1/30">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Register Model"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Required() {
  return <span className="text-accent-red text-xs ml-0.5">*</span>;
}
// BUG FIX: Removed module-level document.createElement("style") — it ran on every
// module evaluation and injected duplicate <style> tags on HMR reloads.
// The .form-label class is now defined in index.css @layer components.
