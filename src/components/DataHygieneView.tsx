import type React from "react";
import { useState, useEffect, useCallback } from "react";
import type { Lead, HygieneAuditReport } from "../types";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Copy,
  Mail,
  Globe,
  CheckCircle2,
  ArrowRight,
  Check
} from "lucide-react";

interface DataHygieneViewProps {
  leads: Lead[];
  onRefreshData: () => Promise<void>;
  onNavigateToLeads: () => void;
}

export const DataHygieneView: React.FC<DataHygieneViewProps> = ({ leads, onRefreshData, onNavigateToLeads }) => {
  const [report, setReport] = useState<HygieneAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "duplicates" | "domains" | "emails" | "disposable" | "stale">(
    "all"
  );
  const [isPurging, setIsPurging] = useState<string | null>(null);
  const [purgeSuccessMessage, setPurgeSuccessMessage] = useState<string | null>(null);
  const [_searchFilter, _setSearchFilter] = useState("");

  const fetchHygieneAudit = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hygiene/audit");
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error("Failed to run data hygiene audit:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHygieneAudit();
  }, [fetchHygieneAudit]);

  const handlePurge = async (purgeType: string, leadIds?: string[]) => {
    let confirmMsg = "Are you sure you want to execute this data hygiene purge?";
    if (purgeType === "purge_all_hygiene_issues") {
      confirmMsg =
        "Execute One-Click Smart Clean Sweep? This will deduplicate all duplicate email records (keeping highest ICP fit) and purge all invalid domains & malformed emails.";
    } else if (purgeType === "purge_duplicate_emails") {
      confirmMsg =
        "Purge duplicate emails? Redundant copies will be removed while preserving the highest-fit record for each contact.";
    } else if (purgeType === "purge_invalid_domains") {
      confirmMsg = "Purge all records with invalid or malformed company domains?";
    } else if (purgeType === "purge_invalid_emails") {
      confirmMsg = "Purge all records with malformed email syntax?";
    } else if (purgeType === "purge_disposable_emails") {
      confirmMsg = "Purge all disposable / dead MX mailboxes?";
    }

    if (!window.confirm(confirmMsg)) return;

    const reportLeadIds: Record<string, string[]> = {
      purge_all_hygiene_issues: [
        ...(report?.duplicateGroups.flatMap((group) => group.leadIds.slice(1)) || []),
        ...(report?.domainIssues.map((item) => item.leadId) || []),
        ...(report?.emailFormatIssues.map((item) => item.leadId) || []),
        ...(report?.disposableIssues.map((item) => item.leadId) || [])
      ],
      purge_duplicate_emails: report?.duplicateGroups.flatMap((group) => group.leadIds.slice(1)) || [],
      purge_invalid_domains: report?.domainIssues.map((item) => item.leadId) || [],
      purge_invalid_emails: report?.emailFormatIssues.map((item) => item.leadId) || [],
      purge_disposable_emails: report?.disposableIssues.map((item) => item.leadId) || []
    };
    const selectedLeadIds = [...new Set(leadIds || reportLeadIds[purgeType] || [])];
    if (selectedLeadIds.length === 0) {
      alert("No matching lead records are selected for this purge.");
      return;
    }

    try {
      setIsPurging(purgeType);
      const res = await fetch("/api/hygiene/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType: "selected_records", leadIds: selectedLeadIds })
      });

      const data = await res.json();
      if (data.success) {
        setPurgeSuccessMessage(
          `Hygiene purge complete: ${data.deletedCount} records purged. ${data.remainingCount} pristine leads remaining.`
        );
        await onRefreshData();
        await fetchHygieneAudit();
        setTimeout(() => setPurgeSuccessMessage(null), 6000);
      } else {
        alert(`Purge failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      alert(`Purge execution error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPurging(null);
    }
  };

  const summary = report?.summary;
  const healthScore = summary?.healthScore ?? 100;

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-400 border-emerald-500/40 bg-emerald-950/40";
    if (score >= 70) return "text-amber-400 border-amber-500/40 bg-amber-950/40";
    return "text-rose-400 border-rose-500/40 bg-rose-950/40";
  };

  return (
    <div className="space-y-6">
      {/* Header & Overview Card */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-5 sm:p-6 shadow-card-subtle">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e283d] pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-950 text-emerald-400 border border-emerald-800/80 rounded-2xl shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">Automated Pipeline Data Hygiene Engine</h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Continuous Telemetry Audit
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Scans your active pipeline for duplicate email addresses, malformed domain formats, disposable
                mailboxes, and stale records. Execute one-click automated deduplication and cleaning.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            <button
              type="button"
              onClick={fetchHygieneAudit}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-[#0a0d16] hover:bg-[#161f33] border border-[#1e283d] text-slate-300 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
              <span>Rescan Pipeline</span>
            </button>

            <button
              type="button"
              onClick={() => handlePurge("purge_all_hygiene_issues")}
              disabled={isPurging !== null || summary?.totalFlaggedIssues === 0}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950 text-white rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>
                {isPurging === "purge_all_hygiene_issues" ? "Purging Pipeline..." : "One-Click Smart Clean Sweep"}
              </span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {purgeSuccessMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-mono flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{purgeSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setPurgeSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top KPIs Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
          {/* Health Score */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${getHealthScoreColor(healthScore)}`}>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="uppercase tracking-wider text-[10px]">Hygiene Health</span>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-3xl font-mono font-bold tracking-tight">{healthScore}%</span>
              <span className="text-[10px] block opacity-80 mt-0.5 font-sans font-medium">
                {healthScore >= 90
                  ? "Pristine Deliverability"
                  : healthScore >= 70
                    ? "Moderate Hygiene Debt"
                    : "High Risk of Bounces"}
              </span>
            </div>
          </div>

          {/* Duplicates */}
          <div className="bg-[#0a0d16] border border-[#1e283d] p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider text-[10px]">Duplicate Emails</span>
              <Copy className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-mono font-bold text-white tabular-nums">
                {summary?.duplicateEmailsCount || 0}
              </span>
              <span className="text-[10px] text-indigo-400 block mt-0.5">
                {summary?.redundantDuplicatesCount || 0} redundant copies
              </span>
            </div>
          </div>

          {/* Invalid Domains */}
          <div className="bg-[#0a0d16] border border-[#1e283d] p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider text-[10px]">Malformed Domains</span>
              <Globe className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums">
                {summary?.invalidDomainCount || 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Missing TLD or invalid syntax</span>
            </div>
          </div>

          {/* Invalid Email Formats */}
          <div className="bg-[#0a0d16] border border-[#1e283d] p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider text-[10px]">Invalid Email Syntax</span>
              <Mail className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-mono font-bold text-rose-400 tabular-nums">
                {summary?.invalidEmailFormatCount || 0}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Syntax / RFC non-compliant</span>
            </div>
          </div>

          {/* Disposable / Risky */}
          <div className="bg-[#0a0d16] border border-[#1e283d] p-4 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="uppercase tracking-wider text-[10px]">Disposable / Zero Fit</span>
              <AlertTriangle className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-mono font-bold text-purple-300 tabular-nums">
                {(summary?.disposableOrInvalidCount || 0) + (summary?.staleZeroFitCount || 0)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Low-quality or temp mailboxes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Diagnostic Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f1523] border border-[#1e283d] rounded-2xl p-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Diagnostic Issues ({summary?.totalFlaggedIssues || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("duplicates")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1 ${
              activeTab === "duplicates" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate Emails ({summary?.duplicateEmailsCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("domains")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1 ${
              activeTab === "domains" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Invalid Domains ({summary?.invalidDomainCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("emails")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1 ${
              activeTab === "emails" ? "bg-rose-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Malformed Emails ({summary?.invalidEmailFormatCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("disposable")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center space-x-1 ${
              activeTab === "disposable" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Disposable ({summary?.disposableOrInvalidCount || 0})</span>
          </button>
        </div>

        {/* Quick Purge Target Button */}
        {activeTab === "duplicates" && (summary?.duplicateEmailsCount || 0) > 0 && (
          <button
            type="button"
            onClick={() => handlePurge("purge_duplicate_emails")}
            disabled={isPurging !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Redundant Duplicates</span>
          </button>
        )}

        {activeTab === "domains" && (summary?.invalidDomainCount || 0) > 0 && (
          <button
            type="button"
            onClick={() => handlePurge("purge_invalid_domains")}
            disabled={isPurging !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Invalid Domains</span>
          </button>
        )}

        {activeTab === "emails" && (summary?.invalidEmailFormatCount || 0) > 0 && (
          <button
            type="button"
            onClick={() => handlePurge("purge_invalid_emails")}
            disabled={isPurging !== null}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Malformed Emails</span>
          </button>
        )}
      </div>

      {/* Main Diagnostic Data List */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-5 shadow-card-subtle space-y-4">
        {summary?.totalFlaggedIssues === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center mx-auto text-emerald-400">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Pipeline Data Hygiene is 100% Pristine</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No duplicate email addresses, malformed company domains, or disposable addresses were detected across all{" "}
              {leads.length} leads.
            </p>
            <button
              type="button"
              onClick={onNavigateToLeads}
              className="mt-2 inline-flex items-center space-x-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800 px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <span>Back to Leads Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Duplicates Section */}
            {(activeTab === "all" || activeTab === "duplicates") && report && report.duplicateGroups.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-1.5">
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate Email Groups ({report.duplicateGroups.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Auto-merging will retain the record with highest ICP Fit Score
                  </span>
                </div>

                <div className="space-y-2">
                  {report.duplicateGroups.map((group) => (
                    <div key={group.email} className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3.5 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e283d]/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-white">{group.email}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {group.count} occurrences
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurge("purge_duplicate_emails", group.leadIds.slice(1))}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition cursor-pointer self-start sm:self-auto"
                        >
                          Keep Best & Purge ({group.count - 1}) Redundant
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {group.leads.map((l, lIdx) => (
                          <div
                            key={l.id}
                            className="bg-[#0f1523] border border-[#1e283d] rounded-lg p-2.5 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-semibold text-slate-200 truncate">
                                {l.firstName} {l.lastName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {l.companyName} • {l.jobTitle}
                              </p>
                            </div>
                            <div className="text-right shrink-0 pl-2">
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${lIdx === 0 ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-slate-800 text-slate-300"}`}
                              >
                                Score: {l.fitScore}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Malformed Domains Section */}
            {(activeTab === "all" || activeTab === "domains") && report && report.domainIssues.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Malformed or Placeholder Domains ({report.domainIssues.length})</span>
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e283d] text-slate-400 font-mono text-[10px]">
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3">Flagged Domain</th>
                        <th className="py-2 px-3">Contact Email</th>
                        <th className="py-2 px-3">Diagnostic Reason</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e283d]/60 font-mono text-[11px]">
                      {report.domainIssues.map((item) => (
                        <tr key={item.leadId} className="hover:bg-[#0a0d16]/50">
                          <td className="py-2 px-3 text-white font-semibold font-sans">{item.companyName}</td>
                          <td className="py-2 px-3 text-amber-400">{item.domain}</td>
                          <td className="py-2 px-3 text-slate-400">{item.email}</td>
                          <td className="py-2 px-3 text-rose-300 font-sans text-[11px]">{item.reason}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePurge("purge_invalid_domains", [item.leadId])}
                              className="text-rose-400 hover:text-rose-300 font-sans font-bold cursor-pointer text-xs"
                            >
                              Purge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Malformed Email Formats */}
            {(activeTab === "all" || activeTab === "emails") && report && report.emailFormatIssues.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Malformed Email Formats ({report.emailFormatIssues.length})</span>
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e283d] text-slate-400 font-mono text-[10px]">
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3">Flagged Email</th>
                        <th className="py-2 px-3">Diagnostic Reason</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e283d]/60 font-mono text-[11px]">
                      {report.emailFormatIssues.map((item) => (
                        <tr key={item.leadId} className="hover:bg-[#0a0d16]/50">
                          <td className="py-2 px-3 text-white font-semibold font-sans">{item.companyName}</td>
                          <td className="py-2 px-3 text-rose-400">{item.email || "EMPTY"}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans">{item.reason}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePurge("purge_invalid_emails", [item.leadId])}
                              className="text-rose-400 hover:text-rose-300 font-sans font-bold cursor-pointer text-xs"
                            >
                              Purge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Disposable Mailboxes */}
            {(activeTab === "all" || activeTab === "disposable") && report && report.disposableIssues.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Disposable Mailboxes / Dead MX Records ({report.disposableIssues.length})</span>
                  </h4>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#1e283d] text-slate-400 font-mono text-[10px]">
                        <th className="py-2 px-3">Company</th>
                        <th className="py-2 px-3">Email Address</th>
                        <th className="py-2 px-3">Company Domain</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e283d]/60 font-mono text-[11px]">
                      {report.disposableIssues.map((item) => (
                        <tr key={item.leadId} className="hover:bg-[#0a0d16]/50">
                          <td className="py-2 px-3 text-white font-semibold font-sans">{item.companyName}</td>
                          <td className="py-2 px-3 text-purple-300">{item.email}</td>
                          <td className="py-2 px-3 text-slate-400">{item.domain}</td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePurge("purge_disposable_emails", [item.leadId])}
                              className="text-rose-400 hover:text-rose-300 font-sans font-bold cursor-pointer text-xs"
                            >
                              Purge
                            </button>
                          </td>
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
    </div>
  );
};
