import type React from "react";
import { useMemo } from "react";
import type {
  Lead,
  LeadSourceType,
  LeadStage,
  SeniorityLevel,
  VerificationStatus,
  AdvancedFilterState
} from "../types";
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Zap,
  Target,
  ShieldCheck,
  Building,
  Users,
  Sparkles,
  Layers,
  CheckCircle2
} from "lucide-react";

export const initialAdvancedFilterState: AdvancedFilterState = {
  scoreRange: { min: 0, max: 100 },
  stages: [],
  sources: [],
  seniorities: [],
  deliverability: [],
  hasAiDraft: "all",
  employeeRanges: [],
  isQualifiedOnly: false
};

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilterState;
  onChangeFilters: (newFilters: AdvancedFilterState) => void;
  onResetFilters: () => void;
  leads: Lead[];
}

function getLeadSource(lead: Lead): LeadSourceType {
  return lead.sourceType || "unknown";
}

function getEmployeeBucket(count?: number): string {
  if (!count || count <= 50) return "1-50";
  if (count <= 250) return "51-250";
  if (count <= 1000) return "251-1000";
  return "1000+";
}

interface FilterOptionButtonProps {
  checked: boolean;
  count: number;
  label: string;
  onToggle: () => void;
}

function FilterOptionButton({ checked, count, label, onToggle }: FilterOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`p-2 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
        checked
          ? "bg-indigo-950/70 border-indigo-500 text-white shadow-xs"
          : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-slate-200"
      }`}
    >
      <div className="flex items-center space-x-2 truncate">
        <div
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
            checked ? "bg-indigo-600 border-indigo-400 text-white" : "border-[#1e283d] bg-[#0f1523]"
          }`}
        >
          {checked && <Check className="w-2.5 h-2.5" />}
        </div>
        <span className={`truncate text-[11px] ${checked ? "font-bold text-white" : ""}`}>{label}</span>
      </div>
      <span className="text-[10px] font-mono text-slate-500 ml-1.5">({count})</span>
    </button>
  );
}

export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  onResetFilters,
  leads
}) => {
  // Real-time calculation of leads matching the current drawer filter state
  const matchingLeadsCount = useMemo(() => {
    return leads.filter((lead) => {
      // Score Range
      if (lead.fitScore < filters.scoreRange.min || lead.fitScore > filters.scoreRange.max) {
        return false;
      }
      // Stages
      if (filters.stages.length > 0 && !filters.stages.includes(lead.stage)) {
        return false;
      }
      // Sources
      if (filters.sources.length > 0) {
        const src = getLeadSource(lead);
        if (!filters.sources.includes(src)) return false;
      }
      // Seniorities
      if (filters.seniorities.length > 0 && !filters.seniorities.includes(lead.seniority)) {
        return false;
      }
      // Deliverability
      if (filters.deliverability.length > 0 && !filters.deliverability.includes(lead.verificationStatus)) {
        return false;
      }
      // AI Draft
      if (filters.hasAiDraft === "yes" && !lead.aiEmailDraft) return false;
      if (filters.hasAiDraft === "no" && lead.aiEmailDraft) return false;

      // Employee Ranges
      if (filters.employeeRanges.length > 0) {
        const bucket = getEmployeeBucket(lead.employeeCount);
        if (!filters.employeeRanges.includes(bucket)) return false;
      }

      // ICP Qualified Only
      if (filters.isQualifiedOnly && !lead.isQualified) return false;

      return true;
    }).length;
  }, [leads, filters]);

  // Real-time stage distribution count
  const stageCounts = useMemo(() => {
    const counts: Record<LeadStage, number> = {
      discovered: 0,
      enriched: 0,
      verified: 0,
      qualified: 0,
      exported: 0,
      disqualified: 0,
      archived: 0
    };
    leads.forEach((l) => {
      if (counts[l.stage] !== undefined) {
        counts[l.stage]++;
      }
    });
    return counts;
  }, [leads]);

  // Real-time source distribution count
  const sourceCounts = useMemo(() => {
    const counts: Record<LeadSourceType, number> = {
      unknown: 0,
      manual: 0,
      batch: 0,
      csv: 0,
      crawl: 0,
      waterfall: 0,
      api: 0,
      hunter: 0
    };
    leads.forEach((l) => {
      counts[getLeadSource(l)]++;
    });
    return counts;
  }, [leads]);

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.scoreRange.min > 0 || filters.scoreRange.max < 100) count++;
    if (filters.stages.length > 0) count += filters.stages.length;
    if (filters.sources.length > 0) count += filters.sources.length;
    if (filters.seniorities.length > 0) count += filters.seniorities.length;
    if (filters.deliverability.length > 0) count += filters.deliverability.length;
    if (filters.hasAiDraft !== "all") count++;
    if (filters.employeeRanges.length > 0) count += filters.employeeRanges.length;
    if (filters.isQualifiedOnly) count++;
    return count;
  }, [filters]);

  if (!isOpen) return null;

  const toggleStage = (stage: LeadStage) => {
    const next = filters.stages.includes(stage)
      ? filters.stages.filter((s) => s !== stage)
      : [...filters.stages, stage];
    onChangeFilters({ ...filters, stages: next });
  };

  const toggleSource = (source: LeadSourceType) => {
    const next = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onChangeFilters({ ...filters, sources: next });
  };

  const toggleSeniority = (sen: SeniorityLevel) => {
    const next = filters.seniorities.includes(sen)
      ? filters.seniorities.filter((s) => s !== sen)
      : [...filters.seniorities, sen];
    onChangeFilters({ ...filters, seniorities: next });
  };

  const toggleDeliverability = (status: VerificationStatus) => {
    const next = filters.deliverability.includes(status)
      ? filters.deliverability.filter((s) => s !== status)
      : [...filters.deliverability, status];
    onChangeFilters({ ...filters, deliverability: next });
  };

  const toggleEmployeeRange = (range: string) => {
    const next = filters.employeeRanges.includes(range)
      ? filters.employeeRanges.filter((r) => r !== range)
      : [...filters.employeeRanges, range];
    onChangeFilters({ ...filters, employeeRanges: next });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-label="Close advanced filters"
      />

      {/* Slide-Over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#0b0f19] border-l border-[#1e283d] shadow-2xl flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="p-5 border-b border-[#1e283d] flex items-center justify-between bg-[#0f1523]">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-950/80 text-indigo-400 border border-indigo-800/40 rounded-xl">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
                  <span>Advanced Lead Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                      {activeFiltersCount} active
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">Multi-criteria segmentation with live preview</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-[#1e283d] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs custom-scrollbar">
            {/* 1. Fit Score Range Filter */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ICP Fit Score Range</span>
                </div>
                <span className="font-mono text-indigo-400 font-bold">
                  {filters.scoreRange.min} - {filters.scoreRange.max} / 100
                </span>
              </div>

              {/* Range Presets */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, scoreRange: { min: 80, max: 100 } })}
                  className={`py-1 px-2 rounded-lg font-mono text-[11px] border transition cursor-pointer ${
                    filters.scoreRange.min === 80 && filters.scoreRange.max === 100
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 font-bold"
                      : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                  }`}
                >
                  🔥 High (80-100)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, scoreRange: { min: 50, max: 79 } })}
                  className={`py-1 px-2 rounded-lg font-mono text-[11px] border transition cursor-pointer ${
                    filters.scoreRange.min === 50 && filters.scoreRange.max === 79
                      ? "bg-indigo-950/80 border-indigo-500 text-indigo-300 font-bold"
                      : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                  }`}
                >
                  Medium (50-79)
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFilters({ ...filters, scoreRange: { min: 0, max: 100 } })}
                  className={`py-1 px-2 rounded-lg font-mono text-[11px] border transition cursor-pointer ${
                    filters.scoreRange.min === 0 && filters.scoreRange.max === 100
                      ? "bg-slate-800 border-slate-600 text-white font-bold"
                      : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                  }`}
                >
                  All (0-100)
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] text-slate-400 w-10">Min: {filters.scoreRange.min}</span>
                  <input
                    type="range"
                    min={0}
                    max={filters.scoreRange.max}
                    value={filters.scoreRange.min}
                    onChange={(e) =>
                      onChangeFilters({
                        ...filters,
                        scoreRange: { ...filters.scoreRange, min: Number(e.target.value) }
                      })
                    }
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[11px] text-slate-400 w-10">Max: {filters.scoreRange.max}</span>
                  <input
                    type="range"
                    min={filters.scoreRange.min}
                    max={100}
                    value={filters.scoreRange.max}
                    onChange={(e) =>
                      onChangeFilters({
                        ...filters,
                        scoreRange: { ...filters.scoreRange, max: Number(e.target.value) }
                      })
                    }
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 2. Lead Stage Multi-Select Filter */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pipeline Stage</span>
                </div>
                {filters.stages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ ...filters, stages: [] })}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "qualified" as LeadStage, label: "ICP Qualified", color: "text-emerald-400" },
                  { key: "enriched" as LeadStage, label: "Enriched", color: "text-indigo-400" },
                  { key: "verified" as LeadStage, label: "MX Verified", color: "text-cyan-400" },
                  { key: "discovered" as LeadStage, label: "Discovered", color: "text-blue-400" },
                  { key: "exported" as LeadStage, label: "Exported", color: "text-teal-400" },
                  { key: "disqualified" as LeadStage, label: "Disqualified", color: "text-slate-400" }
                ].map((s) => {
                  const isChecked = filters.stages.includes(s.key);
                  const count = stageCounts[s.key] || 0;

                  return (
                    <FilterOptionButton
                      key={s.key}
                      checked={isChecked}
                      count={count}
                      label={s.label}
                      onToggle={() => toggleStage(s.key)}
                    />
                  );
                })}
              </div>
            </div>

            {/* 3. Source Type Multi-Select Filter */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Acquisition Source Type</span>
                </div>
                {filters.sources.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ ...filters, sources: [] })}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "unknown", label: "Legacy / Unknown", count: sourceCounts.unknown },
                    { key: "manual", label: "Manual Entry", count: sourceCounts.manual },
                    { key: "batch", label: "JSON Batch", count: sourceCounts.batch },
                    { key: "csv", label: "CSV Import", count: sourceCounts.csv },
                    { key: "crawl", label: "Evidence Crawl", count: sourceCounts.crawl },
                    { key: "waterfall", label: "Waterfall Resolution", count: sourceCounts.waterfall },
                    { key: "api", label: "Direct API", count: sourceCounts.api }
                  ] satisfies Array<{ key: LeadSourceType; label: string; count: number }>
                ).map((src) => {
                  const isChecked = filters.sources.includes(src.key);

                  return (
                    <FilterOptionButton
                      key={src.key}
                      checked={isChecked}
                      count={src.count}
                      label={src.label}
                      onToggle={() => toggleSource(src.key)}
                    />
                  );
                })}
              </div>
            </div>

            {/* 4. Decision Maker Seniority Filter */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Seniority Tier</span>
                </div>
                {filters.seniorities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ ...filters, seniorities: [] })}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "c_level" as SeniorityLevel, label: "C-Level / Exec" },
                  { key: "vp" as SeniorityLevel, label: "VP / Head of" },
                  { key: "director" as SeniorityLevel, label: "Director" },
                  { key: "manager" as SeniorityLevel, label: "Manager" },
                  { key: "individual_contributor" as SeniorityLevel, label: "IC / Staff" }
                ].map((s) => {
                  const isChecked = filters.seniorities.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSeniority(s.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition cursor-pointer flex items-center space-x-1.5 ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                          : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Deliverability / Verification Status */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deliverability Verification</span>
                </div>
                {filters.deliverability.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ ...filters, deliverability: [] })}
                    className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "valid" as VerificationStatus, label: "Valid MX Verified" },
                  { key: "risky" as VerificationStatus, label: "Accept All / Risky" },
                  { key: "disposable" as VerificationStatus, label: "Disposable Temp Mail" },
                  { key: "invalid" as VerificationStatus, label: "Invalid / No MX" }
                ].map((st) => {
                  const isChecked = filters.deliverability.includes(st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => toggleDeliverability(st.key)}
                      className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition cursor-pointer ${
                        isChecked
                          ? "bg-indigo-950/70 border-indigo-500 text-white"
                          : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                          isChecked ? "bg-indigo-600 border-indigo-400 text-white" : "border-[#1e283d] bg-[#0f1523]"
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className={`text-[11px] truncate ${isChecked ? "font-bold text-white" : ""}`}>
                        {st.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. Company Headcount / Size */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>Account Headcount Range</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {["1-50", "51-250", "251-1000", "1000+"].map((range) => {
                  const isChecked = filters.employeeRanges.includes(range);
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => toggleEmployeeRange(range)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-mono border text-center transition cursor-pointer ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                          : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                      }`}
                    >
                      {range}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 7. AI Email Draft Toggle */}
            <div className="space-y-3 bg-[#0f1523] border border-[#1e283d] p-4 rounded-xl">
              <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Cold Email Sequence Draft</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: "all" as const, label: "Any Status" },
                  { value: "yes" as const, label: "Draft Ready" },
                  { value: "no" as const, label: "No Draft" }
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeFilters({ ...filters, hasAiDraft: opt.value })}
                    className={`py-1 px-2 rounded-lg text-xs border text-center transition cursor-pointer ${
                      filters.hasAiDraft === opt.value
                        ? "bg-indigo-600 border-indigo-400 text-white font-bold"
                        : "bg-[#0a0d16] border-[#1e283d] text-slate-400 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 8. Qualified Leads Only Switch */}
            <div className="flex items-center justify-between bg-[#0a0d16] border border-indigo-900/40 p-3.5 rounded-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 block">Strict ICP Qualified Only</span>
                <span className="text-[11px] text-slate-400 block">
                  Filter exclusively for leads marked isQualified
                </span>
              </div>
              <input
                type="checkbox"
                checked={filters.isQualifiedOnly}
                onChange={(e) => onChangeFilters({ ...filters, isQualifiedOnly: e.target.checked })}
                className="w-4 h-4 rounded border-[#1e283d] bg-[#0f1523] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Drawer Sticky Footer with Live Count */}
          <div className="p-4 border-t border-[#1e283d] bg-[#0f1523] space-y-3">
            {/* Live Count Update Banner */}
            <div className="flex items-center justify-between text-xs bg-[#0a0d16] border border-indigo-900/60 p-2.5 rounded-xl font-mono">
              <span className="text-slate-400">Live Match Rate:</span>
              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {matchingLeadsCount} of {leads.length} leads (
                  {leads.length > 0 ? Math.round((matchingLeadsCount / leads.length) * 100) : 0}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <button
                type="button"
                onClick={onResetFilters}
                className="flex items-center space-x-1.5 px-3 py-2 bg-[#0a0d16] hover:bg-[#151c2e] border border-[#1e283d] text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset All</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <span>Apply Filters ({matchingLeadsCount} Leads)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
