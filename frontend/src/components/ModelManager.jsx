import { useState, useEffect } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "../api";
import ModelCard from "./ModelCard";
import ModelForm from "./ModelForm";

export default function ModelManager() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editModel, setEditModel] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listModels();
      setModels(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm("Delete this model? It will be removed from the gateway.")) return;
    await api.deleteModel(id);
    setModels(m => m.filter(x => x.id !== id));
  };

  const handleToggle = async (id) => {
    const res = await api.toggleModel(id);
    setModels(m => m.map(x => x.id === id ? res.data : x));
  };

  const handleSave = async (data) => {
    if (editModel) {
      const res = await api.updateModel(editModel.id, data);
      setModels(m => m.map(x => x.id === editModel.id ? res.data : x));
    } else {
      const res = await api.createModel(data);
      setModels(m => [res.data, ...m]);
    }
    setShowForm(false);
    setEditModel(null);
  };

  const TYPE_COLORS = {
    chat: "green", embedding: "cyan", image: "purple",
    audio: "orange", completion: "gray",
  };

  const filtered = filter === "all"
    ? models
    : models.filter(m => m.modelType === filter || (filter === "enabled" ? m.enabled : !m.enabled));

  const types = [...new Set(models.map(m => m.modelType))].filter(Boolean);

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Model Registry
          </h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Register any AI model and get an OpenAI-compatible endpoint instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary" title="Refresh">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { setEditModel(null); setShowForm(true); }} className="btn-primary">
            <Plus size={14} />
            Add Model
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {models.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {["all", "enabled", ...types].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`badge cursor-pointer transition-all ${
                filter === f
                  ? `badge-${TYPE_COLORS[f] || "green"}`
                  : "badge-gray hover:border-surface-4"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-surface-3 rounded w-2/3 mb-3" />
              <div className="h-3 bg-surface-3 rounded w-full mb-2" />
              <div className="h-3 bg-surface-3 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} hasModels={models.length > 0} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              onEdit={() => { setEditModel(model); setShowForm(true); }}
              onDelete={() => handleDelete(model.id)}
              onToggle={() => handleToggle(model.id)}
            />
          ))}
        </div>
      )}

      {/* ── Form modal ── */}
      {showForm && (
        <ModelForm
          initial={editModel}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditModel(null); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd, hasModels }) {
  return (
    <div className="card p-12 text-center border-dashed">
      <div className="w-14 h-14 rounded-2xl bg-accent-green/10 border border-accent-green/20
                      flex items-center justify-center mx-auto mb-4">
        <Plus size={24} className="text-accent-green" />
      </div>
      <h3 className="font-display font-semibold text-text-primary mb-1">
        {hasModels ? "No models match this filter" : "No models registered yet"}
      </h3>
      <p className="text-text-secondary text-sm mb-5 max-w-sm mx-auto">
        {hasModels
          ? "Try a different filter to see your models."
          : "Add your first model to start routing AI requests through an OpenAI-compatible endpoint."}
      </p>
      {!hasModels && (
        <button onClick={onAdd} className="btn-primary mx-auto">
          <Plus size={14} />
          Add your first model
        </button>
      )}
    </div>
  );
}
