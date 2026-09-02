import type React from "react";
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import type {
  Lead,
  Account,
  ActiveTab,
  SystemHealth,
  AuthUser,
  LeadStage,
  ActivityLogRecord,
  IngestLeadInput
} from "./types";
import { Header } from "./components/Header";
import { LeadTable } from "./components/LeadTable";
import { KeyboardShortcutsDock } from "./components/KeyboardShortcutsDock";
import { ToastContainer, type ToastMessage } from "./components/Toast";
import { Activity, ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle } from "lucide-react";

const LeadDetailModal = lazy(() =>
  import("./components/LeadDetailModal").then(({ LeadDetailModal }) => ({
    default: LeadDetailModal
  }))
);
const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then(({ CommandPalette }) => ({
    default: CommandPalette
  }))
);
const AdminConsoleModal = lazy(() =>
  import("./components/AdminConsoleModal").then(({ AdminConsoleModal }) => ({
    default: AdminConsoleModal
  }))
);
const ActivityLogModal = lazy(() =>
  import("./components/ActivityLogModal").then(({ ActivityLogModal }) => ({
    default: ActivityLogModal
  }))
);

const AccountDirectoryView = lazy(() =>
  import("./components/AccountDirectoryView").then(({ AccountDirectoryView }) => ({ default: AccountDirectoryView }))
);
const DiscoveryView = lazy(() =>
  import("./components/DiscoveryView").then(({ DiscoveryView }) => ({
    default: DiscoveryView
  }))
);
const BatchIngestView = lazy(() =>
  import("./components/BatchIngestView").then(({ BatchIngestView }) => ({
    default: BatchIngestView
  }))
);
const DeliverabilityTool = lazy(() =>
  import("./components/DeliverabilityTool").then(({ DeliverabilityTool }) => ({
    default: DeliverabilityTool
  }))
);
const ExportView = lazy(() =>
  import("./components/ExportView").then(({ ExportView }) => ({
    default: ExportView
  }))
);
const DataHygieneView = lazy(() =>
  import("./components/DataHygieneView").then(({ DataHygieneView }) => ({
    default: DataHygieneView
  }))
);
const CampaignSequencerView = lazy(() =>
  import("./components/CampaignSequencerView").then(({ CampaignSequencerView }) => ({ default: CampaignSequencerView }))
);
const WaterfallResolverView = lazy(() =>
  import("./components/WaterfallResolverView").then(({ WaterfallResolverView }) => ({ default: WaterfallResolverView }))
);
export type WebpageSignalScraperViewProps = {
  onApplyHookToDraft?: (snippet: string) => void;
  onLeadCreated?: (lead: Lead) => void;
  onNavigateToLeads?: () => void;
  onNavigateToDiscovery?: () => void;
};

const WebpageSignalScraperView = lazy(() =>
  import("./components/WebpageSignalScraperView").then(({ WebpageSignalScraperView }) => ({
    default: WebpageSignalScraperView
  }))
);

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");

  // Auth gate form state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRecord[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [pendingCampaignHook, setPendingCampaignHook] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Global Keyboard Shortcuts (Cmd+K, Tab Numbers 1-9, 0 for Signals)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isInput) return;

      if (e.key === "1") {
        e.preventDefault();
        setActiveTab("leads");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveTab("accounts");
      } else if (e.key === "3") {
        e.preventDefault();
        setActiveTab("campaigns");
      } else if (e.key === "4") {
        e.preventDefault();
        setActiveTab("deliverability");
      } else if (e.key === "5") {
        e.preventDefault();
        setActiveTab("hygiene");
      } else if (e.key === "6") {
        e.preventDefault();
        setActiveTab("ingest");
      } else if (e.key === "7") {
        e.preventDefault();
        setActiveTab("discovery");
      } else if (e.key === "8") {
        e.preventDefault();
        setActiveTab("exports");
      } else if (e.key === "9") {
        e.preventDefault();
        setActiveTab("waterfall" as ActiveTab);
      } else if (e.key === "0") {
        e.preventDefault();
        setActiveTab("signals" as ActiveTab);
      } else if (e.key === "?" || (e.key === "/" && !e.shiftKey)) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    return {};
  }, []);

  const fetchData = useCallback(async () => {
    if (!sessionToken) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const headers = getAuthHeaders();

      const healthStartedAt = performance.now();
      const [leadsRes, healthRes, logsRes] = await Promise.all([
        fetch("/api/leads", { headers, credentials: "same-origin" }),
        fetch("/api/health"),
        fetch("/api/activity-logs?limit=100", { headers, credentials: "same-origin" })
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
        setAccounts(data.accounts || []);
      }

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
        setHealthLatencyMs(Math.max(0, Math.round(performance.now() - healthStartedAt)));
      }

      if (logsRes.ok) {
        const lData = await logsRes.json();
        if (lData.success && lData.logs) {
          setActivityLogs(lData.logs);
        }
      }
    } catch (err) {
      console.error("Failed fetching pipeline data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [getAuthHeaders, sessionToken]);

  const fetchActivityLogs = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setIsLoadingLogs(true);
      const res = await fetch("/api/activity-logs?limit=100", {
        headers: getAuthHeaders(),
        credentials: "same-origin"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.logs) {
          setActivityLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [getAuthHeaders, sessionToken]);

  const handleClearActivityLogs = async () => {
    try {
      const res = await fetch("/api/activity-logs", {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "same-origin"
      });
      if (res.ok) {
        setActivityLogs([]);
      }
    } catch (err) {
      console.error("Failed to clear activity logs:", err);
    }
  };

  // Restore the server-managed HttpOnly cookie session on startup.
  useEffect(() => {
    void fetch("/api/auth/config")
      .then((response) => response.json())
      .then((data: { registrationEnabled?: boolean }) => {
        const enabled = data.registrationEnabled === true;
        setRegistrationEnabled(enabled);
        if (!enabled) setAuthMode("login");
      })
      .catch(() => {
        setRegistrationEnabled(false);
      });
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        let res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (res.status === 401) {
          const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "same-origin"
          });
          if (refreshRes.ok) {
            res = await fetch("/api/auth/me", { credentials: "same-origin" });
          }
        }
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user as AuthUser);
            setSessionToken("cookie-session");
            return;
          }
        }
        setSessionToken("");
        setCurrentUser(null);
      } catch (err) {
        console.error("Session verification error:", err);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    void verifySession();
  }, []);

  useEffect(() => {
    if (sessionToken) {
      fetchData();
    }
  }, [sessionToken, fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmittingAuth(true);

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authEmail, password: authPassword }
        : {
            email: authEmail,
            password: authPassword,
            name: authName || "Operator"
          };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setSessionToken("cookie-session");
        setCurrentUser(data.user);
        addToast({
          type: "success",
          title: authMode === "login" ? "Welcome Back" : "Account Initialized",
          description: `Logged in as ${data.user.email} (${data.user.role})`
        });
      } else {
        setAuthError(data.error || "Authentication failed. Please verify credentials.");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Network connection error.");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "same-origin"
      });
    } catch (err) {
      console.error("Logout network notice:", err);
    }
    setCurrentUser(null);
    setSessionToken("");
    setLeads([]);
    setAccounts([]);
    setActivityLogs([]);
  };

  const handleClearData = async () => {
    const res = await fetch("/api/admin/clear-data", {
      method: "POST",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      setLeads([]);
    }
  };

  const _handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(data.lead);
        }
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleBulkEnrich = async (leadIds: string[]) => {
    try {
      const res = await fetch("/api/leads/bulk-enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ leadIds })
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.updatedCount ?? data.count ?? leadIds.length;
        const failed = data.failedCount ?? Math.max(0, leadIds.length - updated);
        addToast({
          type: failed > 0 ? "warning" : "success",
          title: "Bulk Enrichment Complete",
          description: `Successfully enriched ${updated} ${
            updated === 1 ? "lead" : "leads"
          } with live MX verification and seniority scoring${failed > 0 ? ` (${failed} skipped/failed)` : ""}.`
        });
        await fetchData();
        fetchActivityLogs();
      } else {
        addToast({
          type: "error",
          title: "Bulk Enrichment Failed",
          description: "Server encountered an error while processing the selected leads."
        });
      }
    } catch (err) {
      console.error("Bulk enrich error:", err);
      addToast({
        type: "error",
        title: "Network Connection Issue",
        description: "Unable to contact the lead qualification service."
      });
    }
  };

  const handleBulkDelete = async (leadIds: string[]) => {
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ leadIds })
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => !leadIds.includes(l.id)));
        fetchActivityLogs();
        addToast({
          type: "info",
          title: "Leads Purged",
          description: `Removed ${leadIds.length} ${leadIds.length === 1 ? "lead" : "leads"} from the active pipeline.`
        });
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
    }
  };

  const handleBulkStage = async (leadIds: string[], stage: LeadStage, isQualified: boolean) => {
    try {
      const res = await fetch("/api/leads/bulk-stage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ leadIds, stage, isQualified })
      });
      if (res.ok) {
        setLeads((prev) => prev.map((l) => (leadIds.includes(l.id) ? { ...l, stage, isQualified } : l)));
        fetchActivityLogs();
        addToast({
          type: "success",
          title: "Stage Updated",
          description: `Advanced ${leadIds.length} ${leadIds.length === 1 ? "lead" : "leads"} to '${stage}' stage.`
        });
      }
    } catch (err) {
      console.error("Bulk stage error:", err);
    }
  };

  const handleEnrichLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/enrich`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(data.lead);
        }
        fetchActivityLogs();
      }
    } catch (err) {
      console.error("Enrich error:", err);
    }
  };

  const handlePersonalizeLead = async (leadId: string, tone = "consultative", customPitch = ""): Promise<string> => {
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-personalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ tone, customPitch })
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  aiEmailDraft: data.draft,
                  personalizationPrompt: `Personalized for ${l.jobTitle} at ${l.companyName}`
                }
              : l
          )
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) => (prev ? { ...prev, aiEmailDraft: data.draft } : null));
        }
        return data.draft;
      }
      return data.draft || "Draft generation returned no content.";
    } catch (err: unknown) {
      return `Generation failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead(null);
        }
        fetchActivityLogs();
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleIngestSingle = async (leadData: IngestLeadInput): Promise<boolean> => {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(leadData)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setLeads((prev) => [data.lead, ...prev]);
          fetchActivityLogs();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Single ingest error:", err);
      return false;
    }
  };

  const handleIngestBatch = async (
    rawLeads: IngestLeadInput[],
    autoEnrich: boolean
  ): Promise<{ created: number; skipped: number }> => {
    try {
      const res = await fetch("/api/leads/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ leads: rawLeads, autoEnrich })
      });
      const data = await res.json();
      if (data.success && data.leads) {
        setLeads((prev) => [...data.leads, ...prev]);
        fetchActivityLogs();
        return { created: data.totalCreated, skipped: data.totalSkipped };
      }
      return { created: 0, skipped: rawLeads.length };
    } catch (err) {
      console.error("Batch ingest error:", err);
      return { created: 0, skipped: rawLeads.length };
    }
  };

  const handleMergeLead = async (targetLeadId: string, incomingData: IngestLeadInput): Promise<boolean> => {
    try {
      const res = await fetch("/api/leads/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ targetLeadId, incomingData })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setLeads((prev) => prev.map((l) => (l.id === targetLeadId ? data.lead : l)));
          fetchActivityLogs();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Merge error:", err);
      return false;
    }
  };

  // 1. Loading Splash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center space-y-4 font-mono text-slate-300">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
        <p className="text-xs tracking-widest uppercase font-bold text-slate-400">
          Connecting LeadForge Enterprise Pipeline...
        </p>
      </div>
    );
  }

  // 2. Auth Gate View (If Unauthenticated)
  if (!currentUser || !sessionToken) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-indigo-950/30 via-indigo-950/10 to-transparent pointer-events-none blur-3xl -z-10" />

        <div className="w-full max-w-md bg-[#0f1523] border border-[#1e283d] rounded-2xl p-8 shadow-2xl shadow-black/80 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">LeadForge Pro Enterprise</h1>
            <p className="text-xs text-slate-400 font-mono">
              {authMode === "login"
                ? "Enter your operator credentials to access the platform"
                : "Initialize primary operator account"}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 font-mono flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === "register" && (
              <div className="space-y-1">
                <label
                  htmlFor="auth-full-name"
                  className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-full-name"
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Operator Name"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="auth-work-email"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono"
              >
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-work-email"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="auth-password"
                className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingAuth}
              className="w-full mt-2 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/40 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmittingAuth ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{authMode === "login" ? "Sign In to Pipeline" : "Create Operator Account"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {registrationEnabled ? (
            <div className="border-t border-[#1e283d] pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError(null);
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
              >
                {authMode === "login" ? "First time setting up? Create Admin Account" : "Already registered? Sign In"}
              </button>
            </div>
          ) : (
            <p className="border-t border-[#1e283d] pt-4 text-center text-xs text-slate-500">
              Registration is disabled. Ask an organization administrator for an invitation.
            </p>
          )}
        </div>

        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </div>
    );
  }

  const qualifiedCount = leads.filter((l) => l.isQualified).length;

  return (
    <div className="min-h-screen bg-[#0a0d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white antialiased relative overflow-x-hidden">
      {/* Subtle Ambient Radial Highlight */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-indigo-950/15 via-indigo-950/5 to-transparent pointer-events-none blur-3xl -z-10" />

      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        totalLeads={leads.length}
        qualifiedCount={qualifiedCount}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        currentUser={currentUser}
        onOpenAdminConsole={() => setIsAdminConsoleOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Suspense
          fallback={
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          }
        >
          {activeTab === "leads" && (
            <LeadTable
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onEnrichLead={handleEnrichLead}
              onPersonalizeLead={(lead) => setSelectedLead(lead)}
              onDeleteLead={handleDeleteLead}
              onExportSelected={() => {
                setActiveTab("exports");
              }}
              onBulkEnrich={handleBulkEnrich}
              onBulkDelete={handleBulkDelete}
              onBulkStage={handleBulkStage}
              onAddToCampaign={(leadIds) => {
                setActiveTab("campaigns");
                addToast({
                  type: "success",
                  title: "Leads Enrolled",
                  description: `${leadIds.length} leads staged for Cold Email Sequence outreach.`
                });
              }}
            />
          )}

          {activeTab === "accounts" && (
            <AccountDirectoryView
              accounts={accounts}
              leads={leads}
              onNavigateToLeads={() => {
                setActiveTab("leads");
              }}
              onNavigateToIngest={() => setActiveTab("ingest")}
            />
          )}

          {activeTab === "discovery" && (
            <DiscoveryView
              onPipelineChanged={fetchData}
              onNavigateToLeads={() => {
                setActiveTab("leads");
                fetchData();
              }}
            />
          )}

          {activeTab === "campaigns" && (
            <CampaignSequencerView
              leads={leads}
              onRefreshPipeline={fetchData}
              pendingHook={pendingCampaignHook}
              onPendingHookApplied={() => setPendingCampaignHook(null)}
            />
          )}

          {(activeTab === "deliverability" || (activeTab as string) === "verify") && <DeliverabilityTool />}

          {activeTab === "hygiene" && (
            <DataHygieneView leads={leads} onRefreshData={fetchData} onNavigateToLeads={() => setActiveTab("leads")} />
          )}

          {activeTab === "ingest" && (
            <BatchIngestView
              existingLeads={leads}
              onIngestSingle={handleIngestSingle}
              onIngestBatch={handleIngestBatch}
              onMergeLead={handleMergeLead}
              onNavigateToLeads={() => setActiveTab("leads")}
            />
          )}

          {activeTab === "exports" && <ExportView leads={leads} />}

          {(activeTab as string) === "waterfall" && (
            <WaterfallResolverView
              onLeadImported={(newLead) => {
                setLeads((prev) => [newLead, ...prev]);
                addToast({
                  type: "success",
                  title: "Prospect Discovered",
                  description: `Added ${newLead.firstName} (${newLead.email}) to PostgreSQL pipeline.`
                });
              }}
            />
          )}

          {(activeTab as string) === "signals" && (
            <WebpageSignalScraperView
              onNavigateToDiscovery={() => setActiveTab("discovery")}
              onApplyHookToDraft={(snippet: string) => {
                setPendingCampaignHook(snippet);
                setActiveTab("campaigns");
                addToast({
                  type: "success",
                  title: "Hook Ready",
                  description: "Outreach hook queued. It's applied when you craft the campaign draft."
                });
              }}
              onLeadCreated={(_lead) => {
                fetchData();
              }}
              onNavigateToLeads={() => {
                setActiveTab("leads");
                fetchData();
                addToast({
                  type: "success",
                  title: "Pipeline refreshed",
                  description: "Newly generated leads are now visible in the Lead Pipeline."
                });
              }}
            />
          )}
        </Suspense>
      </main>

      {/* Global Telemetry Footer */}
      <footer className="h-12 border-t border-[#1e283d] bg-[#0f1523]/95 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between text-[11px] text-slate-400 shrink-0 font-mono shadow-footer z-20">
        <div className="flex items-center space-x-3 sm:space-x-5 overflow-hidden">
          <span className="flex items-center text-slate-300 font-medium shrink-0">
            <span className="h-2 w-2 bg-emerald-400 rounded-full mr-2 shadow-sm shadow-emerald-400/50 animate-pulse"></span>
            API:{" "}
            <span className={`font-bold ml-1 ${health?.status === "healthy" ? "text-emerald-400" : "text-amber-400"}`}>
              {health
                ? `${health.status.toUpperCase()}${healthLatencyMs === null ? "" : ` ${healthLatencyMs}ms`}`
                : "UNKNOWN"}
            </span>
          </span>

          <span className="hidden lg:flex items-center text-slate-300 font-medium shrink-0">
            <span className="h-2 w-2 bg-emerald-400 rounded-full mr-2"></span>
            Redis:{" "}
            <span className={`font-bold ml-1 ${health?.dependencies?.redis ? "text-emerald-400" : "text-rose-400"}`}>
              {health?.dependencies?.redis ? "UP" : "DOWN"}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setIsActivityLogOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition text-[11px] group cursor-pointer max-w-[260px] sm:max-w-md truncate"
            title="Open Operator Activity Audit Trail (Press L)"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition" />
            <span className="font-semibold text-amber-400 shrink-0">Activity:</span>
            {activityLogs.length > 0 ? (
              <span className="truncate text-slate-300">
                {activityLogs[0].description} ({activityLogs.length} events)
              </span>
            ) : (
              <span className="text-slate-500 italic">No recent operator logs</span>
            )}
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 ml-1 shrink-0 font-mono">
              Hot: L
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <span className="hidden md:inline-flex items-center text-slate-500 font-mono text-[10px]">
            Operator:{" "}
            <span className="text-indigo-400 ml-1 font-semibold">{currentUser?.email || "Guest Session"}</span>
          </span>
          <div className="flex -space-x-1.5">
            <div className="h-5 w-5 rounded-full bg-[#1e283d] border border-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-200">
              {currentUser?.isDeveloper ? "DEV" : currentUser ? "OP" : "GUEST"}
            </div>
            <div className="h-5 w-5 rounded-full bg-indigo-600 border border-slate-700 flex items-center justify-center text-[8px] font-bold text-white shadow-sm shadow-indigo-500/50">
              AI
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-300 tracking-wide uppercase">
            {currentUser?.role ? currentUser.role.replace(/_/g, " ") : "READ ONLY"}
          </span>
        </div>
      </footer>

      {/* Persistent Keyboard Shortcuts Floating Dock */}
      <KeyboardShortcutsDock
        activeTab={activeTab}
        onSwitchTab={(tab) => setActiveTab(tab)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenActivityLog={() => setIsActivityLogOpen(true)}
        onOpenAdminConsole={currentUser?.isDeveloper ? () => setIsAdminConsoleOpen(true) : undefined}
        onRefreshData={handleRefresh}
        onQuickSearch={() => {
          if (activeTab !== "leads") setActiveTab("leads");
          setTimeout(() => {
            const searchInput = document.getElementById("lead-table-search-input") as HTMLInputElement | null;
            if (searchInput) {
              searchInput.focus();
              searchInput.select();
            }
          }, 50);
        }}
      />

      <Suspense fallback={null}>
        {/* Operator Activity Log Audit Trail Modal */}
        <ActivityLogModal
          isOpen={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
          logs={activityLogs}
          isLoading={isLoadingLogs}
          onRefresh={fetchActivityLogs}
          onClearLogs={currentUser?.isDeveloper ? handleClearActivityLogs : undefined}
          isDeveloperAdmin={currentUser?.isDeveloper}
        />

        {/* Lead Detail & AI Outreach Modal */}
        {selectedLead && (
          <LeadDetailModal
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onEnrich={handleEnrichLead}
            onPersonalize={handlePersonalizeLead}
          />
        )}

        {/* Developer Admin Console Modal */}
        <AdminConsoleModal
          isOpen={isAdminConsoleOpen}
          onClose={() => setIsAdminConsoleOpen(false)}
          currentUser={currentUser}
          onClearData={handleClearData}
          leads={leads}
        />

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          setActiveTab={setActiveTab}
          leads={leads}
          onSelectLead={(lead) => setSelectedLead(lead)}
          onRefresh={handleRefresh}
        />
      </Suspense>

      {/* Real-time Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default App;
