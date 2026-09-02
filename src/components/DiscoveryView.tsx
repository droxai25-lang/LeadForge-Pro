import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  Mail,
  PauseCircle,
  Phone,
  Search,
  ShieldCheck,
  Square,
  Target,
  XCircle
} from "lucide-react";
import type { DiscoveryCompany, DiscoveryRun } from "../types";
import type { QualificationContract } from "../lib/opportunityQualification";
import { createDefaultQualificationContract, QualificationContractEditor } from "./QualificationContractEditor";

interface ManagedClientOption {
  id: string;
  name: string;
  status: string;
  targetProfile: QualificationContract;
  qualificationReady?: boolean;
}

interface DiscoveryReadiness {
  ready: boolean;
  queueConnected: boolean;
  maxEmailCreditsPerRun: number;
  hunter?: { ready: boolean; reason?: string | null };
  reason?: string | null;
}

interface DiscoveryViewProps {
  onPipelineChanged: () => void;
  onNavigateToLeads: () => void;
}

interface AutopilotStatus {
  enabled: boolean;
  intervalMinutes: number;
  companyLimit: number;
  cursor: number;
  currentRunId?: string | null;
  lastRunId?: string | null;
  lastCompletedAt?: string | null;
  nextRunAt?: string | null;
}

interface SellerProfile {
  name: string;
  website: string;
  offer: string;
  capabilities: string[];
}

const terminalStatuses = new Set(["completed", "partial", "failed", "cancelled"]);

async function readJson<T>(response: Response): Promise<T> {
  const value: unknown = await response.json().catch(() => ({}));
  const data = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  if (!response.ok || data.success === false)
    throw new Error(typeof data.error === "string" ? data.error : `Request failed with HTTP ${response.status}.`);
  return value as T;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({ onPipelineChanged }) => {
  const [readiness, setReadiness] = useState<DiscoveryReadiness | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotStatus | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [clients, setClients] = useState<ManagedClientOption[]>([]);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<DiscoveryRun | null>(null);
  const [market, setMarket] = useState("HVAC companies");
  const [location, setLocation] = useState("Dallas, Texas, US");
  const [companyLimit, setCompanyLimit] = useState(25);
  const [radiusKm, setRadiusKm] = useState(35);
  const [clientId, setClientId] = useState("");
  const [contract, setContract] = useState<QualificationContract>(() =>
    createDefaultQualificationContract(["HVAC companies"], ["Dallas, Texas, US"])
  );
  const [enrichNamedContacts, setEnrichNamedContacts] = useState(false);
  const [contactsPerCompany, setContactsPerCompany] = useState(3);
  const [maxDomainSearches, setMaxDomainSearches] = useState(10);
  const [isStarting, setIsStarting] = useState(false);
  const [isChangingAutopilot, setIsChangingAutopilot] = useState(false);
  const [isPreparingBatch, setIsPreparingBatch] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState("");
  const [error, setError] = useState("");

  const selectedClient = clients.find((client) => client.id === clientId) || null;
  const effectiveContract = selectedClient?.targetProfile || contract;

  const refreshOverview = useCallback(async () => {
    try {
      const [statusData, runsData, clientsData, autopilotData] = await Promise.all([
        fetch("/api/discovery/status").then(readJson<DiscoveryReadiness>),
        fetch("/api/discovery/runs?limit=25").then(readJson<{ runs: DiscoveryRun[] }>),
        fetch("/api/managed-clients").then(readJson<{ clients: ManagedClientOption[] }>),
        fetch("/api/discovery/autopilot").then(readJson<{ autopilot: AutopilotStatus; sellerProfile: SellerProfile }>)
      ]);
      setReadiness(statusData);
      setRuns(runsData.runs || []);
      setClients(
        (clientsData.clients || []).filter(
          (client: ManagedClientOption) => client.status === "active" && client.qualificationReady !== false
        )
      );
      setAutopilot(autopilotData.autopilot);
      setSellerProfile(autopilotData.sellerProfile);
      setMaxDomainSearches((current) => Math.min(current, statusData.maxEmailCreditsPerRun ?? current));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Discovery status could not be loaded.");
    }
  }, []);

  const refreshRun = useCallback(
    async (runId: string) => {
      const data = await fetch(`/api/discovery/runs/${encodeURIComponent(runId)}`).then(
        readJson<{ run: DiscoveryRun }>
      );
      const run = data.run as DiscoveryRun;
      setSelectedRun(run);
      setRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)]);
      if (terminalStatuses.has(run.status) && run.prospectsQualified > 0) onPipelineChanged();
      return run;
    },
    [onPipelineChanged]
  );

  const changeAutopilot = async (action: "start" | "stop") => {
    setIsChangingAutopilot(true);
    setError("");
    try {
      const data = await fetch(`/api/discovery/autopilot/${action}`, { method: "POST" }).then(
        readJson<{ autopilot: AutopilotStatus }>
      );
      setAutopilot(data.autopilot);
      await refreshOverview();
      if (data.autopilot?.currentRunId) await refreshRun(data.autopilot.currentRunId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Autonomous discovery state could not be changed."
      );
    } finally {
      setIsChangingAutopilot(false);
    }
  };

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);
  useEffect(() => {
    if (!selectedRun || terminalStatuses.has(selectedRun.status)) return;
    const interval = window.setInterval(
      () =>
        void refreshRun(selectedRun.id).catch((requestError) =>
          setError(requestError instanceof Error ? requestError.message : "Run refresh failed.")
        ),
      2000
    );
    return () => window.clearInterval(interval);
  }, [refreshRun, selectedRun]);

  const startDiscovery = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsStarting(true);
    setError("");
    try {
      const inlineContract: QualificationContract = {
        ...contract,
        targetIndustries: [market],
        targetGeography: [location]
      };
      const data = await fetch("/api/discovery/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market,
          location,
          companyLimit,
          radiusKm,
          minConfidence: effectiveContract.targetCompanyCharacteristics.minSourceConfidence,
          clientId: clientId || null,
          qualificationContract: clientId ? undefined : inlineContract,
          enrichNamedContacts,
          contactsPerCompany,
          maxDomainSearches,
          departments: ["executive", "management", "operations"],
          seniorities: ["executive", "senior"],
          decisionMakerOnly: true
        })
      }).then(readJson<{ run: DiscoveryRun }>);
      const run = data.run as DiscoveryRun;
      setSelectedRun(run);
      setRuns((previous) => [run, ...previous.filter((item) => item.id !== run.id)]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Discovery could not be started.");
    } finally {
      setIsStarting(false);
    }
  };

  const cancelRun = async () => {
    if (!selectedRun) return;
    try {
      await fetch(`/api/discovery/runs/${encodeURIComponent(selectedRun.id)}/cancel`, { method: "POST" }).then(
        readJson
      );
      await refreshRun(selectedRun.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Cancellation failed.");
    }
  };

  const prepareDeliveryBatch = async () => {
    if (!selectedRun?.clientId) return;
    setIsPreparingBatch(true);
    setError("");
    setDeliveryResult("");
    try {
      const data = await fetch(`/api/discovery/runs/${encodeURIComponent(selectedRun.id)}/delivery-batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }).then(readJson<{ batch: { recordCount: number; fileName: string; payloadSha256: string } }>);
      setDeliveryResult(
        `Prepared immutable ${data.batch.recordCount}-prospect client batch ${data.batch.fileName} with SHA-256 ${data.batch.payloadSha256}.`
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Client delivery batch could not be prepared.");
    } finally {
      setIsPreparingBatch(false);
    }
  };

  const qualified = useMemo(
    () => (selectedRun?.companies || []).filter((company) => company.qualificationStatus === "qualified"),
    [selectedRun]
  );
  const rejected = useMemo(
    () => (selectedRun?.companies || []).filter((company) => company.qualificationStatus !== "qualified"),
    [selectedRun]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      <header className="rounded-2xl border border-[#1e283d] bg-[#0f1523] p-6 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-600 to-violet-700 p-3 shadow-lg shadow-indigo-600/20">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Autonomous opportunity discovery</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">
                LeadForge advances its own global public-business frontier, researches websites across industries, and
                returns only evidence-qualified opportunities for DroxAI. No niche, location, paid lead database, or
                manually designed scoring contract is required.
              </p>
            </div>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 text-xs ${readiness?.ready && readiness.queueConnected ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300" : "border-amber-500/30 bg-amber-950/30 text-amber-200"}`}
          >
            <div className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-4 w-4" />
              {readiness?.ready && readiness.queueConnected
                ? "Public discovery + evidence worker ready"
                : "Configuration required"}
            </div>
            {readiness?.reason && <p className="mt-1 max-w-sm">{readiness.reason}</p>}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-[#0f1523] p-6 shadow-xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-200">
              <Globe2 className="h-5 w-5" />
              {autopilot?.enabled ? "Autopilot is researching the web" : "Autopilot is stopped"}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              {sellerProfile?.offer || "DroxAI's saved service profile will be used automatically."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              The frontier is built automatically from the worldwide public GeoNames city dataset. It remembers its
              position, avoids overlapping work, and begins another bounded research batch{" "}
              {autopilot?.intervalMinutes === 1 ? "one minute" : `every ${autopilot?.intervalMinutes || 1} minutes`}{" "}
              after the previous batch finishes.
            </p>
            {autopilot?.currentRunId && (
              <p className="mt-2 text-xs text-indigo-300">Current research run: {autopilot.currentRunId}</p>
            )}
            {autopilot?.nextRunAt && !autopilot.currentRunId && (
              <p className="mt-2 text-xs text-slate-500">
                Next automatic batch: {new Date(autopilot.nextRunAt).toLocaleString()}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isChangingAutopilot || !readiness?.ready || !readiness?.queueConnected}
            onClick={() => void changeAutopilot(autopilot?.enabled ? "stop" : "start")}
            className={`flex min-w-56 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${autopilot?.enabled ? "bg-rose-700 hover:bg-rose-600" : "bg-indigo-600 hover:bg-indigo-500"}`}
          >
            {isChangingAutopilot ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : autopilot?.enabled ? (
              <PauseCircle className="h-4 w-4" />
            ) : (
              <Globe2 className="h-4 w-4" />
            )}
            {autopilot?.enabled ? "Stop after current work" : "Start autonomous prospecting"}
          </button>
        </div>
      </section>

      <details className="rounded-2xl border border-[#1e283d] bg-[#0f1523]">
        <summary className="cursor-pointer p-5 text-sm font-semibold text-slate-400">
          Advanced optional one-off search controls
        </summary>
        <form onSubmit={startDiscovery} className="space-y-5 border-t border-[#1e283d] p-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <TextField
              label="Candidate niche / industry"
              value={market}
              onChange={setMarket}
              placeholder="Commercial roofers"
            />
            <TextField
              label="Geographic market"
              value={location}
              onChange={setLocation}
              placeholder="Houston, Texas, US"
            />
            <NumberField label="Candidate limit" value={companyLimit} min={1} max={100} onChange={setCompanyLimit} />
            <NumberField label="Radius (km)" value={radiusKm} min={5} max={100} onChange={setRadiusKm} />
          </div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Managed client
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#263149] bg-[#090d17] p-3 text-sm text-white"
            >
              <option value="">Inline contract for this run</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} — use saved qualification contract
                </option>
              ))}
            </select>
          </label>
          {selectedClient ? (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-sm text-slate-300">
              <strong className="text-white">Saved contract:</strong> {selectedClient.targetProfile.clientOffer}
              <div className="mt-2 text-xs text-slate-500">
                {selectedClient.targetProfile.qualifyingSignals.length} weighted signal rules · minimum{" "}
                {selectedClient.targetProfile.minEvidenceCount} observations · score{" "}
                {selectedClient.targetProfile.minOpportunityScore}+
              </div>
            </div>
          ) : (
            <QualificationContractEditor value={contract} onChange={setContract} />
          )}
          <label className="flex items-start gap-3 rounded-lg border border-[#263149] bg-[#090d17] p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enrichNamedContacts}
              disabled={!readiness?.hunter?.ready}
              onChange={(event) => setEnrichNamedContacts(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-indigo-500"
            />
            <span>
              <strong className="block text-white">Optional named-person enrichment after qualification</strong>Hunter
              is never used for candidate discovery or qualification. It runs only on prospects that already qualified.{" "}
              {!readiness?.hunter?.ready && (
                <span className="mt-1 block text-amber-300">
                  Unavailable: {readiness?.hunter?.reason || "not configured"}
                </span>
              )}
            </span>
          </label>
          {enrichNamedContacts && (
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Named contacts per qualified prospect"
                value={contactsPerCompany}
                min={1}
                max={10}
                onChange={setContactsPerCompany}
              />
              <NumberField
                label="Maximum paid searches"
                value={maxDomainSearches}
                min={1}
                max={readiness?.maxEmailCreditsPerRun || 25}
                onChange={setMaxDomainSearches}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={
              isStarting ||
              !readiness?.ready ||
              !readiness?.queueConnected ||
              effectiveContract.qualifyingSignals.length === 0
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Discover
            qualified prospects
          </button>
        </form>
      </details>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border border-[#1e283d] bg-[#0f1523] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Recent runs</h3>
          <div className="space-y-2">
            {runs.length === 0 && <p className="text-sm text-slate-500">No discovery runs yet.</p>}
            {runs.map((run) => (
              <button
                type="button"
                key={run.id}
                onClick={() => void refreshRun(run.id)}
                className={`w-full rounded-xl border p-3 text-left ${selectedRun?.id === run.id ? "border-indigo-500 bg-indigo-950/30" : "border-[#263149] bg-[#090d17] hover:border-slate-600"}`}
              >
                <p className="line-clamp-2 text-xs font-semibold text-white">{run.query}</p>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span className="capitalize">{run.status.replace("_", " ")}</span>
                  <span>{run.prospectsQualified || 0} qualified</span>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className="min-h-72 rounded-2xl border border-[#1e283d] bg-[#0f1523] p-5">
          {!selectedRun ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              Select or start an opportunity run.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white">{selectedRun.query}</h3>
                  <p className="mt-1 text-xs text-slate-500">Run {selectedRun.id}</p>
                </div>
                {!terminalStatuses.has(selectedRun.status) && (
                  <button
                    type="button"
                    onClick={cancelRun}
                    className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
                  >
                    <Square className="h-3 w-3" />
                    Stop after current candidate
                  </button>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric icon={Building2} label="Candidates" value={selectedRun.candidatesEvaluated || 0} />
                <Metric icon={Target} label="Qualified" value={selectedRun.prospectsQualified || 0} />
                <Metric icon={XCircle} label="Rejected" value={selectedRun.prospectsDisqualified || 0} />
                <Metric icon={ShieldCheck} label="Evaluation failures" value={selectedRun.qualificationFailures || 0} />
              </div>
              {selectedRun.errorMessage && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                  {selectedRun.errorCode}: {selectedRun.errorMessage}
                </div>
              )}
              {qualified.length > 0 && (
                <div className="mt-5 overflow-hidden rounded-xl border border-emerald-500/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 bg-emerald-950/20 p-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      Qualified evidence-backed prospects
                    </span>
                    <div className="flex gap-2">
                      <a
                        href={`/api/discovery/runs/${encodeURIComponent(selectedRun.id)}/prospects.csv`}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        <Download className="h-3 w-3" />
                        Export qualified only
                      </a>
                      {selectedRun.clientId && (
                        <button
                          type="button"
                          disabled={isPreparingBatch}
                          onClick={() => void prepareDeliveryBatch()}
                          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {isPreparingBatch ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          Prepare client batch
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-[#1e283d]">
                    {qualified.map((company) => (
                      <ProspectCard key={company.id} company={company} />
                    ))}
                  </div>
                </div>
              )}
              {deliveryResult && (
                <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-300">
                  {deliveryResult}
                </div>
              )}
              {terminalStatuses.has(selectedRun.status) && qualified.length === 0 && (
                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-200">
                  No candidate met this contract. Nothing is exportable; LeadForge will not relabel the rejected
                  directory records as leads.
                </div>
              )}
              {rejected.length > 0 && (
                <details className="mt-5 rounded-xl border border-[#263149] bg-[#090d17]">
                  <summary className="cursor-pointer p-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Rejected candidate audit ({rejected.length})
                  </summary>
                  <div className="divide-y divide-[#1e283d]">
                    {rejected.map((company) => (
                      <div key={company.id} className="p-3 text-xs">
                        <div className="flex justify-between gap-3">
                          <span className="font-semibold text-slate-300">{company.name}</span>
                          <span className="capitalize text-slate-500">
                            {company.qualificationStatus.replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {company.disqualificationReasons?.join(" ") ||
                            company.errorMessage ||
                            "Qualification evidence did not clear the contract."}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

function ProspectCard({ company }: { company: DiscoveryCompany }) {
  const matched = (company.opportunitySignals || []).filter((signal) => signal.matchedQualifyingRule);
  return (
    <article className="p-4 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{company.name}</p>
          <p className="text-slate-500">
            {[company.city, company.state, company.country].filter(Boolean).join(", ") ||
              company.streetAddress ||
              "Location unavailable"}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-right">
          <p className="font-bold text-emerald-300">Qualified · {company.opportunityScore?.toFixed(1)}/100</p>
          <p className="text-[10px] text-emerald-400/70">Evidence quality {company.evidenceQuality?.toFixed(2)}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <a
            href={company.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-indigo-300 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {company.domain}
          </a>
          {company.publicEmail && (
            <a href={`mailto:${company.publicEmail}`} className="mt-1 flex items-center gap-1 text-slate-300">
              <Mail className="h-3 w-3" />
              {company.publicEmail}
            </a>
          )}
          {company.phone && (
            <span className="mt-1 flex items-center gap-1 text-slate-400">
              <Phone className="h-3 w-3" />
              {company.phone}
            </span>
          )}
          {company.bestContact && (
            <p className="mt-2 text-slate-400">
              Best public route: <span className="text-slate-200">{company.bestContact.value}</span>
            </p>
          )}
        </div>
        <div>
          <p className="font-semibold text-slate-300">Why this prospect qualified</p>
          <p className="mt-1 leading-relaxed text-slate-500">{company.qualificationReasons?.[0]}</p>
        </div>
      </div>
      {matched.length > 0 && (
        <div className="mt-3 space-y-2">
          {matched.map((signal) => (
            <div key={signal.id} className="rounded-lg border border-[#263149] bg-[#090d17] p-3">
              <div className="flex justify-between gap-3">
                <strong className="text-slate-200">{signal.title}</strong>
                <span className="text-indigo-300">+{signal.scoreContribution.toFixed(1)}</span>
              </div>
              <p className="mt-1 text-slate-500">{signal.observation}</p>
              <a
                href={signal.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-indigo-400 hover:underline"
              >
                Evidence: {signal.sourceUrl} · {new Date(signal.observedAt).toLocaleString()}
              </a>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={2}
        maxLength={160}
        required
        className="mt-2 w-full rounded-xl border border-[#263149] bg-[#090d17] p-3 text-sm text-white outline-none focus:border-indigo-500"
        placeholder={placeholder}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-[#263149] bg-[#090d17] p-3 text-sm text-white"
      />
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#263149] bg-[#090d17] p-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
