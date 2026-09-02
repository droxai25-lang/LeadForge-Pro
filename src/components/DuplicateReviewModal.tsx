import React, { useState } from "react";
import type { DuplicateCandidate, DuplicateAction } from "../types";
import {
  GitMerge,
  EyeOff,
  UserPlus,
  CheckCircle2,
  X,
  ShieldAlert,
  Building,
  Mail,
  Briefcase,
  Phone
} from "lucide-react";

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateCandidate[];
  uniqueLeadsCount: number;
  onConfirmResolutions: (resolvedCandidates: DuplicateCandidate[]) => void;
}

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  uniqueLeadsCount,
  onConfirmResolutions
}) => {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>(duplicates);

  // Sync state when duplicates prop changes
  React.useEffect(() => {
    setCandidates(duplicates);
  }, [duplicates]);

  if (!isOpen || candidates.length === 0) return null;

  const handleSetGlobalAction = (action: DuplicateAction) => {
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        action
      }))
    );
  };

  const handleSetSingleAction = (id: string, action: DuplicateAction) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, action } : c)));
  };

  const mergeCount = candidates.filter((c) => c.action === "merge").length;
  const ignoreCount = candidates.filter((c) => c.action === "ignore").length;
  const separateCount = candidates.filter((c) => c.action === "import_separate").length;

  const handleCommit = () => {
    onConfirmResolutions(candidates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-[#0f1523] border border-amber-500/50 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#1e283d] flex items-center justify-between bg-[#0a0d16]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-950/80 text-amber-400 border border-amber-700/60 rounded-xl shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Proactive Duplicate Detection & Resolution
                </h2>
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-full animate-pulse">
                  {candidates.length} Duplicates Detected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review flagged records to prevent database pollution. Choose to merge new attributes or skip redundant
                leads.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Batch Action Ribbon */}
        <div className="bg-[#121929] border-b border-[#1e283d] px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-4 text-slate-300">
            <span className="flex items-center space-x-1.5">
              <strong className="text-emerald-400 font-mono">{uniqueLeadsCount}</strong>
              <span>Unique New Records</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center space-x-1.5">
              <strong className="text-amber-400 font-mono">{candidates.length}</strong>
              <span>Pending Decisions</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Batch Actions:</span>
            <button
              type="button"
              onClick={() => handleSetGlobalAction("merge")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                mergeCount === candidates.length
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 hover:bg-emerald-900"
              }`}
            >
              <GitMerge className="w-3 h-3" />
              <span>Merge All ({candidates.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetGlobalAction("ignore")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                ignoreCount === candidates.length
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-[#0a0d16] border border-[#1e283d] text-slate-400 hover:text-slate-200"
              }`}
            >
              <EyeOff className="w-3 h-3" />
              <span>Ignore All</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetGlobalAction("import_separate")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                separateCount === candidates.length
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 hover:bg-indigo-900"
              }`}
            >
              <UserPlus className="w-3 h-3" />
              <span>Force Import All</span>
            </button>
          </div>
        </div>

        {/* Duplicate Candidates List */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {candidates.map((cand, index) => {
            const incoming = cand.incomingLead;
            const existing = cand.existingLead;

            return (
              <div
                key={cand.id}
                className={`p-4 rounded-xl border transition-all ${
                  cand.action === "merge"
                    ? "bg-emerald-950/20 border-emerald-800/60"
                    : cand.action === "ignore"
                      ? "bg-slate-900/40 border-[#1e283d] opacity-75"
                      : "bg-indigo-950/20 border-indigo-800/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e283d]/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#0a0d16] text-slate-400 border border-[#1e283d]">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {incoming.firstName} {incoming.lastName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">({incoming.email})</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      {cand.matchedReason === "exact_email"
                        ? "Exact Email Match"
                        : cand.matchedReason === "domain_and_name"
                          ? "Name + Domain Collision"
                          : "Batch Redundancy"}
                    </span>
                  </div>

                  {/* Decision Selector */}
                  <div className="flex items-center bg-[#0a0d16] p-1 rounded-xl border border-[#1e283d] text-xs">
                    <button
                      type="button"
                      onClick={() => handleSetSingleAction(cand.id, "merge")}
                      className={`px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer ${
                        cand.action === "merge"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-emerald-300"
                      }`}
                    >
                      <GitMerge className="w-3 h-3" />
                      <span>Merge Into Lead</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetSingleAction(cand.id, "ignore")}
                      className={`px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer ${
                        cand.action === "ignore"
                          ? "bg-slate-700 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Ignore / Skip</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetSingleAction(cand.id, "import_separate")}
                      className={`px-3 py-1 rounded-lg font-semibold flex items-center space-x-1 transition cursor-pointer ${
                        cand.action === "import_separate"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-indigo-300"
                      }`}
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Keep Separate</span>
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Existing Lead */}
                  <div className="p-3 bg-[#0a0d16] border border-[#1e283d] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Existing Lead In Database
                      </span>
                      {existing && (
                        <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {existing.id}
                        </span>
                      )}
                    </div>

                    {existing ? (
                      <div className="space-y-1.5 text-slate-300">
                        <p className="font-semibold text-white">
                          {existing.firstName} {existing.lastName}
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-400">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{existing.email}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-400">
                          <Briefcase className="w-3 h-3 text-slate-500" />
                          <span>{existing.jobTitle}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-400">
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>
                            {existing.companyName} ({existing.companyDomain})
                          </span>
                        </p>
                        <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Fit Score: {existing.fitScore}/100
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            Stage: {existing.stage.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic py-2">Duplicate detected within this import batch file.</p>
                    )}
                  </div>

                  {/* Incoming Lead */}
                  <div className="p-3 bg-[#0a0d16] border border-amber-900/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Incoming Batch Record
                      </span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800">
                        Row #{incoming.rawIndex !== undefined ? incoming.rawIndex + 1 : index + 1}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-slate-300">
                      <p className="font-semibold text-white">
                        {incoming.firstName} {incoming.lastName}
                      </p>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{incoming.email}</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Briefcase className="w-3 h-3 text-slate-500" />
                        <span
                          className={incoming.jobTitle !== existing?.jobTitle ? "text-amber-300 font-semibold" : ""}
                        >
                          {incoming.jobTitle}
                        </span>
                      </p>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        <Building className="w-3 h-3 text-slate-500" />
                        <span>
                          {incoming.companyName} ({incoming.companyDomain})
                        </span>
                      </p>
                      {incoming.phone && (
                        <p className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                          <Phone className="w-3 h-3" />
                          <span>+ New Phone: {incoming.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Differences Summary */}
                {cand.differences && cand.differences.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#1e283d]/40 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-slate-500">Detected Field Variations:</span>
                    {cand.differences.map((diff) => (
                      <span
                        key={`${diff.field}-${String(diff.existingValue)}-${String(diff.incomingValue)}`}
                        className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800 text-indigo-300"
                      >
                        {diff.label}: "{String(diff.incomingValue || "N/A")}"
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e283d] flex flex-wrap items-center justify-between gap-3 bg-[#0a0d16]">
          <div className="text-xs text-slate-400">
            Commit Action Plan:{" "}
            <strong className="text-emerald-400">{uniqueLeadsCount + separateCount} Leads Created</strong> •{" "}
            <strong className="text-indigo-300">{mergeCount} Leads Merged</strong> •{" "}
            <strong className="text-slate-400">{ignoreCount} Leads Ignored</strong>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel Import
            </button>
            <button
              type="button"
              onClick={handleCommit}
              className="flex items-center space-x-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/30 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Commit Pipeline Ingest</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
