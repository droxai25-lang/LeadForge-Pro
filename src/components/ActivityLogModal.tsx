import type React from "react";
import { useState, useMemo } from "react";
import {
  Activity,
  X,
  Search,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  Layers,
  ChevronDown,
  ChevronRight,
  Database,
  Send,
  Zap,
  Globe
} from "lucide-react";
import type { ActivityLogRecord, ActivityActionType } from "../types";

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLogRecord[];
  isLoading?: boolean;
  onRefresh: () => void;
  onClearLogs?: () => void;
  isDeveloperAdmin?: boolean;
}

export const ActivityLogModal: React.FC<ActivityLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  isLoading = false,
  onRefresh,
  onClearLogs,
  isDeveloperAdmin = false
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filter categories
  const categories = [
    { id: "all", label: "All Events" },
    { id: "enrichment", label: "Enrichment & DNS" },
    { id: "stages", label: "Stage Changes" },
    { id: "ingestion", label: "Ingestion" },
    { id: "exports", label: "Exports & Webhooks" },
    { id: "admin", label: "Administrative & Auth" }
  ];

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory === "enrichment") {
        if (!["bulk_enrich", "single_enrich", "dns_verify"].includes(log.actionType)) return false;
      } else if (selectedCategory === "stages") {
        if (log.actionType !== "bulk_stage_change") return false;
      } else if (selectedCategory === "ingestion") {
        if (!["single_ingest", "batch_ingest"].includes(log.actionType)) return false;
      } else if (selectedCategory === "exports") {
        if (!["export_csv", "export_json", "webhook_dispatch"].includes(log.actionType)) return false;
      } else if (selectedCategory === "admin") {
        if (!["delete", "bulk_delete", "role_switch", "login"].includes(log.actionType)) return false;
      }

      // Status filter
      if (statusFilter !== "all" && log.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDesc = log.description.toLowerCase().includes(q);
        const matchesOp = log.operatorEmail.toLowerCase().includes(q);
        const matchesType = log.actionType.toLowerCase().includes(q);
        const matchesRole = log.operatorRole.toLowerCase().includes(q);
        const matchesMeta = log.metadata ? JSON.stringify(log.metadata).toLowerCase().includes(q) : false;
        return matchesDesc || matchesOp || matchesType || matchesRole || matchesMeta;
      }

      return true;
    });
  }, [logs, selectedCategory, statusFilter, searchQuery]);

  if (!isOpen) return null;

  const getActionBadge = (actionType: ActivityActionType) => {
    switch (actionType) {
      case "bulk_enrich":
      case "single_enrich":
        return {
          label: actionType === "bulk_enrich" ? "Bulk Enrichment" : "Single Enrich",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: Zap
        };
      case "bulk_stage_change":
        return {
          label: "Stage Transition",
          color: "bg-sky-500/10 text-sky-400 border-sky-500/30",
          icon: Layers
        };
      case "webhook_dispatch":
        return {
          label: "Webhook Sync",
          color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
          icon: Send
        };
      case "export_csv":
      case "export_json":
        return {
          label: actionType === "export_csv" ? "CSV Export" : "JSON Export",
          color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
          icon: Download
        };
      case "single_ingest":
      case "batch_ingest":
        return {
          label: "Data Ingest",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: Database
        };
      case "dns_verify":
        return {
          label: "DNS MX Verify",
          color: "bg-teal-500/10 text-teal-400 border-teal-500/30",
          icon: Globe
        };
      case "bulk_delete":
      case "delete":
        return {
          label: actionType === "bulk_delete" ? "Bulk Delete" : "Delete Lead",
          color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
          icon: Trash2
        };
      default:
        return {
          label: actionType.replace(/_/g, " "),
          color: "bg-slate-700/50 text-slate-300 border-slate-600",
          icon: Activity
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = Date.now();
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 10) return "just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return isoString;
    }
  };

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["ID", "Timestamp", "Action Type", "Operator", "Role", "Target Count", "Status", "Description"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.actionType,
      `"${l.operatorEmail.replace(/"/g, '""')}"`,
      l.operatorRole,
      l.targetCount,
      l.status,
      `"${l.description.replace(/"/g, '""')}"`
    ]);

    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(","), ...rows.map((r) => r.join(","))].join("\n")}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leadforge_activity_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (filteredLogs.length === 0) return;
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(filteredLogs, null, 2))}`;
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `leadforge_activity_audit_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id="user-activity-log-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-log-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="activity-log-heading" className="text-lg font-semibold text-white tracking-tight">
                  User Activity & Operator Audit Log
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {logs.length} Recorded Events
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Transparent telemetry tracking for bulk enrichments, stage changes, exports, and operator interventions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition disabled:opacity-50"
              title="Refresh Activity Logs (Press R)"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit trail by operator, description, action..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Actions: Export Audit Log */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={filteredLogs.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                disabled={filteredLogs.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>JSON</span>
              </button>

              {isDeveloperAdmin && onClearLogs && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to clear the operator activity audit trail?")) {
                      onClearLogs();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium border border-rose-800/60 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear Logs</span>
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-md font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {cat.label}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-800 mx-1" />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success Only</option>
              <option value="warning">Warning Only</option>
              <option value="error">Errors Only</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table / Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 p-6">
              <Activity className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-400">No activity logs matching your filter criteria</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Perform live enrichments, lead qualification, or ingestion to record operator actions in real time.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.actionType);
              const IconComp = badge.icon;
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  className={`rounded-lg border transition ${
                    isExpanded
                      ? "bg-slate-800/90 border-slate-600 shadow-md"
                      : "bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    aria-expanded={isExpanded}
                    className="w-full p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none text-left"
                  >
                    {/* Left: Icon & Description */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-1.5 rounded-md border ${badge.color} mt-0.5 shrink-0`}>
                        <IconComp className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${badge.color}`}>
                            {badge.label}
                          </span>

                          <span className="text-xs font-semibold text-white">{log.description}</span>

                          {log.targetCount > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                              {log.targetCount} targets
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-500" />
                            <strong className="text-slate-300">{log.operatorEmail}</strong>
                            <span className="text-slate-500">({log.operatorRole})</span>
                          </span>

                          <span>•</span>

                          <span title={log.timestamp} className="font-mono text-slate-400">
                            {formatRelativeTime(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Indicator & Chevron */}
                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                      {log.status === "success" && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Success</span>
                        </span>
                      )}
                      {log.status === "warning" && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Warning</span>
                        </span>
                      )}
                      {log.status === "error" && (
                        <span className="flex items-center gap-1 text-[11px] text-rose-400 font-medium bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3" />
                          <span>Error</span>
                        </span>
                      )}

                      <div className="text-slate-500">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Telemetry Metadata */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-800 bg-slate-950/40 text-xs space-y-2 animate-in fade-in duration-100">
                      <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                        <span>Event ID: {log.id}</span>
                        <span>Exact Timestamp: {new Date(log.timestamp).toUTCString()}</span>
                      </div>

                      {log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-slate-300">
                            Telemetry Payload & Parameters:
                          </div>
                          <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-slate-500 italic text-[11px]">
                          No additional metadata recorded for this action.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Audit telemetry actively recording in-memory and synced across operator sessions</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
