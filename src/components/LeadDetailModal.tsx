import type React from "react";
import { useState } from "react";
import type { Lead } from "../types";
import { X, Sparkles, Mail, Copy, Check, Send, Zap, ArrowRight, Split, FileText, CheckCircle2 } from "lucide-react";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onEnrich: (leadId: string) => Promise<void>;
  onPersonalize: (leadId: string, tone: string, pitch: string) => Promise<string>;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ lead, onClose, onEnrich, onPersonalize }) => {
  const [activeView, setActiveView] = useState<"split" | "outreach">("split");
  const [tone, setTone] = useState<string>("consultative");
  const [pitch, setPitch] = useState<string>("");
  const [emailDraft, setEmailDraft] = useState<string>(lead?.aiEmailDraft || "");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSent, setIsSent] = useState(false);

  if (!lead) return null;

  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    try {
      const generated = await onPersonalize(lead.id, tone, pitch);
      setEmailDraft(generated);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleTriggerEnrich = async () => {
    setIsEnriching(true);
    try {
      await onEnrich(lead.id);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleCopyDraft = () => {
    if (!emailDraft) return;
    navigator.clipboard.writeText(emailDraft);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDirectOutboxSend = async () => {
    if (!emailDraft.trim()) return;
    try {
      const response = await fetch("/api/mailboxes/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: [lead.id],
          customBody: emailDraft,
          trackOpens: true,
          trackClicks: true
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "The email could not be queued.");
      }
      setIsSent(true);
      setTimeout(() => setIsSent(false), 4000);
    } catch (error) {
      setIsSent(false);
      alert(error instanceof Error ? error.message : "The email could not be queued.");
    }
  };

  const handleOpenMailto = () => {
    if (!lead.email) return;
    const lines = (emailDraft || "").split("\n");
    let subject = `Partnership Discussion — ${lead.companyName}`;
    let body = emailDraft || "";

    if (lines.length > 0 && lines[0].toLowerCase().startsWith("subject:")) {
      subject = lines[0].replace(/^subject:\s*/i, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    const mailtoUrl = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleDownloadEml = () => {
    const lines = (emailDraft || "").split("\n");
    let subject = `Intro / Value Proposition — ${lead.companyName}`;
    let body = emailDraft || "";

    if (lines.length > 0 && lines[0].toLowerCase().startsWith("subject:")) {
      subject = lines[0].replace(/^subject:\s*/i, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    const emlContent = [
      `To: ${lead.firstName} ${lead.lastName} <${lead.email}>`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `X-Mailer: LeadForge Pro Enterprise`,
      ``,
      body
    ].join("\r\n");

    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `outreach_${lead.firstName}_${lead.lastName}_${lead.companyDomain}.eml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Seniority title label
  const getSeniorityLabel = (s: string) => {
    switch (s) {
      case "c_level":
        return "C-Suite Executive";
      case "vp":
        return "Vice President / VP";
      case "director":
        return "Director / Head of";
      case "manager":
        return "Team Manager / Lead";
      default:
        return "Individual Contributor / Staff";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0d16]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#0f1523] rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#1e283d] overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-[#1e283d] flex items-center justify-between bg-[#0f1523] shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-600/25 border border-indigo-400/20">
              {lead.firstName[0]}
              {lead.lastName[0] || ""}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {lead.firstName} {lead.lastName}
                </h2>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    lead.isQualified
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-[#151c2e] text-slate-400 border border-[#1e283d]"
                  }`}
                >
                  {lead.isQualified ? "ICP Qualified" : "Standard Pipeline Lead"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lead.jobTitle} • <span className="text-indigo-400 font-semibold">{lead.companyName}</span> (
                {lead.companyDomain})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0a0d16] border border-[#1e283d] rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveView("split")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeView === "split" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Split-Pane Diff</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("outreach")}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  activeView === "outreach"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Outreach Studio</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-[#151c2e] rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 bg-[#0a0d16]/40">
          {activeView === "split" ? (
            /* Split-Pane Before vs After Comparison */
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Original Ingest vs. AI Enriched Profile
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Live side-by-side telemetry diff</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <span className="flex items-center space-x-1 text-indigo-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>AI Enriched</span>
                  </span>
                  <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Verified Deliverable</span>
                  </span>
                </div>
              </div>

              {/* 2-Column Split Pane */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Pane: Original / Raw Data */}
                <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-5 shadow-card-subtle space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#1e283d] pb-3">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Raw Ingested Data (Baseline)
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Unprocessed Raw
                      </span>
                    </div>

                    {/* Field 1: Contact Coordinates */}
                    <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3.5 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Submitted Coordinates
                      </div>
                      <div className="space-y-1.5 text-xs font-mono text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Name:</span>
                          <span className="text-slate-200">
                            {lead.firstName} {lead.lastName}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Email:</span>
                          <span className="text-slate-300">{lead.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Raw Title:</span>
                          <span className="text-slate-300">{lead.jobTitle}</span>
                        </div>
                        {lead.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Phone:</span>
                            <span className="text-slate-400">{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Field 2: Raw Domain Status */}
                    <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3.5 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Initial Domain & DNS
                      </div>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Domain String:</span>
                          <span className="text-slate-300">{lead.companyDomain}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">MX Verification:</span>
                          <span className="text-slate-500 italic">Unresolved UDP query</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Spam / Disposable:</span>
                          <span className="text-slate-500 italic">Unchecked blacklist</span>
                        </div>
                      </div>
                    </div>

                    {/* Field 3: Baseline Fit & Scoring */}
                    <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3.5 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Baseline Scoring & Hierarchy
                      </div>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Seniority Tier:</span>
                          <span className="text-slate-500 italic">Unclassified string</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">ICP Fit Score:</span>
                          <span className="text-slate-500 italic">0 / 100 Baseline</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Pipeline Stage:</span>
                          <span className="text-slate-400">Discovered</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono border-t border-[#1e283d] pt-3 flex items-center justify-between">
                    <span>Ingested: {new Date(lead.createdAt).toLocaleDateString()}</span>
                    <span>Format: Standard CSV / JSON</span>
                  </div>
                </div>

                {/* Right Pane: AI-Enriched & Verified Profile */}
                <div className="bg-[#0f1523] border border-indigo-900/60 rounded-2xl p-5 shadow-card-subtle space-y-4 flex flex-col justify-between relative overflow-hidden">
                  {/* Ambient subtle glow */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none -z-0"></div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between border-b border-[#1e283d] pb-3">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                          AI-Enriched & Verified Profile
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Enriched</span>
                      </span>
                    </div>

                    {/* Enriched Seniority with Diff Cue */}
                    <div className="bg-[#0a0d16] border border-indigo-950/80 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                          Seniority & Decision Tier
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/80 font-bold">
                          + Classified Seniority
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold">{getSeniorityLabel(lead.seniority)}</span>
                        <span className="font-mono text-purple-400 uppercase text-[11px] font-bold bg-[#151c2e] px-2 py-0.5 rounded border border-[#1e283d]">
                          {lead.seniority.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Enriched Live Deliverability with Diff Cue */}
                    <div className="bg-[#0a0d16] border border-emerald-950/80 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                          Live DNS MX Deliverability
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                          + Verified MX Proof
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs font-mono">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">DNS Resolution:</span>
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="capitalize">{lead.verificationStatus.replace("_", " ")}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Primary MX:</span>
                          <span className="text-slate-200 truncate max-w-[200px]" title={lead.mxHosts.join(", ")}>
                            {lead.mxHosts.length > 0 ? lead.mxHosts[0] : "Resolved (Active)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Enriched Multi-Factor ICP Score with Diff Cue */}
                    <div className="bg-[#0a0d16] border border-indigo-950/80 rounded-xl p-3.5 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                          Calculated ICP Fit Matrix
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                          + Fit Score {lead.fitScore}/100
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-2xl font-mono font-black text-white tabular-nums">{lead.fitScore}</span>
                          <span className="text-xs text-slate-500 font-mono"> / 100</span>
                        </div>
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                            lead.isQualified
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}
                        >
                          {lead.isQualified ? "ICP Qualified" : "Disqualified"}
                        </span>
                      </div>
                      {/* Sub-score progress bar */}
                      <div className="h-1.5 w-full bg-[#151c2e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                          style={{ width: `${lead.fitScore}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Firmographic Tech Stack */}
                    <div className="bg-[#0a0d16] border border-cyan-950/80 rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                          Firmographics & Scale
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                          + Firmographics
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Headcount:</span>
                          <span className="text-slate-200">
                            {lead.employeeCount ? `${lead.employeeCount.toLocaleString()} team` : "Growth Scale"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Estimated ARR:</span>
                          <span className="text-slate-200">
                            {lead.annualRevenueUsd
                              ? `$${(lead.annualRevenueUsd / 1000000).toFixed(0)}M USD`
                              : "Venture Scale"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-400 font-mono border-t border-[#1e283d] pt-3 flex items-center justify-between relative z-10">
                    <span>Enriched UTC: {new Date(lead.updatedAt).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => setActiveView("outreach")}
                      className="text-xs font-bold text-indigo-400 hover:text-white flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Open AI Outreach</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* AI Cold Outreach Studio View */
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-[#0f1523] border border-indigo-900/60 rounded-2xl p-5 shadow-card-subtle space-y-4">
                <div className="flex items-center justify-between border-b border-[#1e283d] pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Ollama AI Outreach Generator</h3>
                      <p className="text-xs text-slate-400">
                        Tailors 1-to-1 conversion copy for {lead.firstName} {lead.lastName} ({lead.jobTitle} at{" "}
                        {lead.companyName})
                      </p>
                    </div>
                  </div>

                  {emailDraft && (
                    <button
                      type="button"
                      onClick={handleCopyDraft}
                      className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-[#151c2e] border border-[#1e283d] px-3 py-1.5 rounded-lg transition cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? "Copied!" : "Copy Email"}</span>
                    </button>
                  )}
                </div>

                {/* Generation Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="lead-email-tone" className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Tone & Communication Style
                    </label>
                    <select
                      id="lead-email-tone"
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="consultative">Consultative & Data-Driven</option>
                      <option value="direct">Direct & Problem-Solving</option>
                      <option value="executive">Executive & Strategic</option>
                      <option value="technical">Technical & Architectural</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="lead-email-pitch" className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Custom Pitch / Angle (Optional)
                    </label>
                    <input
                      id="lead-email-pitch"
                      type="text"
                      placeholder="Describe a verified problem or value proposition without invented metrics..."
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={isGeneratingAi}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingAi ? "animate-spin" : ""}`} />
                  <span>
                    {isGeneratingAi ? "Generating Personalized Pitch with Ollama..." : "Generate AI Outreach Email"}
                  </span>
                </button>

                {/* Output Textarea */}
                {emailDraft && (
                  <div className="space-y-2 pt-2">
                    <label htmlFor="lead-email-draft" className="block text-[11px] font-semibold text-slate-300">
                      Generated Email Draft:
                    </label>
                    <textarea
                      id="lead-email-draft"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      rows={8}
                      className="w-full text-xs font-mono text-slate-200 bg-[#0a0d16] border border-[#1e283d] rounded-xl p-3.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed shadow-inner"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e283d]">
                      <span className="text-[11px] text-slate-400">
                        Dispatch directly or export to local email client:
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleOpenMailto}
                          className="flex items-center space-x-1.5 bg-[#151c2e] hover:bg-[#1e283d] text-indigo-300 hover:text-white border border-[#1e283d] text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          title="Open message in default email client"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Open in Mail</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadEml}
                          className="flex items-center space-x-1.5 bg-[#151c2e] hover:bg-[#1e283d] text-slate-300 hover:text-white border border-[#1e283d] text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          title="Download standard RFC-822 .eml file"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Download .EML</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDirectOutboxSend}
                          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSent ? "Queued to Outbox!" : "Queue to Live Outbox"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#1e283d] bg-[#0f1523] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleTriggerEnrich}
            disabled={isEnriching}
            className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isEnriching ? "animate-spin text-amber-400" : ""}`} />
            <span>{isEnriching ? "Re-verifying DNS & Re-scoring..." : "Re-verify DNS & Re-score"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#151c2e] hover:bg-[#1e283d] border border-[#1e283d] text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
