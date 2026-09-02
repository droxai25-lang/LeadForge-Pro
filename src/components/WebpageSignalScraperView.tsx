import type React from "react";
import { useState } from "react";
import {
  Globe,
  Search,
  Sparkles,
  ShieldCheck,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Mail,
  Zap
} from "lucide-react";

export interface SignalHook {
  hookType: string;
  headline: string;
  emailOpeningSnippet: string;
}

export interface SignalExtractionResult {
  targetUrl: string;
  domain: string;
  scrapedAt: string;
  evidenceId: string;
  snapshotSha256: string;
  snapshotTruncated: boolean;
  analysisStatus: "not_requested" | "completed" | "failed";
  meta: { title: string; description: string; h1Tags: string[]; h2Tags: string[] };
  detectedTechStack: Array<{ category: string; name: string; confidence: number; evidence: string }>;
  securityPosture: { usesHttps: boolean; hasHsts: boolean; contentSecurityPolicy: boolean; serverBanner: string };
  painPointsIdentified: string[];
  recentCompanySignals: string[];
  suggestedPersonalizedHooks: SignalHook[];
}

interface WebpageSignalScraperViewProps {
  onApplyHookToDraft?: (snippet: string) => void;
  onLeadCreated?: (lead: Record<string, unknown>) => void;
  onNavigateToLeads?: () => void;
  onNavigateToDiscovery?: () => void;
}

export const WebpageSignalScraperView: React.FC<WebpageSignalScraperViewProps> = ({
  onApplyHookToDraft,
  onLeadCreated,
  onNavigateToLeads,
  onNavigateToDiscovery
}) => {
  const [domainInput, setDomainInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SignalExtractionResult | null>(null);
  const [createLeadEnabled, setCreateLeadEnabled] = useState(false);
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactJobTitle, setContactJobTitle] = useState("");
  const [createdLead, setCreatedLead] = useState<Record<string, unknown> | null>(null);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkReport, setBulkReport] = useState<
    Array<{ domain: string; created: boolean; email?: string; error?: string }>
  >([]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) return;
    if (createLeadEnabled && (!contactFirstName.trim() || !contactJobTitle.trim())) {
      setErrorMsg(
        "First name and job title are required before creating a contact. LeadForge will not invent either value."
      );
      return;
    }
    setIsScraping(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/signals/scrape-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domainInput.trim(),
          createLead: createLeadEnabled,
          firstName: contactFirstName.trim(),
          lastName: contactLastName.trim(),
          jobTitle: contactJobTitle.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.message || "Failed to scrape domain signals");
      setResult(data.signals);
      if (data.lead) {
        setCreatedLead(data.lead);
        onLeadCreated?.(data.lead);
      } else if (createLeadEnabled)
        setErrorMsg(
          "No verifiable contact could be resolved on this domain via live SMTP probing. No fabricated lead was created."
        );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to scrape domain signals");
    } finally {
      setIsScraping(false);
    }
  };

  // Bulk mode: each non-empty line is  domain,FirstName,LastName,JobTitle
  // Scrapes and resolves a candidate mailbox for each explicitly named contact.
  // Nothing is fabricated: incomplete or unresolved rows are reported as errors.
  const handleBulkScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setIsBulkRunning(true);
    setBulkReport([]);
    setErrorMsg(null);
    for (const line of lines) {
      const [domainPart, first, last, title] = line.split(",").map((s) => (s || "").trim());
      const domain = (domainPart || "")
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0];
      if (!domain) continue;
      if (!first || !title) {
        setBulkReport((prev) => [
          ...prev,
          {
            domain,
            created: false,
            error: "first name and job title are required; no values were invented"
          }
        ]);
        continue;
      }
      try {
        const res = await fetch("/api/signals/scrape-domain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain,
            createLead: true,
            firstName: first,
            lastName: last || "",
            jobTitle: title
          })
        });
        const data = await res.json();
        if (data.lead) {
          setBulkReport((prev) => [...prev, { domain, created: true, email: data.lead.email }]);
          onLeadCreated?.(data.lead);
        } else {
          setBulkReport((prev) => [
            ...prev,
            { domain, created: false, error: data.error || data.message || "no verifiable contact" }
          ]);
        }
      } catch (err: unknown) {
        setBulkReport((prev) => [
          ...prev,
          { domain, created: false, error: err instanceof Error ? err.message : String(err) }
        ]);
      }
    }
    setIsBulkRunning(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-20">
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-br from-sky-600 to-indigo-700 text-white rounded-2xl shadow-lg shadow-sky-600/25 border border-sky-400/20">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-tight">Webpage Signal Scraper</h2>
              <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-mono font-bold">
                Live DOM Extraction
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Point at any real web domain to live-extract its tech stack, security posture, and AI-personalized
              outreach hooks — no fabricated data.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-xl border border-indigo-900/60 bg-indigo-950/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold text-indigo-200">Start with the niche, not the domain</p>
            <p className="mt-1 text-[11px] text-slate-400">
              Autonomous discovery finds the businesses, resolves their real websites, and researches each one.
              Use this exact-domain tool only when you already know the company you want to inspect.
            </p>
          </div>
          {onNavigateToDiscovery && (
            <button
              type="button"
              onClick={onNavigateToDiscovery}
              className="shrink-0 rounded-xl border border-indigo-500/50 bg-indigo-600/20 px-4 py-2 text-xs font-bold text-indigo-200 transition hover:bg-indigo-600/40"
            >
              Find opportunities from a niche →
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleScrape} className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 space-y-3">
        <label htmlFor="signal-scraper-domain" className="block text-xs font-semibold text-slate-300">
          Target Company Domain
        </label>
        <div className="flex gap-2">
          <input
            id="signal-scraper-domain"
            type="text"
            placeholder="e.g. stripe.com, linear.app"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            className="flex-1 text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
            required
          />
          <button
            type="submit"
            disabled={isScraping || !domainInput.trim()}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/50 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition shadow-lg shadow-sky-600/25 cursor-pointer"
          >
            {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{isScraping ? "Scraping..." : "Scrape Live Signals"}</span>
          </button>
        </div>
        {errorMsg && (
          <p className="text-xs text-rose-400 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{errorMsg}</span>
          </p>
        )}

        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={createLeadEnabled}
            onChange={(e) => setCreateLeadEnabled(e.target.checked)}
            className="accent-sky-500"
          />
          <span>Create a real lead for this company (live SMTP email resolution)</span>
        </label>

        {createLeadEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <input
              type="text"
              placeholder="Contact first name (required, e.g. Patrick)"
              value={contactFirstName}
              onChange={(e) => setContactFirstName(e.target.value)}
              className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Last name"
              value={contactLastName}
              onChange={(e) => setContactLastName(e.target.value)}
              className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <input
              type="text"
              placeholder="Job title (required when creating a lead)"
              value={contactJobTitle}
              onChange={(e) => setContactJobTitle(e.target.value)}
              className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        {createdLead && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-3">
            <span>
              <strong>Lead created:</strong> {String(createdLead.firstName)} {String(createdLead.lastName || "")} ·{" "}
              {String(createdLead.email)} · {String(createdLead.companyName || "")} [{String(createdLead.stage)}]
            </span>
            <button
              type="button"
              className="font-bold text-emerald-200 hover:text-white underline shrink-0 cursor-pointer"
              onClick={() => {
                if (onNavigateToLeads) onNavigateToLeads();
                else window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              View in Lead Pipeline
            </button>
          </div>
        )}
      </form>

      {/* Bulk scraper: turn a list of real domains into verified leads */}
      <form onSubmit={handleBulkScrape} className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Bulk Scrape &amp; Generate Leads</span>
          </h4>
          <span className="text-[10px] font-mono text-slate-500">one per line: domain,First,Last,JobTitle</span>
        </div>
        <textarea
          rows={4}
          placeholder={"company.example,Avery,Chen,VP Sales\nsecond.example,Jordan,Lee,Founder"}
          value={bulkInput}
          onChange={(e) => setBulkInput(e.target.value)}
          className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
        />
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={isBulkRunning || !bulkInput.trim()}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900/50 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
          >
            {isBulkRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            <span>{isBulkRunning ? "Scraping & Resolving..." : "Generate Leads (live SMTP verification)"}</span>
          </button>
          {onNavigateToLeads && bulkReport.length > 0 && (
            <button
              type="button"
              onClick={onNavigateToLeads}
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
            >
              View results in Lead Pipeline →
            </button>
          )}
        </div>

        {bulkReport.length > 0 && (
          <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3 max-h-52 overflow-y-auto space-y-1.5 text-[11px] font-mono">
            {bulkReport.map((r) => (
              <div
                key={`${r.domain}-${r.email || r.error || "unknown"}`}
                className={`flex items-center gap-2 ${r.created ? "text-emerald-300" : "text-rose-300"}`}
              >
                <span className={r.created ? "text-emerald-400" : "text-rose-400"}>{r.created ? "✓" : "✗"}</span>
                <span className="text-slate-300">{r.domain}</span>
                <span className="text-slate-500 truncate">{r.created ? r.email : r.error}</span>
              </div>
            ))}
            <div className="border-t border-[#1e283d] pt-1.5 text-slate-400 font-sans">
              {bulkReport.filter((r) => r.created).length} created · {bulkReport.filter((r) => !r.created).length}{" "}
              unresolved (no fabricated data)
            </div>
          </div>
        )}
      </form>

      {result && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">{result.meta.title}</h3>
                <a
                  href={result.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 flex items-center gap-1 mt-1 hover:underline"
                >
                  {result.targetUrl} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {new Date(result.scrapedAt).toLocaleString()}
              </span>
            </div>
            {result.meta.description && <p className="text-xs text-slate-300">{result.meta.description}</p>}
            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="rounded border border-emerald-900 bg-emerald-950/50 px-2 py-1 text-emerald-300">
                Evidence {result.evidenceId.slice(0, 8)}
              </span>
              <span
                className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-slate-400"
                title={result.snapshotSha256}
              >
                SHA-256 {result.snapshotSha256.slice(0, 12)}…
              </span>
              {result.snapshotTruncated && (
                <span className="rounded border border-amber-900 bg-amber-950/50 px-2 py-1 text-amber-300">
                  Snapshot capped at 512 KiB
                </span>
              )}
            </div>
          </div>

          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detected Tech Stack</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.detectedTechStack.map((t) => (
                <div key={`${t.category}-${t.name}`} className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.category}</p>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-[11px] font-mono text-emerald-400">{t.confidence}% confidence</p>
                  <p className="mt-1 text-[10px] text-slate-500">{t.evidence}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Live Security Posture</h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-500">HTTPS</p>
                <CheckCircle2 className="w-5 h-5 mx-auto mt-1 text-emerald-400" />
              </div>
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-500">HSTS</p>
                {result.securityPosture.hasHsts ? (
                  <CheckCircle2 className="w-5 h-5 mx-auto mt-1 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 mx-auto mt-1 text-amber-400" />
                )}
              </div>
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-500">Content-Security</p>
                {result.securityPosture.contentSecurityPolicy ? (
                  <CheckCircle2 className="w-5 h-5 mx-auto mt-1 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 mx-auto mt-1 text-amber-400" />
                )}
              </div>
              <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3 text-center">
                <p className="text-[10px] text-slate-500">Server</p>
                <p className="text-xs font-mono text-slate-300 mt-1">{result.securityPosture.serverBanner}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Personalized Outreach Hooks</h4>
            </div>
            <div className="space-y-3">
              {result.analysisStatus !== "completed" && (
                <p className="rounded-xl border border-slate-800 bg-[#0a0d16] p-3 text-xs text-slate-400">
                  {result.analysisStatus === "failed"
                    ? "AI analysis failed. The source snapshot and deterministic DOM evidence were still saved."
                    : "AI analysis is not configured. The source snapshot and deterministic DOM evidence were saved without generated claims."}
                </p>
              )}
              {result.suggestedPersonalizedHooks.map((hook) => (
                <div
                  key={`${hook.hookType}-${hook.headline}-${hook.emailOpeningSnippet}`}
                  className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{hook.headline}</p>
                    <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 text-[9px] font-mono font-bold uppercase">
                      {hook.hookType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 italic">"{hook.emailOpeningSnippet}"</p>
                  {onApplyHookToDraft && (
                    <button
                      type="button"
                      onClick={() => onApplyHookToDraft(hook.emailOpeningSnippet)}
                      className="flex items-center space-x-1.5 text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Apply to campaign draft</span>
                    </button>
                  )}
                  <p className="text-[10px] font-mono text-slate-600">Source evidence: {result.evidenceId}</p>
                </div>
              ))}
            </div>
          </div>

          {(result.painPointsIdentified.length > 0 || result.recentCompanySignals.length > 0) && (
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Activity className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Signals &amp; Pain Points</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Pain Points Identified
                  </p>
                  <ul className="space-y-1.5">
                    {result.painPointsIdentified.map((p) => (
                      <li key={p} className="text-xs text-slate-300 flex gap-1.5">
                        <span className="text-amber-400">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Recent Company Signals
                  </p>
                  <ul className="space-y-1.5">
                    {result.recentCompanySignals.map((s) => (
                      <li key={s} className="text-xs text-slate-300 flex gap-1.5">
                        <span className="text-sky-400">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
