import type React from "react";
import { useState, useMemo } from "react";
import type { Account, Lead } from "../types";
import { Building2, Users, DollarSign, Search, ExternalLink, Plus, Layers, ArrowRight } from "lucide-react";

interface AccountDirectoryViewProps {
  accounts: Account[];
  leads: Lead[];
  onNavigateToLeads: (searchFilter?: string) => void;
  onNavigateToIngest: () => void;
}

export const AccountDirectoryView: React.FC<AccountDirectoryViewProps> = ({
  accounts,
  leads,
  onNavigateToLeads,
  onNavigateToIngest
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("all");
  const [selectedSize, setSelectedSize] = useState("all");

  // Derive unique industries
  const industries = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => {
      if (a.industry) set.add(a.industry);
    });
    return Array.from(set).sort();
  }, [accounts]);

  // Associate leads with accounts
  const accountsWithMetrics = useMemo(() => {
    return accounts.map((acc) => {
      const associatedLeads = leads.filter(
        (l) => l.accountId === acc.id || l.companyDomain?.toLowerCase() === acc.domain?.toLowerCase()
      );
      const qualifiedCount = associatedLeads.filter((l) => l.isQualified).length;
      return {
        ...acc,
        leadsCount: associatedLeads.length,
        qualifiedCount,
        leads: associatedLeads
      };
    });
  }, [accounts, leads]);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accountsWithMetrics.filter((acc) => {
      const matchesSearch =
        searchQuery === "" ||
        acc.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.industry?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesIndustry = selectedIndustry === "all" || acc.industry === selectedIndustry;

      const matchesSize =
        selectedSize === "all" ||
        (selectedSize === "enterprise" && (acc.employeeCount || 0) >= 1000) ||
        (selectedSize === "midmarket" && (acc.employeeCount || 0) >= 100 && (acc.employeeCount || 0) < 1000) ||
        (selectedSize === "smb" && (acc.employeeCount || 0) < 100);

      return matchesSearch && matchesIndustry && matchesSize;
    });
  }, [accountsWithMetrics, searchQuery, selectedIndustry, selectedSize]);

  const formatRevenue = (rev?: number) => {
    if (!rev) return "Not disclosed";
    if (rev >= 1000000000) return `$${(rev / 1000000000).toFixed(1)}B`;
    if (rev >= 1000000) return `$${(rev / 1000000).toFixed(0)}M`;
    return `$${(rev / 1000).toFixed(0)}k`;
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Banner / Summary */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Account Directory</h1>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Centralized firmographic intelligence, key contact coverage, and buying-committee health across your
              target accounts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onNavigateToIngest}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Import New Accounts</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-[#1e283d]">
          <div className="p-3.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Target Accounts</span>
            <span className="text-xl font-bold text-white font-mono mt-0.5 block tabular-nums">{accounts.length}</span>
          </div>
          <div className="p-3.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Synced Decision Makers</span>
            <span className="text-xl font-bold text-indigo-400 font-mono mt-0.5 block tabular-nums">
              {leads.length}
            </span>
          </div>
          <div className="p-3.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Enterprise Tier (1,000+ Emp)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono mt-0.5 block tabular-nums">
              {accounts.filter((a) => (a.employeeCount || 0) >= 1000).length}
            </span>
          </div>
          <div className="p-3.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]">
            <span className="text-[11px] text-slate-400 block font-medium">Avg Fit Score</span>
            <span className="text-xl font-bold text-amber-400 font-mono mt-0.5 block tabular-nums">
              {leads.length > 0
                ? `${(leads.reduce((acc, l) => acc + l.fitScore, 0) / leads.length).toFixed(1)}/100`
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts by name or domain..."
            className="w-full bg-[#0a0d16] border border-[#1e283d] rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <select
            value={selectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            className="bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Company Sizes</option>
            <option value="enterprise">Enterprise (1,000+)</option>
            <option value="midmarket">Mid-Market (100 - 999)</option>
            <option value="smb">SMB (&lt; 100)</option>
          </select>
        </div>
      </div>

      {/* Account Cards Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-12 text-center space-y-3">
          <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No matching accounts found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or filters, or add new accounts using the import tool.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSelectedIndustry("all");
              setSelectedSize("all");
            }}
            className="px-4 py-2 bg-[#151c2e] hover:bg-[#1e283d] text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="bg-[#0f1523] border border-[#1e283d] hover:border-indigo-500/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all group"
            >
              <div className="space-y-4">
                {/* Account Title & Domain */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-900/40 to-[#0a0d16] border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold font-mono text-sm shadow-sm group-hover:scale-105 transition-transform">
                      {account.companyName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                        {account.companyName}
                      </h3>
                      <a
                        href={`https://${account.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-indigo-400 flex items-center space-x-1 font-mono transition"
                      >
                        <span>{account.domain}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500" />
                      </a>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#0a0d16] text-slate-300 border border-[#1e283d] rounded-md">
                    {account.industry?.split(" ")[0] || "SaaS"}
                  </span>
                </div>

                {/* Firmographic Highlights */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]/60">
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[10px]">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>Employees</span>
                    </div>
                    <span className="text-slate-200 font-mono font-bold mt-0.5 block">
                      {account.employeeCount ? `${account.employeeCount.toLocaleString()} team` : "Growth"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0a0d16] rounded-xl border border-[#1e283d]/60">
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[10px]">
                      <DollarSign className="w-3 h-3 text-emerald-400" />
                      <span>Revenue</span>
                    </div>
                    <span className="text-emerald-300 font-mono font-bold mt-0.5 block">
                      {formatRevenue(account.annualRevenueUsd)}
                    </span>
                  </div>
                </div>

                {/* Decision Maker Coverage */}
                <div className="p-3 bg-[#0a0d16] rounded-xl border border-[#1e283d]/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center space-x-1.5">
                      <Layers className="w-3 h-3 text-indigo-400" />
                      <span>Buying Committee</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {account.leadsCount} {account.leadsCount === 1 ? "Contact" : "Contacts"}
                    </span>
                  </div>

                  {account.leads.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-[#1e283d]/50">
                      {account.leads.slice(0, 2).map((l) => (
                        <div key={l.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 truncate max-w-[140px]">
                            {l.firstName} {l.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{l.jobTitle}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">No contacts synced yet.</p>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-2 border-t border-[#1e283d]/60 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">{account.qualifiedCount} Qualified ICP</span>
                <button
                  type="button"
                  onClick={() => onNavigateToLeads(account.companyName)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 transition cursor-pointer group-hover:translate-x-0.5"
                >
                  <span>View Pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
