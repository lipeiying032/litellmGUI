import { Cpu, Activity, CheckCircle2, Clock } from "lucide-react";

export default function StatsBar({ stats }) {
  const items = [
    { icon: Cpu, label: "Total Models", value: stats.totalModels },
    { icon: CheckCircle2, label: "Active", value: stats.enabledModels, accent: "green" },
    { icon: Activity, label: "Requests", value: stats.totalRequests },
    {
      icon: Clock,
      label: "Avg Latency",
      value: stats.avgLatency ? `${Math.round(stats.avgLatency)}ms` : "—",
    },
  ];

  return (
    <div className="border-b border-white/5 bg-surface-1/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-6 overflow-x-auto">
        {items.map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="flex items-center gap-2 flex-shrink-0">
            <Icon size={12} className={accent === "green" ? "text-accent-green" : "text-text-muted"} />
            <span className="text-text-muted text-xs">{label}:</span>
            <span className={`text-xs font-mono font-medium ${
              accent === "green" ? "text-accent-green" : "text-text-secondary"
            }`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
