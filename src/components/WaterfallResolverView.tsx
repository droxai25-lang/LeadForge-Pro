import type React from "react";
import { useState } from "react";
import type { Lead } from "../types";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck,
  ShieldAlert,
  Server,
  Zap,
  RefreshCw,
  Layers
} from "lucide-react";

export interface EmailPermutationCandidate {
  email: string;
  pattern: string;
  isValidSyntax: boolean;
  isCatchAll: boolean;
  smtpAccepted: boolean;
  confidenceScore: number;
  status: "mailbox_accepted" | "risky_catch_all" | "invalid" | "unverified";
  mxHost: string;
  latencyMs: number;
}

export interface WaterfallResolutionResult {
  success: boolean;
  domain: string;
  isCatchAllDomain: boolean;
  mxHosts: string[];
  bestCandidate: EmailPermutationCandidate | null;
  testedCandidates: EmailPermutationCandidate[];
  createdLead?: Lead;
}

interface WaterfallResolverProps {
  onLeadImported?: (lead: Lead) => void;
}

export const WaterfallResolverView: React.FC<WaterfallResolverProps> = ({ onLeadImported }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [autoCreateLead, setAutoCreateLead] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionResult, setResolutionResult] = useState<WaterfallResolutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !domain.trim()) {
      setErrorMessage("First Name and Corporate Domain are strictly required.");
      return;
    }
    if (autoCreateLead && !jobTitle.trim()) {
      setErrorMessage("Job title is required to create a lead. LeadForge will not invent one.");
      return;
    }

    setIsResolving(true);
    setErrorMessage(null);
    setResolutionResult(null);

    try {
      const response = await fetch("/api/waterfall/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          domain: domain.trim(),
          jobTitle: jobTitle.trim(),
          createLead: autoCreateLead
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed running waterfall email resolution");
      }

      setResolutionResult(data);
      if (data.createdLead && onLeadImported) {
        onLeadImported(data.createdLead);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during deep socket resolution."
      );
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadge = (status: EmailPermutationCandidate["status"]) => {
    switch (status) {
      case "mailbox_accepted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            SMTP Accepted (Identity Unconfirmed)
          </span>
        );
      case "risky_catch_all":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Catch-All Server
          </span>
        );
      case "invalid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Mailbox Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            Unverified
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="w-3.5 h-3.5" />
              Module 2 Engine
            </div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Waterfall Permutation & Catch-All Prober
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl">
              Zero-credit email discovery pipeline. Generates multi-pattern permutations, probes target MX socket
              handshakes directly via low-level RCPT TO verification, and isolates Catch-All domains.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 px-3.5 py-2 rounded-xl">
            <Server className="w-4 h-4 text-emerald-400" />
            <span>Port 25 Direct Handshake Active</span>
          </div>
        </div>
      </div>

      {/* Input Configuration & Search Form */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <form onSubmit={handleResolve} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="resolver-first-name" className="block text-xs font-medium text-slate-400 mb-1.5">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="resolver-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Satya"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="resolver-last-name" className="block text-xs font-medium text-slate-400 mb-1.5">
                Last Name
              </label>
              <input
                id="resolver-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Nadella"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="resolver-company-domain" className="block text-xs font-medium text-slate-400 mb-1.5">
                Company Domain <span className="text-rose-400">*</span>
              </label>
              <input
                id="resolver-company-domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. microsoft.com"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label htmlFor="resolver-job-title" className="block text-xs font-medium text-slate-400 mb-1.5">
                Job Title
              </label>
              <input
                id="resolver-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Chief Executive Officer"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-slate-800/60">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoCreateLead}
                onChange={(e) => setAutoCreateLead(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span>Automatically persist verified prospect into PostgreSQL pipeline</span>
            </label>

            <button
              type="submit"
              disabled={isResolving || !firstName.trim() || !domain.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isResolving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Probing Socket Sequences...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-white" />
                  <span>Execute Waterfall Prober</span>
                </>
              )}
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Resolution Results Cockpit */}
      {resolutionResult && (
        <div className="space-y-6">
          {/* Best Match Hero Card */}
          {resolutionResult.bestCandidate ? (
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Primary Discovered Target
                    </span>
                    {getStatusBadge(resolutionResult.bestCandidate.status)}
                    {resolutionResult.isCatchAllDomain && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <ShieldAlert className="w-3 h-3" />
                        Catch-All Domain
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl font-black text-slate-100 font-mono tracking-tight">
                    {resolutionResult.bestCandidate.email}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                    <span>
                      Pattern:{" "}
                      <strong className="text-slate-200 font-mono">{resolutionResult.bestCandidate.pattern}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      MX Node:{" "}
                      <strong className="text-slate-200 font-mono">{resolutionResult.bestCandidate.mxHost}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Socket Latency:{" "}
                      <strong className="text-emerald-400 font-mono">
                        {resolutionResult.bestCandidate.latencyMs}ms
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 bg-slate-950/80 border border-slate-800 p-4 rounded-xl">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Confidence Score</div>
                    <div className="text-2xl font-black text-indigo-400">
                      {resolutionResult.bestCandidate.confidenceScore}%
                    </div>
                  </div>

                  {resolutionResult.createdLead && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 font-medium">
                      <UserCheck className="w-4 h-4" />
                      <span>Saved in PostgreSQL</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2">
              <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-rose-300">Zero Acceptable Permutations Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Target server rejected all standard corporate email permutations or port 25 was unresponsive.
              </p>
            </div>
          )}

          {/* Permutations Cascade Roster Table */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Tested Waterfall Permutation Cascade</span>
                <span className="text-slate-500 font-normal">
                  ({resolutionResult.testedCandidates.length} patterns evaluated)
                </span>
              </div>

              <div className="text-xs text-slate-400 font-mono">Domain: {resolutionResult.domain}</div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-4 font-semibold">Candidate Email</th>
                    <th className="py-3 px-4 font-semibold">Deduction Pattern</th>
                    <th className="py-3 px-4 font-semibold">SMTP Handshake</th>
                    <th className="py-3 px-4 font-semibold">Confidence</th>
                    <th className="py-3 px-4 font-semibold">Verification Verdict</th>
                    <th className="py-3 px-4 font-semibold text-right">Socket Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {resolutionResult.testedCandidates.map((candidate) => (
                    <tr
                      key={`${candidate.email}-${candidate.pattern}`}
                      className={`hover:bg-slate-800/30 transition ${
                        candidate.email === resolutionResult.bestCandidate?.email ? "bg-indigo-500/5" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-200">{candidate.email}</td>
                      <td className="py-3.5 px-4 text-slate-400">{candidate.pattern}</td>
                      <td className="py-3.5 px-4">
                        {candidate.smtpAccepted ? (
                          <span className="text-emerald-400 font-semibold">250 RCPT OK</span>
                        ) : (
                          <span className="text-rose-400">550 Rejected</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                candidate.confidenceScore >= 80
                                  ? "bg-emerald-500"
                                  : candidate.confidenceScore >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${candidate.confidenceScore}%` }}
                            />
                          </div>
                          <span className="text-slate-300 font-semibold">{candidate.confidenceScore}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">{getStatusBadge(candidate.status)}</td>
                      <td className="py-3.5 px-4 text-right text-slate-400">{candidate.latencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
