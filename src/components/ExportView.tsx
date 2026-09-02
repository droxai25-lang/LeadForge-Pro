import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Plus, RefreshCw, Send, ShieldCheck, Trash2 } from "lucide-react";
import type { Lead } from "../types";
import type { QualificationContract } from "../lib/opportunityQualification";
import { createDefaultQualificationContract, QualificationContractEditor } from "./QualificationContractEditor";

interface ManagedClient {
  id: string;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  targetProfile: QualificationContract;
  qualificationReady?: boolean;
  qualificationError?: string | null;
  defaultRetentionDays: number;
  status: "active" | "paused" | "archived";
  exclusions: ClientExclusion[];
  _count: { reviews: number; batches: number };
}

interface ClientExclusion {
  id: string;
  type: "email" | "domain" | "company";
  value: string;
  reason?: string | null;
}

interface LeadReview {
  leadId: string;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
}

interface DeliveryBatch {
  id: string;
  clientId: string;
  format: "csv" | "json";
  status: "prepared" | "exported" | "delivered" | "purged";
  fileName: string;
  payloadSha256: string;
  recordCount: number;
  deliveredTo?: string | null;
  retentionUntil: string;
  purgedAt?: string | null;
  createdAt: string;
  client: { name: string };
}

interface ExportViewProps {
  leads: Lead[];
}

async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const value: unknown = await response.json().catch(() => ({}));
  const data = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  if (!response.ok)
    throw new Error(typeof data.error === "string" ? data.error : `Request failed with HTTP ${response.status}.`);
  return value as T;
}

export function ExportView({ leads }: ExportViewProps) {
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [batches, setBatches] = useState<DeliveryBatch[]>([]);
  const [reviews, setReviews] = useState<LeadReview[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [scope, setScope] = useState<"qualified" | "verified" | "all">("qualified");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [targetProfile, setTargetProfile] = useState<QualificationContract>(() => createDefaultQualificationContract());
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedTargetProfile, setEditedTargetProfile] = useState<QualificationContract>(() =>
    createDefaultQualificationContract()
  );
  const [retentionDays, setRetentionDays] = useState(90);
  const [exclusionType, setExclusionType] = useState<"email" | "domain" | "company">("domain");
  const [exclusionValue, setExclusionValue] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const filteredLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          scope === "all" || (scope === "qualified" ? lead.isQualified : lead.verificationStatus === "mailbox_accepted")
      ),
    [leads, scope]
  );
  const reviewByLeadId = useMemo(() => new Map(reviews.map((review) => [review.leadId, review.status])), [reviews]);
  const approvedCount = filteredLeads.filter((lead) => reviewByLeadId.get(lead.id) === "approved").length;

  const refreshWorkspace = useCallback(async () => {
    const [clientData, batchData] = await Promise.all([
      fetch("/api/managed-clients").then(readJson<{ clients: ManagedClient[] }>),
      fetch("/api/delivery-batches").then(readJson<{ batches: DeliveryBatch[] }>)
    ]);
    setClients(clientData.clients || []);
    setBatches(batchData.batches || []);
    setSelectedClientId((current) =>
      clientData.clients.some((client: ManagedClient) => client.id === current)
        ? current
        : clientData.clients.find((client: ManagedClient) => client.status === "active")?.id || ""
    );
  }, []);

  const refreshReviews = useCallback(async () => {
    if (!selectedClientId) return setReviews([]);
    const data = await fetch(`/api/managed-clients/${selectedClientId}/reviews`).then(
      readJson<{ reviews: LeadReview[] }>
    );
    setReviews(data.reviews || []);
  }, [selectedClientId]);

  useEffect(() => {
    refreshWorkspace().catch((error) => setNotice({ type: "error", message: error.message }));
  }, [refreshWorkspace]);

  useEffect(() => {
    refreshReviews().catch((error) => setNotice({ type: "error", message: error.message }));
  }, [refreshReviews]);

  const runAction = async (action: () => Promise<void>) => {
    setIsWorking(true);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "The operation failed." });
    } finally {
      setIsWorking(false);
    }
  };

  const createClient = () =>
    runAction(async () => {
      const data = await fetch("/api/managed-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clientName,
          contactEmail: clientContact || undefined,
          targetProfile,
          defaultRetentionDays: retentionDays
        })
      }).then(readJson<{ client: ManagedClient }>);
      setClientName("");
      setClientContact("");
      setTargetProfile(createDefaultQualificationContract());
      await refreshWorkspace();
      setSelectedClientId(data.client.id);
      setNotice({ type: "success", message: `Created managed client ${data.client.name}.` });
    });

  const beginProfileEdit = () => {
    if (!selectedClient) return;
    setEditedTargetProfile(
      selectedClient.qualificationReady === false ? createDefaultQualificationContract() : selectedClient.targetProfile
    );
    setEditingProfile(true);
  };

  const saveProfileEdit = () =>
    runAction(async () => {
      if (!selectedClient) throw new Error("Select a managed client first.");
      await fetch(`/api/managed-clients/${selectedClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProfile: editedTargetProfile })
      }).then(readJson<{ batch: DeliveryBatch }>);
      setEditingProfile(false);
      await refreshWorkspace();
      setNotice({ type: "success", message: `Updated ${selectedClient.name}'s executable qualification contract.` });
    });

  const addExclusion = () =>
    runAction(async () => {
      if (!selectedClient) throw new Error("Select a managed client first.");
      await fetch(`/api/managed-clients/${selectedClient.id}/exclusions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: exclusionType, value: exclusionValue })
      }).then(readJson);
      setExclusionValue("");
      await refreshWorkspace();
      setNotice({ type: "success", message: "Client exclusion saved." });
    });

  const removeExclusion = (exclusionId: string) =>
    runAction(async () => {
      if (!selectedClient) throw new Error("Select a managed client first.");
      const response = await fetch(`/api/managed-clients/${selectedClient.id}/exclusions/${exclusionId}`, {
        method: "DELETE"
      });
      if (!response.ok) await readJson(response);
      await refreshWorkspace();
      setNotice({ type: "success", message: "Client exclusion removed." });
    });

  const reviewLeads = (status: "approved" | "rejected") =>
    runAction(async () => {
      if (!selectedClient) throw new Error("Select a managed client first.");
      if (filteredLeads.length === 0) throw new Error("The selected lead scope is empty.");
      await fetch(`/api/managed-clients/${selectedClient.id}/reviews`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: filteredLeads.map((lead) => lead.id), status })
      }).then(readJson);
      await refreshReviews();
      setNotice({ type: "success", message: `${filteredLeads.length} lead(s) marked ${status}.` });
    });

  const prepareBatch = (format: "csv" | "json") =>
    runAction(async () => {
      if (!selectedClient) throw new Error("Select a managed client first.");
      const leadIds = filteredLeads.filter((lead) => reviewByLeadId.get(lead.id) === "approved").map((lead) => lead.id);
      if (leadIds.length === 0) throw new Error("Approve at least one lead for this client first.");
      const data = await fetch("/api/delivery-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClient.id, leadIds, format })
      }).then(readJson<{ batch: DeliveryBatch }>);
      await refreshWorkspace();
      setNotice({
        type: "success",
        message: `Prepared ${data.batch.recordCount}-lead ${format.toUpperCase()} batch with SHA-256 ${data.batch.payloadSha256}.`
      });
    });

  const exportBatch = (batch: DeliveryBatch) =>
    runAction(async () => {
      const response = await fetch(`/api/delivery-batches/${batch.id}/export`, { method: "POST" });
      if (!response.ok) await readJson(response);
      const blob = await response.blob();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (digest !== batch.payloadSha256) throw new Error("Downloaded bytes did not match the recorded SHA-256 hash.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = batch.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      await refreshWorkspace();
      setNotice({ type: "success", message: `Downloaded and verified ${batch.fileName}.` });
    });

  const markDelivered = (batch: DeliveryBatch) => {
    const deliveredTo = window.prompt(
      "Record the customer, email address, or delivery destination:",
      batch.deliveredTo || ""
    );
    if (deliveredTo === null) return;
    void runAction(async () => {
      await fetch(`/api/delivery-batches/${batch.id}/delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveredTo })
      }).then(readJson);
      await refreshWorkspace();
      setNotice({ type: "success", message: "Delivery history updated." });
    });
  };

  const sendWebhook = (batch: DeliveryBatch) => {
    const targetUrl = window.prompt("Enter the approved public HTTPS webhook destination:");
    if (targetUrl === null) return;
    void runAction(async () => {
      await fetch("/api/export/webhook-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, batchId: batch.id })
      }).then(readJson);
      await refreshWorkspace();
      setNotice({ type: "success", message: `Delivered and recorded ${batch.fileName} to the HTTPS webhook.` });
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121829] border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Managed Client Deliveries
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review client-specific leads, enforce exclusions, prepare immutable exports, verify hashes, and retain
              delivery history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshWorkspace()}
            className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`rounded-xl border p-3 text-sm flex gap-2 ${notice.type === "success" ? "border-emerald-800 bg-emerald-950/30 text-emerald-300" : "border-rose-800 bg-rose-950/30 text-rose-300"}`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-[#121829] border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Client profile</h2>
          <select
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">Create or select a managed client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} — {client.status}
              </option>
            ))}
          </select>
          {!selectedClient && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Client name"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
                <input
                  value={clientContact}
                  onChange={(event) => setClientContact(event.target.value)}
                  placeholder="Delivery contact email"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <QualificationContractEditor value={targetProfile} onChange={setTargetProfile} showMarketFields />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-slate-400">
                  Retention days
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={retentionDays}
                    onChange={(event) => setRetentionDays(Number(event.target.value))}
                    className="mt-1 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  disabled={isWorking || !clientName.trim() || targetProfile.qualifyingSignals.length === 0}
                  onClick={() => void createClient()}
                  className="self-end flex items-center justify-center gap-2 bg-indigo-600 disabled:opacity-50 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                >
                  <Plus className="w-4 h-4" />
                  Create client
                </button>
              </div>
            </div>
          )}
          {selectedClient && !editingProfile && (
            <div className="text-xs text-slate-300 space-y-2">
              {selectedClient.qualificationReady === false ? (
                <p className="rounded-lg border border-amber-700 bg-amber-950/30 p-2 text-amber-300">
                  Legacy profile is not executable: {selectedClient.qualificationError}. Update it before starting a new
                  discovery.
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-slate-500">Offer:</span> {selectedClient.targetProfile.clientOffer}
                  </p>
                  <p>
                    <span className="text-slate-500">Qualification:</span>{" "}
                    {selectedClient.targetProfile.qualifyingSignals.length} weighted signals ·{" "}
                    {selectedClient.targetProfile.minEvidenceCount} observations · score{" "}
                    {selectedClient.targetProfile.minOpportunityScore}+
                  </p>
                </>
              )}
              <p>
                <span className="text-slate-500">Retention:</span> {selectedClient.defaultRetentionDays} days
              </p>
              <p>
                <span className="text-slate-500">History:</span> {selectedClient._count.reviews} reviews ·{" "}
                {selectedClient._count.batches} batches
              </p>
              <button
                type="button"
                onClick={beginProfileEdit}
                className="rounded-lg bg-indigo-600 px-3 py-2 font-semibold text-white"
              >
                {selectedClient.qualificationReady === false ? "Replace legacy profile" : "Edit qualification contract"}
              </button>
            </div>
          )}
          {selectedClient && editingProfile && (
            <div className="space-y-3">
              <QualificationContractEditor
                value={editedTargetProfile}
                onChange={setEditedTargetProfile}
                showMarketFields
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isWorking || editedTargetProfile.qualifyingSignals.length === 0}
                  onClick={() => void saveProfileEdit()}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Save executable contract
                </button>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => setEditingProfile(false)}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-[#121829] border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Client exclusions</h2>
          <div className="flex gap-2">
            <select
              value={exclusionType}
              onChange={(event) => setExclusionType(event.target.value as typeof exclusionType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="domain">Domain</option>
              <option value="email">Email</option>
              <option value="company">Company</option>
            </select>
            <input
              value={exclusionValue}
              onChange={(event) => setExclusionValue(event.target.value)}
              placeholder="Value to exclude"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={isWorking || !selectedClient || !exclusionValue.trim()}
              onClick={() => void addExclusion()}
              className="bg-indigo-600 disabled:opacity-50 rounded-lg px-3 py-2 text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-36 overflow-auto">
            {selectedClient?.exclusions.map((exclusion) => (
              <div
                key={exclusion.id}
                className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs"
              >
                <span className="text-slate-300">
                  <strong className="text-indigo-300 uppercase">{exclusion.type}</strong> {exclusion.value}
                </span>
                <button type="button" onClick={() => void removeExclusion(exclusion.id)} className="text-rose-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )) || <p className="text-xs text-slate-500">Select a client to manage exclusions.</p>}
          </div>
        </section>
      </div>

      <section className="bg-[#121829] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Review and prepare</h2>
            <p className="text-xs text-slate-500 mt-1">
              {filteredLeads.length} in scope · {approvedCount} approved for selected client
            </p>
          </div>
          <div className="flex gap-2">
            {(["qualified", "verified", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`px-3 py-1.5 rounded-lg text-xs capitalize ${scope === value ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isWorking || !selectedClient || filteredLeads.length === 0}
            onClick={() => void reviewLeads("approved")}
            className="px-4 py-2 rounded-lg bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Approve scope
          </button>
          <button
            type="button"
            disabled={isWorking || !selectedClient || filteredLeads.length === 0}
            onClick={() => void reviewLeads("rejected")}
            className="px-4 py-2 rounded-lg bg-rose-900 disabled:opacity-50 text-rose-100 text-xs font-semibold"
          >
            Reject scope
          </button>
          <button
            type="button"
            disabled={isWorking || approvedCount === 0}
            onClick={() => void prepareBatch("csv")}
            className="px-4 py-2 rounded-lg bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Prepare CSV
          </button>
          <button
            type="button"
            disabled={isWorking || approvedCount === 0}
            onClick={() => void prepareBatch("json")}
            className="px-4 py-2 rounded-lg bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Prepare JSON
          </button>
        </div>
      </section>

      <section className="bg-[#121829] border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white">Delivery history</h2>
        <div className="space-y-2">
          {batches
            .filter((batch) => !selectedClientId || batch.clientId === selectedClientId)
            .map((batch) => (
              <div
                key={batch.id}
                className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3"
              >
                <div className="min-w-0 text-xs">
                  <p className="text-slate-200 font-semibold truncate">
                    {batch.fileName} · {batch.recordCount} leads · {batch.status}
                  </p>
                  <p className="text-slate-500 font-mono truncate" title={batch.payloadSha256}>
                    SHA-256 {batch.payloadSha256}
                  </p>
                  <p className="text-slate-500">
                    Retain until {new Date(batch.retentionUntil).toLocaleString()}
                    {batch.deliveredTo ? ` · Delivered to ${batch.deliveredTo}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isWorking || batch.status === "purged"}
                    onClick={() => void exportBatch(batch)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 disabled:opacity-50 text-white text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                  {batch.format === "json" && (
                    <button
                      type="button"
                      disabled={isWorking || batch.status === "purged"}
                      onClick={() => sendWebhook(batch)}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-900 disabled:opacity-50 text-indigo-100 text-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      HTTPS webhook
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isWorking || batch.status === "purged"}
                    onClick={() => markDelivered(batch)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 disabled:opacity-50 text-slate-200 text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Record delivery
                  </button>
                </div>
              </div>
            ))}
          {batches.length === 0 && (
            <p className="text-xs text-slate-500">No immutable delivery batches have been prepared.</p>
          )}
        </div>
      </section>
    </div>
  );
}
