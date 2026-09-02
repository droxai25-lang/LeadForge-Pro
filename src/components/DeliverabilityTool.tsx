import type React from "react";
import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Server,
  Mail,
  Zap,
  Download,
  Copy,
  Check
} from "lucide-react";

interface VerificationResult {
  email: string;
  domain: string;
  isValidSyntax: boolean;
  isDisposable: boolean;
  hasMx: boolean;
  mxHosts: string[];
  spfRecords?: string[];
  aRecords?: string[];
  status: string;
  riskScore: number;
  dnsLatencyMs?: number;
  rawDnsError?: string | null;
  checkedAt: string;
}

interface VerificationApiResult extends VerificationResult {
  spf?: string[];
}

export const DeliverabilityTool: React.FC = () => {
  const [activeMode, setActiveMode] = useState<"single" | "batch">("single");

  // Single test state
  const [testEmail, setTestEmail] = useState("");
  const [isTestingSingle, setIsTestingSingle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<VerificationResult | null>(null);

  // Batch test state
  const [batchInput, setBatchInput] = useState("");
  const [isTestingBatch, setIsTestingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<{
    totalChecked: number;
    validCount: number;
    disposableCount: number;
    invalidCount: number;
    totalDurationMs: number;
    results: VerificationResult[];
  } | null>(null);

  const [copiedText, setCopiedText] = useState(false);

  // Handle single test
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setIsTestingSingle(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/deliverability/dns-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: [testEmail.trim()] })
      });

      const data = await response.json();
      if (!response.ok || !data.success || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error(data.error || "Failed to verify domain DNS");
      }

      const live = data.results[0];
      setSingleResult({
        email: live.email,
        domain: live.domain,
        isValidSyntax: live.isValidSyntax,
        isDisposable: live.isDisposable,
        hasMx: live.hasMx,
        mxHosts: live.mxHosts || [],
        spfRecords: live.spf || [],
        aRecords: [],
        status: live.status,
        riskScore: live.riskScore,
        dnsLatencyMs: undefined,
        rawDnsError: null,
        checkedAt: live.checkedAt
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "DNS MX query encountered a network error");
    } finally {
      setIsTestingSingle(false);
    }
  };

  // Handle batch test
  const handleBatchSubmit = async () => {
    if (!batchInput.trim()) return;
    const emails = batchInput
      .split(/\r?\n|,/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) return;

    setIsTestingBatch(true);
    setErrorMessage(null);
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/deliverability/dns-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Batch DNS verification failed");
      }

      const results: VerificationResult[] = ((data.results || []) as VerificationApiResult[]).map((result) => ({
        email: result.email,
        domain: result.domain,
        isValidSyntax: result.isValidSyntax,
        isDisposable: result.isDisposable,
        hasMx: result.hasMx,
        mxHosts: result.mxHosts || [],
        spfRecords: result.spf || [],
        aRecords: [],
        status: result.status,
        riskScore: result.riskScore,
        dnsLatencyMs: undefined,
        rawDnsError: null,
        checkedAt: result.checkedAt
      }));

      setBatchResults({
        totalChecked: results.length,
        validCount: results.filter((r) => r.status === "domain_accepts_mail").length,
        disposableCount: results.filter((r) => r.isDisposable).length,
        invalidCount: results.filter((r) => r.status === "invalid" || r.status === "no_mx").length,
        totalDurationMs: Date.now() - startedAt,
        results
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Batch verification error");
    } finally {
      setIsTestingBatch(false);
    }
  };

  const handleCopyReport = () => {
    if (!singleResult) return;
    const reportText = JSON.stringify(singleResult, null, 2);
    navigator.clipboard.writeText(reportText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadBatchCsv = () => {
    if (!batchResults || batchResults.results.length === 0) return;
    const headers = [
      "Email",
      "Domain",
      "Status",
      "Risk Score (0-100)",
      "Has MX",
      "Is Disposable",
      "Latency (ms)",
      "MX Hosts"
    ];
    const rows = batchResults.results.map((r) => [
      r.email,
      r.domain,
      r.status,
      r.riskScore,
      r.hasMx ? "YES" : "NO",
      r.isDisposable ? "YES" : "NO",
      r.dnsLatencyMs || 0,
      `"${r.mxHosts.join("; ")}"`
    ]);
    const csvContent = `data:text/csv;charset=utf-8,${[headers.join(","), ...rows.map((e) => e.join(","))].join("\n")}`;
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `deliverability_audit_batch_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl shadow-lg shadow-emerald-600/30 border border-emerald-400/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">DNS Deliverability Inspector</h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Live syntax validation and Mail Exchange (MX), SPF, and DMARC DNS lookups. These checks describe domain
                configuration; they do not confirm a person owns a mailbox.
              </p>
            </div>
          </div>

          {/* Verification mode switcher */}
          <div className="flex items-center p-1 bg-[#0a0d16] border border-[#1e283d] rounded-xl self-start md:self-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveMode("single")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeMode === "single"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Single Inspector
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("batch")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                activeMode === "batch"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Batch Verifier
            </button>
          </div>
        </div>

        {/* Aggregate SLA & Diagnostics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#1e283d]">
          <div className="p-3 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Protocol Standard</span>
            <span className="text-sm font-bold text-slate-200 font-mono mt-0.5 block">RFC 5322 / 5321</span>
          </div>
          <div className="p-3 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">DNS Lookup Engines</span>
            <span className="text-sm font-bold text-indigo-400 font-mono mt-0.5 block">MX + TXT + SPF/DMARC</span>
          </div>
          <div className="p-3 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Disposable Blacklist</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">Configured denylist</span>
          </div>
          <div className="p-3 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Mailbox Identity</span>
            <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">Not confirmed by DNS</span>
          </div>
        </div>
      </div>

      {/* MODE 1: SINGLE INSPECTOR */}
      {activeMode === "single" && (
        <div className="space-y-6">
          {/* Query Box */}
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-4">
            <form onSubmit={handleSingleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter prospect work email (e.g. founder@domain.com)..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 font-mono placeholder-slate-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={isTestingSingle}
                className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isTestingSingle ? "animate-spin" : ""}`} />
                <span>{isTestingSingle ? "Resolving DNS..." : "Inspect Mail Server & Deliverability"}</span>
              </button>
            </form>

            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Detailed Verification Report Card */}
          {singleResult && (
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-6">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1e283d] gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-white font-mono">{singleResult.email}</span>
                    {singleResult.dnsLatencyMs !== undefined && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 tabular-nums">
                        {singleResult.dnsLatencyMs}ms DNS Roundtrip
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 block font-mono">Domain: {singleResult.domain}</span>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleCopyReport}
                    className="p-2 bg-[#0a0d16] hover:bg-[#151c2e] border border-[#1e283d] text-slate-300 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? "Copied JSON" : "Copy Payload"}</span>
                  </button>

                  <div
                    className={`px-3.5 py-1 text-xs font-bold rounded-xl flex items-center space-x-1.5 uppercase tracking-wider ${
                      singleResult.status === "domain_accepts_mail"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : singleResult.status === "disposable"
                          ? "bg-rose-950 text-rose-400 border border-rose-800"
                          : "bg-amber-950 text-amber-400 border border-amber-800"
                    }`}
                  >
                    {singleResult.status === "domain_accepts_mail" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : singleResult.status === "disposable" ? (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      {singleResult.status === "domain_accepts_mail"
                        ? "Domain Accepts Mail (Mailbox Unknown)"
                        : singleResult.status === "disposable"
                          ? "Disposable (High Risk)"
                          : "Unreachable (Check MX)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4-Factor Diagnostic Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium block">RFC 5322 Syntax</span>
                  <div className="flex items-center space-x-2">
                    {singleResult.isValidSyntax ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {singleResult.isValidSyntax ? "Valid RFC Format" : "Malformed Syntax"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Strict regex & formatting audit</span>
                </div>

                <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium block">Burner / Temporary Mail</span>
                  <div className="flex items-center space-x-2">
                    {!singleResult.isDisposable ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {!singleResult.isDisposable ? "Clean Domain" : "Blacklisted Burner"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Configured disposable-domain denylist</span>
                </div>

                <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium block">Mail Exchange (MX)</span>
                  <div className="flex items-center space-x-2">
                    {singleResult.hasMx ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {singleResult.hasMx ? `${singleResult.mxHosts.length} MX Hosts Active` : "No MX Servers"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Authoritative DNS query resolution</span>
                </div>

                <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-medium block">Estimated Bounce Risk</span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-mono font-bold ${
                        singleResult.riskScore <= 15
                          ? "text-emerald-400"
                          : singleResult.riskScore <= 50
                            ? "text-amber-400"
                            : "text-rose-400"
                      }`}
                    >
                      {singleResult.riskScore}/100 Risk Score
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {singleResult.riskScore <= 15
                      ? "Low domain-level DNS risk; mailbox identity remains unconfirmed"
                      : "Elevated risk"}
                  </span>
                </div>
              </div>

              {/* Live DNS Record Inspector */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Authoritative DNS Records ({singleResult.domain})</span>
                </h3>

                {/* MX Records Grid */}
                <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-2">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>MX Records (Mail Exchangers)</span>
                  </span>
                  {singleResult.mxHosts.length > 0 ? (
                    <div className="space-y-1">
                      {singleResult.mxHosts.map((host) => (
                        <div
                          key={host}
                          className="flex items-center justify-between p-2 bg-[#0f1523] rounded-lg border border-[#1e283d]/60 text-xs font-mono text-slate-200"
                        >
                          <span className="truncate">{host}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            ACTIVE
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-rose-400 font-mono">No MX records returned by DNS resolver.</p>
                  )}
                </div>

                {/* SPF / TXT Records */}
                {singleResult.spfRecords && singleResult.spfRecords.length > 0 && (
                  <div className="p-4 bg-[#0a0d16] rounded-xl border border-[#1e283d] space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center space-x-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      <span>SPF (Sender Policy Framework) & DMARC TXT Records</span>
                    </span>
                    <div className="space-y-1">
                      {singleResult.spfRecords.map((spf) => (
                        <div
                          key={spf}
                          className="p-2 bg-[#0f1523] rounded-lg border border-[#1e283d]/60 text-xs font-mono text-slate-300 break-all"
                        >
                          {spf}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: BATCH INSPECTOR */}
      {activeMode === "batch" && (
        <div className="space-y-6">
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">Batch Deliverability Verifier</h2>
              <p className="text-xs text-slate-400">
                Paste up to 50 email addresses (one per line or comma-separated) for parallel live DNS validation.
              </p>
            </div>

            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={6}
              placeholder="Enter email addresses..."
              className="w-full p-3.5 text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl focus:outline-none focus:border-indigo-500 text-slate-100 font-mono placeholder-slate-600 transition resize-y"
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-400 font-mono">
                {batchInput.split(/\r?\n|,/).filter((e) => e.trim().length > 0).length} addresses queued
              </span>

              <button
                type="button"
                onClick={handleBatchSubmit}
                disabled={isTestingBatch}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Zap className={`w-4 h-4 ${isTestingBatch ? "animate-spin" : ""}`} />
                <span>{isTestingBatch ? "Testing Cohort in Parallel..." : "Execute Batch DNS Audit"}</span>
              </button>
            </div>
          </div>

          {/* Batch Results Table */}
          {batchResults && (
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e283d]">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Batch Audit Summary</h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
                    <span>Total: {batchResults.totalChecked}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">{batchResults.validCount} Valid</span>
                    <span>•</span>
                    <span className="text-rose-400 font-bold">{batchResults.disposableCount} Disposable</span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">{batchResults.invalidCount} Unreachable</span>
                    <span>•</span>
                    <span>{batchResults.totalDurationMs}ms execution time</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBatchCsv}
                  className="px-3.5 py-2 bg-[#0a0d16] hover:bg-[#151c2e] border border-[#1e283d] text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Download Audit CSV</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0a0d16] text-slate-400 font-semibold border-b border-[#1e283d]">
                    <tr>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Risk Rating</th>
                      <th className="p-3">MX Mail Servers</th>
                      <th className="p-3">DNS Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e283d]/60 font-mono">
                    {batchResults.results.map((r) => (
                      <tr key={`${r.email}-${r.checkedAt}`} className="hover:bg-[#151c2e]/40 transition">
                        <td className="p-3 text-slate-200">{r.email}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              r.status === "domain_accepts_mail"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : r.status === "disposable"
                                  ? "bg-rose-950 text-rose-400 border border-rose-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              r.riskScore <= 15
                                ? "text-emerald-400"
                                : r.riskScore <= 50
                                  ? "text-amber-400"
                                  : "text-rose-400"
                            }
                          >
                            {r.riskScore}/100
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 truncate max-w-[200px]">
                          {r.mxHosts.length > 0 ? r.mxHosts[0] : "None"}
                        </td>
                        <td className="p-3 text-slate-500">{r.dnsLatencyMs || 0}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
