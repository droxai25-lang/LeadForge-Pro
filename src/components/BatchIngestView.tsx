import type React from "react";
import { useState, useMemo, useRef } from "react";
import type { Lead, DuplicateCandidate, IngestLeadInput } from "../types";
import {
  UploadCloud,
  UserPlus,
  Zap,
  CheckCircle2,
  ArrowRight,
  Table,
  Building,
  Mail,
  User,
  Briefcase,
  Globe,
  Users,
  RotateCcw
} from "lucide-react";
import { DuplicateReviewModal } from "./DuplicateReviewModal";

interface BatchIngestViewProps {
  existingLeads?: Lead[];
  onIngestSingle: (leadData: IngestLeadInput) => Promise<boolean>;
  onIngestBatch: (leads: IngestLeadInput[], autoEnrich: boolean) => Promise<{ created: number; skipped: number }>;
  onMergeLead?: (targetLeadId: string, incomingData: IngestLeadInput) => Promise<boolean>;
  onNavigateToLeads: () => void;
}

interface PreviewRow {
  key: string;
  data: Record<string, unknown>;
}

function createPreviewRows(rows: unknown[]): PreviewRow[] {
  const occurrences = new Map<string, number>();
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const serialized = JSON.stringify(row);
      const occurrence = occurrences.get(serialized) || 0;
      occurrences.set(serialized, occurrence + 1);
      return { key: `${serialized}#${occurrence}`, data: row };
    });
}

function isIngestLeadInput(value: unknown): value is IngestLeadInput {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const BatchIngestView: React.FC<BatchIngestViewProps> = ({
  existingLeads = [],
  onIngestSingle,
  onIngestBatch,
  onMergeLead,
  onNavigateToLeads
}) => {
  const [activeMode, setActiveMode] = useState<"batch" | "manual">("batch");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  const [annualRevenue, setAnnualRevenue] = useState<string>("");
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [singleSuccess, setSingleSuccess] = useState(false);

  const [rawText, setRawText] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<{ created: number; skipped: number; merged?: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Duplicate Resolution State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [pendingUniqueLeads, setPendingUniqueLeads] = useState<IngestLeadInput[]>([]);

  const handleClearDraft = () => {
    if (window.confirm("Are you sure you want to clear the current ingest form?")) {
      setRawText("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("");
      setCompanyName("");
      setCompanyDomain("");
      setIndustry("");
      setEmployeeCount(0);
      setAnnualRevenue("");
      setBatchResult(null);
    }
  };

  // Parse raw text for live preview
  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) return [];
    try {
      const trimmed = rawText.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed);
        return createPreviewRows(Array.isArray(parsed) ? parsed.slice(0, 5) : [parsed]);
      } else {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length <= 1) return [];
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
        const rows: IngestLeadInput[] = [];
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
          const obj: IngestLeadInput = {};
          headers.forEach((h, idx) => {
            obj[h] = values[idx] || "";
          });
          rows.push(obj);
        }
        return createPreviewRows(rows);
      }
    } catch {
      return [];
    }
  }, [rawText]);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName || !jobTitle) return;
    setIsSubmittingSingle(true);
    try {
      const success = await onIngestSingle({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        jobTitle,
        companyName: companyName || (companyDomain ? companyDomain.split(".")[0].toUpperCase() : "Company"),
        companyDomain: companyDomain || email.split("@")[1] || "company.com",
        industry,
        employeeCount,
        annualRevenueUsd: Number(annualRevenue) || 5000000
      });
      if (success) {
        setSingleSuccess(true);
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setJobTitle("");
        setCompanyName("");
        setCompanyDomain("");
        setTimeout(() => setSingleSuccess(false), 4000);
      }
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleParseAndIngestBatch = async () => {
    if (!rawText.trim()) return;
    setIsSubmittingBatch(true);
    setBatchResult(null);

    try {
      let parsedLeads: IngestLeadInput[] = [];
      const trimmed = rawText.trim();

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const rawJson = JSON.parse(trimmed);
        parsedLeads = (Array.isArray(rawJson) ? rawJson : [rawJson]).filter(isIngestLeadInput);
      } else {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
            const obj: IngestLeadInput = {};
            headers.forEach((header, idx) => {
              obj[header] = values[idx] || "";
            });
            if (obj.email || obj.email_address) {
              parsedLeads.push(obj);
            }
          }
        }
      }

      if (parsedLeads.length === 0) {
        alert("No valid records containing email addresses could be detected.");
        return;
      }

      // Proactive Duplicate Detection
      const detectedDuplicates: DuplicateCandidate[] = [];
      const uniqueLeads: IngestLeadInput[] = [];
      const seenBatchEmails = new Map<string, IngestLeadInput & { rawIndex: number }>();

      parsedLeads.forEach((incoming, idx) => {
        const email = (incoming.email || incoming.email_address || "").trim().toLowerCase();
        const incomingFirst = (incoming.firstName || incoming.first_name || "").trim().toLowerCase();
        const incomingLast = (incoming.lastName || incoming.last_name || "").trim().toLowerCase();
        const incomingDomain = (
          incoming.companyDomain ||
          incoming.company_domain ||
          incoming.domain ||
          email.split("@")[1] ||
          ""
        ).toLowerCase();

        // 1. Check against existing database leads
        const existingEmailMatch = existingLeads.find((l) => l.email.trim().toLowerCase() === email);

        const existingNameDomainMatch =
          !existingEmailMatch && incomingFirst && incomingDomain
            ? existingLeads.find((l) => {
                const matchesName =
                  l.firstName.trim().toLowerCase() === incomingFirst &&
                  (!incomingLast || l.lastName.trim().toLowerCase() === incomingLast);
                const matchesDomain = l.companyDomain.trim().toLowerCase() === incomingDomain;
                return matchesName && matchesDomain;
              })
            : null;

        const matchedLead = existingEmailMatch || existingNameDomainMatch;

        if (matchedLead) {
          // Identify differences
          const differences: { field: string; label: string; existingValue: unknown; incomingValue: unknown }[] = [];
          if (incoming.phone && incoming.phone !== matchedLead.phone) {
            differences.push({
              field: "phone",
              label: "Phone Number",
              existingValue: matchedLead.phone || "(none)",
              incomingValue: incoming.phone
            });
          }
          if (incoming.jobTitle && incoming.jobTitle !== matchedLead.jobTitle) {
            differences.push({
              field: "jobTitle",
              label: "Job Title",
              existingValue: matchedLead.jobTitle,
              incomingValue: incoming.jobTitle
            });
          }
          if (incoming.employeeCount && Number(incoming.employeeCount) !== matchedLead.employeeCount) {
            differences.push({
              field: "employeeCount",
              label: "Employee Count",
              existingValue: matchedLead.employeeCount,
              incomingValue: incoming.employeeCount
            });
          }

          detectedDuplicates.push({
            id: `dup-${Date.now()}-${idx}`,
            incomingLead: { ...incoming, rawIndex: idx },
            existingLead: matchedLead,
            matchedReason: existingEmailMatch ? "exact_email" : "domain_and_name",
            action: "merge",
            differences
          });
        } else if (seenBatchEmails.has(email)) {
          // Duplicate within current batch file
          const prior = seenBatchEmails.get(email);
          detectedDuplicates.push({
            id: `dup-batch-${Date.now()}-${idx}`,
            incomingLead: { ...incoming, rawIndex: idx },
            matchedReason: "batch_redundancy",
            action: "ignore",
            differences: [
              {
                field: "email",
                label: "Batch Collision",
                existingValue: `Appeared earlier in row #${prior.rawIndex + 1}`,
                incomingValue: `Row #${idx + 1}`
              }
            ]
          });
        } else {
          seenBatchEmails.set(email, { ...incoming, rawIndex: idx });
          uniqueLeads.push(incoming);
        }
      });

      // If duplicate candidates found, trigger proactive resolution modal
      if (detectedDuplicates.length > 0) {
        setDuplicateCandidates(detectedDuplicates);
        setPendingUniqueLeads(uniqueLeads);
        setIsDuplicateModalOpen(true);
      } else {
        // No duplicates: proceed directly with standard batch commit
        const res = await onIngestBatch(parsedLeads, autoEnrich);
        setBatchResult(res);
      }
    } catch (err: unknown) {
      alert(`Parsing failed: ${errorText(err)}. Please check CSV/JSON format.`);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleConfirmDuplicateResolutions = async (resolvedCandidates: DuplicateCandidate[]) => {
    setIsDuplicateModalOpen(false);
    setIsSubmittingBatch(true);

    try {
      let mergedCount = 0;
      const separateToImport: IngestLeadInput[] = [];
      let ignoredCount = 0;

      // 1. Process merges
      for (const cand of resolvedCandidates) {
        if (cand.action === "merge" && cand.existingLead && onMergeLead) {
          const success = await onMergeLead(cand.existingLead.id, cand.incomingLead);
          if (success) mergedCount++;
        } else if (cand.action === "import_separate") {
          separateToImport.push(cand.incomingLead);
        } else if (cand.action === "ignore") {
          ignoredCount++;
        }
      }

      // 2. Ingest unique leads + separate imports
      const leadsToCreate = [...pendingUniqueLeads, ...separateToImport];
      let createdCount = 0;
      if (leadsToCreate.length > 0) {
        const res = await onIngestBatch(leadsToCreate, autoEnrich);
        createdCount = res.created;
      }

      setBatchResult({
        created: createdCount,
        skipped: ignoredCount,
        merged: mergedCount
      });
    } catch (err: unknown) {
      alert(`Error committing resolved batch: ${errorText(err)}`);
    } finally {
      setIsSubmittingBatch(false);
      setPendingUniqueLeads([]);
      setDuplicateCandidates([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Mode Switcher Banner */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-600/30 border border-indigo-400/20">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Lead Data Ingestion Hub</h1>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Import prospecting datasets via CSV, TSV, or structured JSON. Automated deduplication, DNS verification,
                and ICP fit scoring.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {(rawText || firstName || email || companyName) && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-800/60 transition cursor-pointer"
                title="Clear the current unsaved form"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Draft</span>
              </button>
            )}

            <div className="flex items-center p-1 bg-[#0a0d16] border border-[#1e283d] rounded-xl">
              <button
                type="button"
                onClick={() => setActiveMode("batch")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMode === "batch"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Bulk Ingestion (CSV / JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("manual")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeMode === "manual"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Single Lead Form</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeMode === "batch" ? (
        <div className="space-y-6">
          {/* Main Ingest Area */}
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-5">
            {/* Drag and Drop Zone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(event) => {
                if (event.target.files?.[0]) {
                  handleFileUpload(event.target.files[0]);
                }
              }}
              accept=".csv,.json,.tsv,.txt"
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                dragActive
                  ? "border-indigo-500 bg-indigo-950/20"
                  : "border-[#1e283d] hover:border-slate-600 bg-[#0a0d16]/50"
              }`}
            >
              <div className="p-3 rounded-full bg-[#0f1523] border border-[#1e283d] text-indigo-400 shadow-md">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-white">
                  Drop your CSV, TSV, or JSON file here, or <span className="text-indigo-400">browse local files</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Supports standard sales exports from Apollo, ZoomInfo, Clay, LinkedIn Sales Nav
                </p>
              </div>
            </button>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1 text-xs">
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText("")}
                  className="text-xs text-slate-500 hover:text-rose-400 transition cursor-pointer"
                >
                  Clear Content
                </button>
              )}
            </div>

            {/* Textarea */}
            <div>
              <label htmlFor="batch-raw-data" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Raw Data Stream (CSV / JSON):
              </label>
              <textarea
                id="batch-raw-data"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste CSV rows or JSON array..."
                rows={7}
                className="w-full font-mono text-xs text-slate-200 bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 focus:outline-none focus:border-indigo-500 transition resize-y"
              />
            </div>

            {/* Live Data Grid Preview */}
            {parsedPreview.length > 0 && (
              <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                    <Table className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Live Pre-Ingest Data Matrix Preview (First {parsedPreview.length} records detected)</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                    Schema Validated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-[#0f1523] text-slate-400 border-b border-[#1e283d]">
                      <tr>
                        {Object.keys(parsedPreview[0]?.data || {})
                          .slice(0, 6)
                          .map((k) => (
                            <th key={k} className="p-2 truncate">
                              {k}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e283d]/50 text-slate-300">
                      {parsedPreview.map(({ key, data: row }) => (
                        <tr key={key} className="hover:bg-[#151c2e]/40">
                          {Object.keys(parsedPreview[0]?.data || {})
                            .slice(0, 6)
                            .map((k) => (
                              <td key={k} className="p-2 truncate max-w-[150px]">
                                {String(row[k] || "")}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Auto Enrich Toggle */}
            <div className="flex items-center justify-between bg-[#0a0d16] border border-indigo-900/40 rounded-xl p-3.5">
              <label className="flex items-center space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoEnrich}
                  onChange={(e) => setAutoEnrich(e.target.checked)}
                  className="rounded border-[#1e283d] bg-[#0a0d16] text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Automated Ingest Enrichment & MX Deliverability Audit
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Verify mail exchangers and calculate ICP scoring immediately during batch load.
                  </span>
                </div>
              </label>
            </div>

            {/* Ingest Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleParseAndIngestBatch}
                disabled={isSubmittingBatch || !rawText.trim()}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isSubmittingBatch ? "animate-spin" : ""}`} />
                <span>{isSubmittingBatch ? "Parsing & Verifying Leads..." : "Commit & Ingest Batch to Pipeline"}</span>
              </button>

              {batchResult && (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-3.5 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {batchResult.created} Created
                      {batchResult.merged ? ` • ${batchResult.merged} Merged` : ""}
                      {batchResult.skipped ? ` • ${batchResult.skipped} Skipped` : ""}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onNavigateToLeads}
                    className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-semibold transition cursor-pointer"
                  >
                    <span>View in Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE LEAD ENTRY FORM */
        <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-tight">Manual Decision Maker Profile Form</h2>
            <p className="text-xs text-slate-400">
              Create an individual enterprise lead with automatic account linkage and live deliverability verification.
            </p>
          </div>

          {singleSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Lead successfully created, verified, and scored!</span>
              </span>
              <button
                type="button"
                onClick={onNavigateToLeads}
                className="text-xs font-bold text-emerald-400 underline hover:text-emerald-300 cursor-pointer"
              >
                Go to Pipeline
              </button>
            </div>
          )}

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lead-first-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  First Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="e.g. Patrick"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-last-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Last Name
                </label>
                <input
                  id="lead-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Collison"
                  className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lead-work-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Work Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-work-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!companyDomain && e.target.value.includes("@")) {
                        setCompanyDomain(e.target.value.split("@")[1]);
                      }
                    }}
                    required
                    placeholder="e.g. patrick@stripe.com"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-job-title" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Job Title *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-job-title"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    placeholder="e.g. Chief Executive Officer / VP Engineering"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="lead-company-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Company Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Stripe"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-company-domain" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Company Domain
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-company-domain"
                    type="text"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="e.g. stripe.com"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lead-employee-count" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Employee Count
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="lead-employee-count"
                    type="number"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(Number(e.target.value))}
                    placeholder="e.g. 500"
                    className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="submit"
                disabled={isSubmittingSingle}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isSubmittingSingle ? "animate-spin" : ""}`} />
                <span>{isSubmittingSingle ? "Saving & Scoring..." : "Save Prospect to Pipeline"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Proactive Duplicate Review & Resolution Modal */}
      <DuplicateReviewModal
        isOpen={isDuplicateModalOpen}
        onClose={() => {
          setIsDuplicateModalOpen(false);
          setIsSubmittingBatch(false);
        }}
        duplicates={duplicateCandidates}
        uniqueLeadsCount={pendingUniqueLeads.length}
        onConfirmResolutions={handleConfirmDuplicateResolutions}
      />
    </div>
  );
};
