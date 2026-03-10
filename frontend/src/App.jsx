import { useState, useEffect } from "react";
import {
  Cpu, LayoutGrid, FlaskConical, BookOpen,
  Github, Activity, ChevronRight, Zap
} from "lucide-react";
import { api } from "./api";
import ModelManager from "./components/ModelManager";
import TestPanel from "./components/TestPanel";
import DocsView from "./components/DocsView";
import StatsBar from "./components/StatsBar";

const NAV = [
  { id: "models", label: "Models", icon: LayoutGrid },
  { id: "test", label: "Test API", icon: FlaskConical },
  { id: "docs", label: "Integration Docs", icon: BookOpen },
];

export default function App() {
  const [tab, setTab] = useState("models");
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    Promise.all([api.getStats(), api.getHealth()])
      .then(([s, h]) => { setStats(s.data); setHealth(h.data); })
      .catch(() => {});

    const interval = setInterval(() => {
      api.getStats().then(s => setStats(s.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green to-accent-cyan
                            flex items-center justify-center">
              <Zap size={16} className="text-surface-0" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-semibold text-text-primary text-sm">
                AI Gateway
              </span>
              <span className="font-display font-semibold text-accent-green text-sm">Hub</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-text-muted">
              <ChevronRight size={12} />
              <span className="text-xs font-mono text-text-secondary">LiteLLM-powered</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                            transition-all duration-150 ${
                  tab === id
                    ? "bg-accent-green/10 text-accent-green border border-accent-green/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Status + GitHub */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusDot health={health} />
            <a
              href="https://github.com/your-org/ai-gateway-hub"
              target="_blank"
              rel="noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </header>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {stats && <StatsBar stats={stats} />}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {tab === "models" && <ModelManager />}
        {tab === "test"   && <TestPanel />}
        {tab === "docs"   && <DocsView />}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-4 text-center">
        <p className="text-text-muted text-xs font-mono">
          AI Gateway Hub · Powered by{" "}
          <a href="https://litellm.ai" target="_blank" rel="noreferrer"
             className="text-accent-green hover:underline">LiteLLM</a>
          {" "}· OpenAI-compatible proxy for any AI provider
        </p>
      </footer>
    </div>
  );
}

function StatusDot({ health }) {
  if (!health) return null;
  const allOk = Object.values(health).every(v => v === "ok");
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className={`w-1.5 h-1.5 rounded-full ${
        allOk ? "bg-accent-green animate-pulse" : "bg-accent-orange"
      }`} />
      <span className="text-text-muted hidden sm:inline font-mono">
        {allOk ? "online" : "degraded"}
      </span>
    </div>
  );
}
