import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { AuthUser, Lead } from "../types";
import { X, Settings, Database, Cpu, Sparkles, RefreshCw, Trash2, UserCog, CheckCircle2, Zap } from "lucide-react";

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onClearData: () => Promise<void>;
  leads: Lead[];
}

interface QueueFailure {
  jobId: string;
  dispatchId: string;
  failedReason: string;
  attemptsMade: number;
  finishedOn: string | null;
}

interface OperationsSnapshot {
  queue: Record<string, number>;
  failures: QueueFailure[];
  retention: {
    retainedCrawlSnapshots: number;
    batchesExpiringWithinSevenDays: number;
    purgedBatches: number;
  };
}

interface AiDiagnosticResult {
  success: boolean;
  latencyMs?: number;
  hasLlmKey?: boolean;
  response?: string;
  error?: string;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onClearData,
  leads
}) => {
  const [activeTab, setActiveTab] = useState<"database" | "ai_diagnostics" | "roles">("database");
  const [isWiping, setIsWiping] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [operations, setOperations] = useState<OperationsSnapshot | null>(null);
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);

  // AI Diagnostics state
  const [aiTestPrompt, setAiTestPrompt] = useState(
    "Generate a 1-sentence personalized value proposition for LeadForge B2B pipeline automation."
  );
  const [aiTestResult, setAiTestResult] = useState<AiDiagnosticResult | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);

  const fetchOperations = useCallback(async () => {
    setIsLoadingOperations(true);
    try {
      const response = await fetch("/api/admin/operations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operational telemetry is unavailable.");
      setOperations(data);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Operational telemetry is unavailable.");
    } finally {
      setIsLoadingOperations(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "database") void fetchOperations();
  }, [isOpen, activeTab, fetchOperations]);

  const recoverQueueFailure = async (jobId: string) => {
    const response = await fetch(`/api/admin/queue-failures/${encodeURIComponent(jobId)}/recover`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setActionMessage(data.error || "Queue recovery failed.");
      return;
    }
    setActionMessage(`Requeued confirmed pre-SMTP dispatch ${data.dispatchId}.`);
    await fetchOperations();
  };

  const handleTriggerWipe = async () => {
    if (
      !window.confirm(
        "Permanently delete every lead in this workspace from PostgreSQL? Accounts, campaigns, evidence, and audit history will remain."
      )
    ) {
      return;
    }
    setIsWiping(true);
    setActionMessage(null);
    try {
      await onClearData();
      setActionMessage("Workspace lead records deleted from PostgreSQL.");
      setTimeout(() => setActionMessage(null), 4000);
    } catch {
      setActionMessage("Failed to delete workspace lead records.");
    } finally {
      setIsWiping(false);
    }
  };

  const handleRunAiDiagnostic = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await fetch("/api/admin/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrompt: aiTestPrompt })
      });
      const data = await res.json();
      setAiTestResult(data);
    } catch (err: unknown) {
      setAiTestResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsTestingAi(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="bg-[#0f1523] border border-[#1e283d] w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-console-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e283d] flex items-center justify-between bg-[#0a0d16]/90">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="admin-console-title" className="text-base font-bold text-white tracking-tight">
                  Workspace Administration
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md uppercase">
                  Enterprise Control
                </span>
              </div>
              <p className="text-xs text-slate-400">Administrator: {currentUser?.email || "Workspace Administrator"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-[#151c2e] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 bg-[#0a0d16] border-b border-[#1e283d] text-xs font-semibold px-4 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("database")}
            className={`py-3 px-3 flex items-center justify-center space-x-2 border-b-2 transition cursor-pointer ${
              activeTab === "database"
                ? "border-indigo-500 text-indigo-300 bg-[#151c2e]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data Operations</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai_diagnostics")}
            className={`py-3 px-3 flex items-center justify-center space-x-2 border-b-2 transition cursor-pointer ${
              activeTab === "ai_diagnostics"
                ? "border-indigo-500 text-indigo-300 bg-[#151c2e]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>AI Telemetry Bench</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`py-3 px-3 flex items-center justify-center space-x-2 border-b-2 transition cursor-pointer ${
              activeTab === "roles"
                ? "border-indigo-500 text-indigo-300 bg-[#151c2e]"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Team & Roles</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {actionMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionMessage}</span>
            </div>
          )}

          {/* TAB 1: DATA OPERATIONS */}
          {activeTab === "database" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-[#0a0d16] border border-rose-900/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-300 font-bold text-sm">
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span>Clear Workspace Records</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Permanently deletes this workspace's lead records from PostgreSQL. Accounts, campaigns, evidence,
                    and audit history are retained.
                  </p>
                  <button
                    type="button"
                    onClick={handleTriggerWipe}
                    disabled={isWiping}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isWiping ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Clear All Pipeline Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Workspace Snapshot */}
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="text-slate-300 font-bold flex items-center justify-between">
                  <span>Pipeline Telemetry Snapshot</span>
                  <span className="text-emerald-400 text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Active
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-400">
                  <div className="p-3 bg-[#0f1523] rounded-lg border border-[#1e283d]">
                    <span className="text-[10px] text-slate-500 block">Total Ingested</span>
                    <span className="text-lg font-bold text-white tabular-nums">{leads.length}</span>
                  </div>
                  <div className="p-3 bg-[#0f1523] rounded-lg border border-[#1e283d]">
                    <span className="text-[10px] text-slate-500 block">ICP Qualified</span>
                    <span className="text-lg font-bold text-emerald-400 tabular-nums">
                      {leads.filter((l) => l.isQualified).length}
                    </span>
                  </div>
                  <div className="p-3 bg-[#0f1523] rounded-lg border border-[#1e283d]">
                    <span className="text-[10px] text-slate-500 block">Verified MX</span>
                    <span className="text-lg font-bold text-indigo-400 tabular-nums">
                      {
                        leads.filter((l) => ["domain_accepts_mail", "mailbox_accepted"].includes(l.verificationStatus))
                          .length
                      }
                    </span>
                  </div>
                  <div className="p-3 bg-[#0f1523] rounded-lg border border-[#1e283d]">
                    <span className="text-[10px] text-slate-500 block">CRM Synced</span>
                    <span className="text-lg font-bold text-amber-400 tabular-nums">
                      {leads.filter((l) => l.stage === "exported").length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Queue and retention operations</span>
                  <button
                    type="button"
                    onClick={() => void fetchOperations()}
                    className="text-slate-400 hover:text-white"
                    title="Refresh operations"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingOperations ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {operations ? (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono">
                      {(["waiting", "active", "delayed", "completed", "failed", "paused"] as const).map((status) => (
                        <div key={status} className="rounded-lg border border-[#1e283d] bg-[#0f1523] p-2">
                          <span className="block text-[9px] uppercase text-slate-500">{status}</span>
                          <strong
                            className={
                              status === "failed" && operations.queue[status] ? "text-rose-400" : "text-slate-200"
                            }
                          >
                            {operations.queue[status] || 0}
                          </strong>
                        </div>
                      ))}
                    </div>
                    <p className="text-slate-400">
                      Retained crawl snapshots: {operations.retention.retainedCrawlSnapshots} · Batches expiring in 7
                      days: {operations.retention.batchesExpiringWithinSevenDays} · Purged batches:{" "}
                      {operations.retention.purgedBatches}
                    </p>
                    {operations.failures.map((failure) => (
                      <div
                        key={failure.jobId}
                        className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="font-mono text-rose-300">{failure.dispatchId}</p>
                          <p className="text-slate-400 mt-1">{failure.failedReason}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void recoverQueueFailure(failure.jobId)}
                          className="px-3 py-1.5 rounded-lg border border-rose-800 text-rose-200 hover:bg-rose-900/40 whitespace-nowrap"
                        >
                          Safe retry
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-slate-500">
                    {isLoadingOperations ? "Loading durable queue state…" : "No operational data loaded."}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI ENGINE */}
          {activeTab === "ai_diagnostics" && (
            <div className="space-y-4">
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Configured Ollama Diagnostic</span>
                  </span>
                  <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Live provider configuration
                  </span>
                </div>

                <textarea
                  value={aiTestPrompt}
                  onChange={(e) => setAiTestPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[#070a13] border border-[#1e283d] rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 font-sans"
                  placeholder="Enter a prompt to verify the configured model response..."
                />

                <button
                  type="button"
                  onClick={handleRunAiDiagnostic}
                  disabled={isTestingAi}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isTestingAi ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing Model Latency & Response...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Run Model Diagnostic</span>
                    </>
                  )}
                </button>
              </div>

              {aiTestResult && (
                <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-2 font-mono text-xs animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-bold">Model Output:</span>
                    <span className="text-indigo-400 text-[10px]">
                      Latency: {aiTestResult.latencyMs}ms | Ollama Status:{" "}
                      {aiTestResult.hasLlmKey ? "Configured" : "Not configured"}
                    </span>
                  </div>
                  <div className="p-3 bg-[#070a13] rounded-lg border border-[#1e283d] text-slate-200 font-sans text-xs whitespace-pre-wrap">
                    {aiTestResult.response || aiTestResult.error || JSON.stringify(aiTestResult)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEAM & ROLES (read-only — roles are enforced server-side) */}
          {activeTab === "roles" && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Your current role is assigned by the server and cannot be changed from the client. Contact a Workspace
                Administrator for role changes.
              </div>

              <div className="p-4 rounded-xl border border-[#1e283d] bg-[#0a0d16]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">Current Role</span>
                  <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 uppercase">
                    Server-enforced
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-2">
                  {currentUser ? currentUser.role.replace(/_/g, " ") : "Not authenticated"}
                </p>
                {currentUser?.isDeveloper && (
                  <p className="text-[10px] text-amber-400/90 mt-2">
                    Full administrator privileges. Can manage workspace settings, provider readiness, and protected
                    operations.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#0a0d16] border-t border-[#1e283d] flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>LeadForge Private Operator</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#151c2e] hover:bg-[#1e283d] text-slate-200 rounded-xl transition cursor-pointer"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
