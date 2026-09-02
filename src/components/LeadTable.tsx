import type React from "react";
import { useState, useMemo } from "react";
import type { Lead, LeadStage, SeniorityLevel, VerificationStatus, AdvancedFilterState } from "../types";
import { LeadAnalyticsChart, type SegmentFilter } from "./LeadAnalyticsChart";
import { AdvancedFilterDrawer, initialAdvancedFilterState } from "./AdvancedFilterDrawer";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  Zap,
  Trash2,
  Mail,
  ShieldCheck,
  Building,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Users,
  Target,
  X,
  SlidersHorizontal,
  RotateCcw
} from "lucide-react";

export type SortField = "name" | "company" | "seniority" | "deliverability" | "fitScore" | "stage";
export type SortDirection = "asc" | "desc";

const sortableColumns: ReadonlyArray<{ field: SortField; label: string; title: string }> = [
  { field: "name", label: "Prospect Identity", title: "Sort by Prospect Name" },
  { field: "company", label: "Organization", title: "Sort by Company" },
  { field: "seniority", label: "Seniority", title: "Sort by Decision-Maker Seniority Tier" },
  { field: "deliverability", label: "Deliverability", title: "Sort by DNS MX Deliverability" },
  { field: "fitScore", label: "Fit Score", title: "Sort by Multi-Factor Fit Score" },
  { field: "stage", label: "Stage", title: "Sort by Pipeline Stage" }
];

const seniorityOrder: Record<SeniorityLevel, number> = {
  c_level: 5,
  vp: 4,
  director: 3,
  manager: 2,
  individual_contributor: 1,
  unknown: 0
};

const verificationOrder: Record<VerificationStatus, number> = {
  mailbox_accepted: 5,
  provider_verified: 5,
  domain_accepts_mail: 4,
  risky: 3,
  disposable: 2,
  mx_not_found: 1,
  invalid: 1,
  unverified: 0
};

const stageOrder: Record<LeadStage, number> = {
  exported: 6,
  qualified: 5,
  verified: 4,
  enriched: 3,
  discovered: 2,
  disqualified: 1,
  archived: 0
};

interface LeadTableProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onEnrichLead: (leadId: string) => Promise<void>;
  onPersonalizeLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => Promise<void>;
  onExportSelected: (leadIds: string[]) => void;
  onAddToCampaign?: (leadIds: string[]) => void;
  onBulkEnrich?: (leadIds: string[]) => Promise<void>;
  onBulkDelete?: (leadIds: string[]) => Promise<void>;
  onBulkStage?: (leadIds: string[], stage: LeadStage, isQualified: boolean) => Promise<void>;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  onSelectLead,
  onEnrichLead,
  onPersonalizeLead,
  onDeleteLead,
  onExportSelected,
  onAddToCampaign,
  onBulkEnrich,
  onBulkDelete,
  onBulkStage
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [seniorityFilter, setSeniorityFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>("fitScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [scoreFilter, setScoreFilter] = useState<{ min: number; max: number; label?: string } | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter | null>(null);

  // Advanced Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(initialAdvancedFilterState);

  // Active advanced filters count
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.scoreRange.min > 0 || advancedFilters.scoreRange.max < 100) count++;
    if (advancedFilters.stages.length > 0) count += advancedFilters.stages.length;
    if (advancedFilters.sources.length > 0) count += advancedFilters.sources.length;
    if (advancedFilters.seniorities.length > 0) count += advancedFilters.seniorities.length;
    if (advancedFilters.deliverability.length > 0) count += advancedFilters.deliverability.length;
    if (advancedFilters.hasAiDraft !== "all") count++;
    if (advancedFilters.employeeRanges.length > 0) count += advancedFilters.employeeRanges.length;
    if (advancedFilters.isQualifiedOnly) count++;
    return count;
  }, [advancedFilters]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => l.isQualified).length;
    const validDeliverable = leads.filter((l) => l.verificationStatus === "mailbox_accepted").length;
    const exported = leads.filter((l) => l.stage === "exported").length;
    const avgScore = total > 0 ? Math.round((leads.reduce((acc, l) => acc + l.fitScore, 0) / total) * 10) / 10 : 0;
    return { total, qualified, validDeliverable, exported, avgScore };
  }, [leads]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Default to descending for quantitative/ranking scores, ascending for alphabetical strings
      if (field === "fitScore" || field === "seniority" || field === "deliverability") {
        setSortDirection("desc");
      } else {
        setSortDirection("asc");
      }
    }
  };

  const filteredLeads = useMemo(() => {
    const list = leads.filter((lead) => {
      // 1. Dropdown Filters
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (seniorityFilter !== "all" && lead.seniority !== seniorityFilter) return false;
      if (verificationFilter !== "all" && lead.verificationStatus !== verificationFilter) return false;
      if (scoreFilter && (lead.fitScore < scoreFilter.min || lead.fitScore > scoreFilter.max)) return false;

      // 2. Advanced Multi-Criteria Drawer Filters
      if (lead.fitScore < advancedFilters.scoreRange.min || lead.fitScore > advancedFilters.scoreRange.max) {
        return false;
      }
      if (advancedFilters.stages.length > 0 && !advancedFilters.stages.includes(lead.stage)) {
        return false;
      }
      if (advancedFilters.sources.length > 0) {
        if (!advancedFilters.sources.includes(lead.sourceType || "unknown")) return false;
      }
      if (advancedFilters.seniorities.length > 0 && !advancedFilters.seniorities.includes(lead.seniority)) {
        return false;
      }
      if (
        advancedFilters.deliverability.length > 0 &&
        !advancedFilters.deliverability.includes(lead.verificationStatus)
      ) {
        return false;
      }
      if (advancedFilters.hasAiDraft === "yes" && !lead.aiEmailDraft) return false;
      if (advancedFilters.hasAiDraft === "no" && lead.aiEmailDraft) return false;
      if (advancedFilters.employeeRanges.length > 0) {
        const count = lead.employeeCount || 0;
        let bucket = "1-50";
        if (count > 1000) bucket = "1000+";
        else if (count > 250) bucket = "251-1000";
        else if (count > 50) bucket = "51-250";
        if (!advancedFilters.employeeRanges.includes(bucket)) return false;
      }
      if (advancedFilters.isQualifiedOnly && !lead.isQualified) {
        return false;
      }

      // 3. Segment Filter from interactive charts
      if (segmentFilter) {
        if (segmentFilter.type === "stage" && lead.stage !== segmentFilter.value) return false;
        if (segmentFilter.type === "seniority" && lead.seniority !== segmentFilter.value) return false;
        if (segmentFilter.type === "deliverability" && lead.verificationStatus !== segmentFilter.value) return false;
        if (segmentFilter.type === "qualified" && lead.isQualified !== segmentFilter.value) return false;
        if (segmentFilter.type === "search" && segmentFilter.value) {
          const q = String(segmentFilter.value).toLowerCase();
          const matches =
            lead.id.toLowerCase().includes(q) ||
            lead.firstName.toLowerCase().includes(q) ||
            lead.lastName.toLowerCase().includes(q) ||
            lead.companyName.toLowerCase().includes(q) ||
            lead.jobTitle.toLowerCase().includes(q) ||
            lead.email.toLowerCase().includes(q);
          if (!matches) return false;
        }
      }

      // 4. Global Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          lead.firstName.toLowerCase().includes(q) ||
          lead.lastName.toLowerCase().includes(q) ||
          lead.email.toLowerCase().includes(q) ||
          lead.companyName.toLowerCase().includes(q) ||
          lead.jobTitle.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    if (!sortField) return list;

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "company": {
          const compA = (a.companyName || "").toLowerCase();
          const compB = (b.companyName || "").toLowerCase();
          comparison = compA.localeCompare(compB);
          break;
        }
        case "seniority": {
          const rankA = seniorityOrder[a.seniority] || 0;
          const rankB = seniorityOrder[b.seniority] || 0;
          comparison = rankA - rankB;
          break;
        }
        case "deliverability": {
          const rankA = verificationOrder[a.verificationStatus] || 0;
          const rankB = verificationOrder[b.verificationStatus] || 0;
          comparison = rankA - rankB;
          break;
        }
        case "fitScore": {
          comparison = a.fitScore - b.fitScore;
          break;
        }
        case "stage": {
          const rankA = stageOrder[a.stage] || 0;
          const rankB = stageOrder[b.stage] || 0;
          comparison = rankA - rankB;
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    leads,
    stageFilter,
    seniorityFilter,
    verificationFilter,
    scoreFilter,
    advancedFilters,
    segmentFilter,
    searchTerm,
    sortField,
    sortDirection
  ]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleQuickEnrich = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnrichingId(id);
    try {
      await onEnrichLead(id);
    } finally {
      setEnrichingId(null);
    }
  };

  const getSeniorityBadge = (seniority: SeniorityLevel) => {
    switch (seniority) {
      case "c_level":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold bg-purple-950 text-purple-300 rounded border border-purple-800 uppercase tracking-wider">
            C-Suite
          </span>
        );
      case "vp":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold bg-indigo-950 text-indigo-300 rounded border border-indigo-800 uppercase tracking-wider">
            VP
          </span>
        );
      case "director":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-950 text-blue-300 rounded border border-blue-800 uppercase tracking-wider">
            Director
          </span>
        );
      case "manager":
        return (
          <span className="px-2 py-0.5 text-[9px] font-bold bg-teal-950 text-teal-300 rounded border border-teal-800 uppercase tracking-wider">
            Manager
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[9px] font-medium bg-slate-800 text-slate-400 rounded border border-slate-700 uppercase tracking-wider">
            IC / Staff
          </span>
        );
    }
  };

  const getVerificationIcon = (status: VerificationStatus, mxHosts: string[]) => {
    switch (status) {
      case "mailbox_accepted":
        return (
          <div
            className="flex items-center space-x-1.5 text-emerald-400 text-xs font-medium"
            title={`SMTP accepted; identity unconfirmed. MX: ${mxHosts.join(", ") || "Active"}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>SMTP Accepted</span>
          </div>
        );
      case "domain_accepts_mail":
        return (
          <div
            className="flex items-center space-x-1.5 text-cyan-400 text-xs font-medium"
            title={`Domain publishes MX records; mailbox identity was not checked. MX: ${mxHosts.join(", ") || "Active"}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Domain MX Only</span>
          </div>
        );
      case "disposable":
        return (
          <div
            className="flex items-center space-x-1.5 text-rose-400 text-xs font-medium"
            title="Disposable / Temp Domain"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Disposable</span>
          </div>
        );
      case "invalid":
      case "mx_not_found":
        return (
          <div
            className="flex items-center space-x-1.5 text-amber-400 text-xs font-medium"
            title="No MX records or invalid format"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>No MX</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-1.5 text-slate-500 text-xs">
            <span className="w-2 h-2 rounded-full bg-slate-600"></span>
            <span>Unverified</span>
          </div>
        );
    }
  };

  const getStageBadge = (stage: LeadStage, isQualified: boolean) => {
    if (stage === "exported") {
      return (
        <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
          Exported
        </span>
      );
    }
    if (isQualified || stage === "qualified") {
      return (
        <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
          Qualified
        </span>
      );
    }
    if (stage === "disqualified") {
      return (
        <span className="bg-rose-950 text-rose-400 border border-rose-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
          Disqualified
        </span>
      );
    }
    if (stage === "enriched") {
      return (
        <span className="bg-amber-950 text-amber-400 border border-amber-800 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
          Enriched
        </span>
      );
    }
    return (
      <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
        Discovered
      </span>
    );
  };

  const handleBulkEnrichClick = async () => {
    if (!onBulkEnrich || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      await onBulkEnrich(Array.from(selectedIds));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkQualifyClick = async () => {
    if (!onBulkStage || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      await onBulkStage(Array.from(selectedIds), "qualified", true);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDisqualifyClick = async () => {
    if (!onBulkStage || selectedIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      await onBulkStage(Array.from(selectedIds), "disqualified", false);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDeleteClick = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected leads?`)) {
      return;
    }
    setIsBulkProcessing(true);
    try {
      await onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 High-Impact KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Ingested Leads</p>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">{stats.total.toLocaleString()}</p>
          <div className="mt-2.5 h-1 bg-[#1e283d] rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-[85%]"></div>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ICP Qualified Prospects</p>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {stats.qualified.toLocaleString()}
          </p>
          <div className="mt-2.5 h-1 bg-[#1e283d] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${stats.total > 0 ? (stats.qualified / stats.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deliverable MX Verified</p>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
            {stats.validDeliverable.toLocaleString()}
          </p>
          <div className="mt-2.5 h-1 bg-[#1e283d] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{ width: `${stats.total > 0 ? (stats.validDeliverable / stats.total) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average ICP Fit Score</p>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-indigo-400 mt-1 tabular-nums">{stats.avgScore}/100</p>
          <div className="mt-2.5 h-1 bg-[#1e283d] rounded-full overflow-hidden">
            <div className="h-full bg-indigo-400" style={{ width: `${stats.avgScore}%` }}></div>
          </div>
        </div>
      </div>

      {/* Recharts Analytics Visualization Section */}
      <LeadAnalyticsChart leads={leads} activeSegmentFilter={segmentFilter} onFilterSegment={setSegmentFilter} />

      {/* Filter and Control Bar */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-4 shadow-card-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="lead-table-search-input"
            type="text"
            placeholder="Search prospects by name, email, company, or job title (Press / to focus)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Dropdowns & Active Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {segmentFilter && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-950/90 border border-indigo-500 text-indigo-200 text-xs font-medium shadow-sm">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              <span>{segmentFilter.label}</span>
              <button
                type="button"
                onClick={() => setSegmentFilter(null)}
                className="text-indigo-300 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Clear segment filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {scoreFilter && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-medium">
              <span>{scoreFilter.label || `Score ${scoreFilter.min}-${scoreFilter.max}`}</span>
              <button
                type="button"
                onClick={() => setScoreFilter(null)}
                className="text-emerald-400 hover:text-emerald-200 p-0.5 rounded cursor-pointer"
                title="Clear score tier filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Stages</option>
            <option value="qualified">Qualified ICP</option>
            <option value="enriched">Enriched</option>
            <option value="discovered">Discovered</option>
            <option value="exported">Exported</option>
            <option value="disqualified">Disqualified</option>
          </select>

          <select
            value={seniorityFilter}
            onChange={(e) => setSeniorityFilter(e.target.value)}
            className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Seniorities</option>
            <option value="c_level">C-Level / Founders</option>
            <option value="vp">Vice Presidents</option>
            <option value="director">Directors</option>
            <option value="manager">Managers</option>
            <option value="individual_contributor">IC / Staff</option>
          </select>

          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="all">All Deliverability</option>
            <option value="valid">Valid MX</option>
            <option value="disposable">Disposable / Temp</option>
            <option value="invalid">Invalid / Missing</option>
          </select>

          {/* Advanced Filter Drawer Trigger Button */}
          <button
            type="button"
            onClick={() => setIsFilterDrawerOpen(true)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              activeAdvancedCount > 0
                ? "bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-600/30"
                : "bg-[#0a0d16] hover:bg-[#151c2e] border-[#1e283d] text-slate-300 hover:text-white"
            }`}
            title="Open advanced multi-criteria filter drawer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeAdvancedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-white text-indigo-700 font-mono font-bold text-[10px] rounded-full">
                {activeAdvancedCount}
              </span>
            )}
          </button>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#151c2e] border border-indigo-500/40 rounded-xl">
              <span className="text-[11px] font-mono font-bold text-indigo-300 px-2">{selectedIds.size} Selected</span>

              {onBulkEnrich && (
                <button
                  type="button"
                  onClick={handleBulkEnrichClick}
                  disabled={isBulkProcessing}
                  className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                  title="Re-verify deliverability & fit scores"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Enrich</span>
                </button>
              )}

              {onBulkStage && (
                <>
                  <button
                    type="button"
                    onClick={handleBulkQualifyClick}
                    disabled={isBulkProcessing}
                    className="flex items-center space-x-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="Mark selected as qualified"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Qualify</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBulkDisqualifyClick}
                    disabled={isBulkProcessing}
                    className="flex items-center space-x-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="Mark selected as disqualified"
                  >
                    <XCircle className="w-3 h-3 text-rose-400" />
                    <span>Disqualify</span>
                  </button>
                </>
              )}

              {onBulkDelete && (
                <button
                  type="button"
                  onClick={handleBulkDeleteClick}
                  disabled={isBulkProcessing}
                  className="flex items-center space-x-1 bg-[#0a0d16] hover:bg-rose-950 text-rose-400 border border-rose-900/60 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                  title="Delete selected leads"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )}

              {onAddToCampaign && (
                <button
                  type="button"
                  onClick={() => onAddToCampaign(Array.from(selectedIds))}
                  className="flex items-center space-x-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow-sm shadow-purple-600/30"
                  title="Enroll selected leads into cold email campaign sequence"
                >
                  <Mail className="w-3 h-3" />
                  <span>Add to Sequence</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onExportSelected(Array.from(selectedIds))}
                className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Export selected to CSV/JSON/CRM"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Active Advanced Filters Ribbon */}
      {activeAdvancedCount > 0 && (
        <div className="bg-[#0c101d] border border-indigo-900/50 rounded-xl p-2.5 px-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider mr-1">
              Active Filters ({activeAdvancedCount}):
            </span>

            {/* Score Range */}
            {(advancedFilters.scoreRange.min > 0 || advancedFilters.scoreRange.max < 100) && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px]">
                <span>
                  Score: {advancedFilters.scoreRange.min}-{advancedFilters.scoreRange.max}
                </span>
                <button
                  type="button"
                  onClick={() => setAdvancedFilters({ ...advancedFilters, scoreRange: { min: 0, max: 100 } })}
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Stages */}
            {advancedFilters.stages.map((stage) => (
              <span
                key={stage}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px] capitalize"
              >
                <span>Stage: {stage}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      stages: advancedFilters.stages.filter((s) => s !== stage)
                    })
                  }
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Sources */}
            {advancedFilters.sources.map((source) => (
              <span
                key={source}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px] uppercase"
              >
                <span>Source: {source}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      sources: advancedFilters.sources.filter((s) => s !== source)
                    })
                  }
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Seniorities */}
            {advancedFilters.seniorities.map((sen) => (
              <span
                key={sen}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px]"
              >
                <span>Seniority: {sen.replace("_", " ")}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      seniorities: advancedFilters.seniorities.filter((s) => s !== sen)
                    })
                  }
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Deliverability */}
            {advancedFilters.deliverability.map((del) => (
              <span
                key={del}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px]"
              >
                <span>Deliverability: {del}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      deliverability: advancedFilters.deliverability.filter((d) => d !== del)
                    })
                  }
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Employee ranges */}
            {advancedFilters.employeeRanges.map((emp) => (
              <span
                key={emp}
                className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px]"
              >
                <span>Headcount: {emp}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAdvancedFilters({
                      ...advancedFilters,
                      employeeRanges: advancedFilters.employeeRanges.filter((e) => e !== emp)
                    })
                  }
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* AI draft filter */}
            {advancedFilters.hasAiDraft !== "all" && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700 text-indigo-300 font-mono text-[11px]">
                <span>AI Draft: {advancedFilters.hasAiDraft === "yes" ? "Generated" : "None"}</span>
                <button
                  type="button"
                  onClick={() => setAdvancedFilters({ ...advancedFilters, hasAiDraft: "all" })}
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Qualified only */}
            {advancedFilters.isQualifiedOnly && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-mono text-[11px]">
                <span>Strict ICP Qualified</span>
                <button
                  type="button"
                  onClick={() => setAdvancedFilters({ ...advancedFilters, isQualifiedOnly: false })}
                  className="hover:text-white ml-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setAdvancedFilters(initialAdvancedFilterState)}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center space-x-1 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}

      {/* Main Table */}
      <section className="bg-[#0f1523] rounded-2xl border border-[#1e283d] overflow-hidden flex flex-col shadow-card-subtle">
        <div className="px-6 py-3.5 border-b border-[#1e283d] bg-[#0f1523]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-bold text-white tracking-tight">
              Ingested Leads Directory & Pipeline Table
            </span>
            <span className="bg-[#0a0d16] text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-mono border border-[#1e283d]">
              {filteredLeads.length} leads matching filters
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : "Click any row to open AI inspector & outreach studio"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0a0d16] text-slate-400 sticky top-0 border-b border-[#1e283d] z-10">
              <tr>
                <th className="py-3.5 px-4 w-8">
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                    onChange={toggleSelectAll}
                    className="rounded border-[#1e283d] bg-[#0a0d16] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>

                {sortableColumns.map((column) => {
                  const isActive = sortField === column.field;
                  return (
                    <th
                      key={column.field}
                      onClick={() => handleSort(column.field)}
                      className={`px-6 py-3.5 text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer transition-colors group ${
                        isActive
                          ? "text-indigo-300 bg-[#151c2e]/60"
                          : "text-slate-300 hover:text-white hover:bg-[#151c2e]/30"
                      }`}
                      title={column.title}
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>{column.label}</span>
                        <span className="shrink-0">
                          {isActive ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}

                <th className="px-6 py-3.5 text-[10px] font-bold text-slate-300 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e283d] font-mono text-[11px]">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    <p className="text-sm font-medium text-slate-400">No leads match the specified criteria</p>
                    <p className="text-xs mt-1">Try adjusting your filters or search query, or ingest new leads.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const isEnriching = enrichingId === lead.id;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectLead(lead);
                        }
                      }}
                      tabIndex={0}
                      className={`hover:bg-[#151c2e]/70 cursor-pointer transition group ${
                        isSelected ? "bg-[#151c2e]" : ""
                      }`}
                    >
                      <td
                        className="py-4 px-4"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="rounded border-[#1e283d] bg-[#0a0d16] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Prospect & Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-200 font-sans">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-slate-400 text-[11px] font-sans truncate max-w-[200px]">
                          {lead.jobTitle}
                        </div>
                        <div className="text-indigo-400 text-[10px] truncate max-w-[200px]">{lead.email}</div>
                      </td>

                      {/* Company & Scale */}
                      <td className="px-6 py-4 whitespace-nowrap font-sans">
                        <div className="text-slate-300 font-medium flex items-center space-x-1">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{lead.companyName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 italic">
                          {lead.industry || "B2B Tech"} •{" "}
                          <span className="tabular-nums font-mono">
                            {lead.employeeCount ? `${lead.employeeCount.toLocaleString()} Emp` : "Scale N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Seniority */}
                      <td className="px-6 py-4 whitespace-nowrap">{getSeniorityBadge(lead.seniority)}</td>

                      {/* Deliverability */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getVerificationIcon(lead.verificationStatus, lead.mxHosts)}
                      </td>

                      {/* Fit Score */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`font-bold tabular-nums font-mono ${lead.fitScore >= 70 ? "text-emerald-400" : lead.fitScore >= 45 ? "text-slate-300" : "text-rose-400"}`}
                        >
                          {lead.fitScore}/100
                        </span>
                      </td>

                      {/* Stage */}
                      <td className="px-6 py-4 whitespace-nowrap">{getStageBadge(lead.stage, lead.isQualified)}</td>

                      {/* Actions */}
                      <td
                        className="px-6 py-4 whitespace-nowrap text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-end space-x-1.5 font-sans">
                          {/* Enrich button */}
                          <button
                            type="button"
                            onClick={(e) => handleQuickEnrich(lead.id, e)}
                            disabled={isEnriching}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow-sm shadow-indigo-600/20 cursor-pointer disabled:bg-indigo-900/50"
                            title="Re-verify MX & Re-score"
                          >
                            {isEnriching ? "Enriching..." : "Enrich"}
                          </button>

                          {/* AI Personalize Outreach */}
                          <button
                            type="button"
                            onClick={() => onPersonalizeLead(lead)}
                            className="p-1.5 bg-indigo-950/70 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-800/60 hover:border-indigo-500 rounded-lg transition-all shadow-sm cursor-pointer"
                            title="Generate Ollama AI Cold Outreach"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => onDeleteLead(lead.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-300 bg-[#0a0d16] hover:bg-rose-950/60 border border-[#1e283d] hover:border-rose-900 rounded-lg transition-all cursor-pointer"
                            title="Remove lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Advanced Multi-Criteria Filter Drawer */}
      <AdvancedFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={advancedFilters}
        onChangeFilters={setAdvancedFilters}
        onResetFilters={() => setAdvancedFilters(initialAdvancedFilterState)}
        leads={leads}
      />
    </div>
  );
};
