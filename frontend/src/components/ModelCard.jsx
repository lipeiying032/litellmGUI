import { useState } from "react";
import {
  Copy, Check, Pencil, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Terminal, Globe, Key
} from "lucide-react";
import { api } from "../api";

const TYPE_BADGE = {
  chat: "badge-green",
  embedding: "badge-cyan",
  image: "badge-purple",
  audio: "badge-orange",
  completion: "badge-gray",
};

export default function ModelCard({ model, onEdit, onDelete, onToggle }) {
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testModel(model.id);
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`card flex flex-col animate-slide-in transition-all duration-200 ${
      model.enabled ? "" : "opacity-50"
    }`}>
      {/* ── Card header ── */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${TYPE_BADGE[model.modelType] || "badge-gray"}`}>
              {model.modelType || "chat"}
            </span>
            <span className="badge badge-gray">{model.provider}</span>
            {!model.enabled && <span className="badge badge-gray">disabled</span>}
          </div>
          <h3 className="font-display font-semibold text-text-primary mt-2 text-sm leading-tight">
            {model.displayName}
          </h3>
          {model.description && (
            <p className="text-text-muted text-xs mt-1 leading-relaxed line-clamp-2">
              {model.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onToggle} title={model.enabled ? "Disable" : "Enable"}
            className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors">
            {model.enabled
              ? <ToggleRight size={16} className="text-accent-green" />
              : <ToggleLeft size={16} />
            }
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded text-text-muted hover:text-text-primary transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded text-text-muted hover:text-accent-red transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <hr className="divider" />

      {/* ── Endpoint info ── */}
      <div className="p-4 space-y-2">
        <InfoRow
          icon={Globe}
          label="Endpoint"
          value={model.openaiEndpoint}
          onCopy={() => copy(model.openaiEndpoint, "endpoint")}
          copied={copied === "endpoint"}
          mono
        />
        <InfoRow
          icon={Terminal}
          label="Model Name"
          value={model.openaiModelName}
          onCopy={() => copy(model.openaiModelName, "model")}
          copied={copied === "model"}
          mono
          accent
        />
        {model.apiBase && (
          <InfoRow
            icon={Globe}
            label="Source API"
            value={model.apiBase}
            mono
          />
        )}
        <InfoRow
          icon={Key}
          label="API Key"
          value={model.apiKey ? "Configured ✓" : "Not required / None"}
          className={model.apiKey ? "text-accent-green" : "text-text-muted"}
        />
      </div>

      {/* ── Expandable section ── */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs
                     text-text-muted hover:text-text-secondary transition-colors"
        >
          <span>LiteLLM model: <span className="font-mono text-text-secondary">{model.litellmModel}</span></span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 animate-slide-in">
            {/* Curl example */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted font-mono">curl</span>
                <button
                  onClick={() => copy(model.curlExample, "curl")}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  {copied === "curl" ? <Check size={12} className="text-accent-green" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="code-block text-text-secondary text-[0.7rem] leading-relaxed max-h-32 overflow-y-auto">
                {model.curlExample}
              </div>
            </div>

            {/* Test button */}
            <div>
              <button
                onClick={runTest}
                disabled={testing || !model.enabled}
                className="btn-secondary w-full justify-center text-xs"
              >
                {testing ? (
                  <><RefreshCwIcon className="animate-spin" size={12} /> Testing…</>
                ) : "Run connectivity test"}
              </button>

              {testResult && (
                <div className={`mt-2 p-2 rounded text-xs font-mono border ${
                  testResult.success
                    ? "bg-accent-green/5 border-accent-green/20 text-accent-green"
                    : "bg-accent-red/5 border-accent-red/20 text-accent-red"
                }`}>
                  {testResult.success
                    ? `✓ OK — ${testResult.latencyMs}ms`
                    : `✗ ${JSON.stringify(testResult.error)?.slice(0, 120)}`
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, onCopy, copied, mono, accent, className }) {
  return (
    <div className="flex items-center gap-2 group">
      <Icon size={11} className="text-text-muted flex-shrink-0" />
      <span className="text-text-muted text-xs flex-shrink-0 w-20">{label}</span>
      <span className={`text-xs flex-1 truncate ${
        mono ? "font-mono" : ""
      } ${accent ? "text-accent-cyan" : "text-text-secondary"} ${className || ""}`}>
        {value}
      </span>
      {onCopy && (
        <button
          onClick={onCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary flex-shrink-0"
        >
          {copied
            ? <Check size={11} className="text-accent-green" />
            : <Copy size={11} />
          }
        </button>
      )}
    </div>
  );
}

// Inline icon to avoid import issues
function RefreshCwIcon({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
