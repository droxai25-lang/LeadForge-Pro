import type React from "react";
import { useState, useEffect, useRef } from "react";
import type { ActiveTab, Lead } from "../types";
import {
  Search,
  Layers,
  UploadCloud,
  ShieldCheck,
  Send,
  RefreshCw,
  Download,
  Building,
  User,
  X,
  Radar
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onRefresh: () => void;
}

interface CommandItem {
  id: string;
  category: "Navigation" | "Action" | "Lead";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  leads,
  onSelectLead,
  onRefresh
}) => {
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Generate list of command items
  const commands: CommandItem[] = [
    // Navigation Items
    {
      id: "nav-leads",
      category: "Navigation",
      title: "Lead Pipeline",
      subtitle: "View, filter, sort and manage all synced B2B prospects",
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      shortcut: "1",
      action: () => {
        setActiveTab("leads");
        onClose();
      }
    },
    {
      id: "nav-accounts",
      category: "Navigation",
      title: "Account Directory",
      subtitle: "Target enterprise accounts, firmographics, and buying-committee health",
      icon: <Building className="w-4 h-4 text-indigo-400" />,
      shortcut: "2",
      action: () => {
        setActiveTab("accounts");
        onClose();
      }
    },
    {
      id: "nav-discovery",
      category: "Navigation",
      title: "Autonomous Prospecting",
      subtitle: "Find real companies and named decision-makers with an explicit Hunter lookup budget",
      icon: <Radar className="w-4 h-4 text-fuchsia-400" />,
      shortcut: "7",
      action: () => {
        setActiveTab("discovery");
        onClose();
      }
    },
    {
      id: "nav-campaigns",
      category: "Navigation",
      title: "Cold Email Studio & Sequences",
      subtitle: "Multi-step cadences, Spintax rotator, spam word scanner & Ollama copywriter",
      icon: <Send className="w-4 h-4 text-purple-400" />,
      shortcut: "3",
      action: () => {
        setActiveTab("campaigns");
        onClose();
      }
    },
    {
      id: "nav-deliverability",
      category: "Navigation",
      title: "DNS Verification",
      subtitle: "Live MX, SPF, and DMARC domain checks",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      shortcut: "4",
      action: () => {
        setActiveTab("deliverability");
        onClose();
      }
    },
    {
      id: "nav-hygiene",
      category: "Navigation",
      title: "Data Hygiene & Audit",
      subtitle: "Scan duplicate emails, invalid domain syntax, disposable domains & purge stale records",
      icon: <ShieldCheck className="w-4 h-4 text-teal-400" />,
      shortcut: "5",
      action: () => {
        setActiveTab("hygiene");
        onClose();
      }
    },
    {
      id: "nav-ingest",
      category: "Navigation",
      title: "Batch Lead Importer (CSV / JSON / Manual)",
      subtitle: "Ingest single prospects or bulk CSV/JSON payloads with fuzzy deduplication",
      icon: <UploadCloud className="w-4 h-4 text-amber-400" />,
      shortcut: "6",
      action: () => {
        setActiveTab("ingest");
        onClose();
      }
    },
    {
      id: "nav-exports",
      category: "Navigation",
      title: "CRM & Webhook Sync",
      subtitle: "Download CSV datasets or dispatch live HTTP webhook streams",
      icon: <Send className="w-4 h-4 text-indigo-400" />,
      shortcut: "8",
      action: () => {
        setActiveTab("exports");
        onClose();
      }
    },

    // Quick Actions
    {
      id: "act-refresh",
      category: "Action",
      title: "Refresh Pipeline & Diagnostics",
      subtitle: "Query live backend health and reload prospects",
      icon: <RefreshCw className="w-4 h-4 text-indigo-400" />,
      shortcut: "R",
      action: () => {
        onRefresh();
        onClose();
      }
    },
    {
      id: "act-export-qualified",
      category: "Action",
      title: "Export ICP Qualified Leads",
      subtitle: "Jump to CRM dispatcher with qualified scope",
      icon: <Download className="w-4 h-4 text-emerald-400" />,
      action: () => {
        setActiveTab("exports");
        onClose();
      }
    }
  ];

  // If user types a search query, search leads matching query
  const matchingLeads: CommandItem[] = search.trim()
    ? leads
        .filter((lead) => {
          const q = search.toLowerCase();
          return (
            lead.firstName.toLowerCase().includes(q) ||
            lead.lastName.toLowerCase().includes(q) ||
            lead.email.toLowerCase().includes(q) ||
            lead.companyName.toLowerCase().includes(q) ||
            lead.jobTitle.toLowerCase().includes(q)
          );
        })
        .slice(0, 5)
        .map((lead) => ({
          id: `lead-${lead.id}`,
          category: "Lead",
          title: `${lead.firstName} ${lead.lastName}`,
          subtitle: `${lead.jobTitle} at ${lead.companyName} (${lead.email})`,
          icon: <User className="w-4 h-4 text-indigo-400" />,
          action: () => {
            onSelectLead(lead);
            onClose();
          }
        }))
    : [];

  const filteredCommands = [
    ...commands.filter((cmd) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return cmd.title.toLowerCase().includes(q) || cmd.subtitle?.toLowerCase().includes(q);
    }),
    ...matchingLeads
  ];

  // Handle keyboard navigation inside command palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    // Keep selected index within bounds
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-label="Close command palette"
      />

      {/* Palette Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl bg-[#0f1523] border border-[#1e283d] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Search input header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#1e283d] bg-[#0a0d16]/80">
          <Search className="w-4 h-4 text-indigo-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a tab name, action, or prospect name / company..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="p-1 text-slate-400 hover:text-white rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="ml-2 flex items-center space-x-1">
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-[#151c2e] border border-[#1e283d] rounded text-slate-400">
              ESC
            </span>
          </div>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 divide-y divide-[#1e283d]/40">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No matching tabs, actions, or prospects found for "{search}"
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  type="button"
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition text-xs text-left ${
                    isSelected ? "bg-indigo-600 text-white shadow-sm" : "text-slate-300 hover:bg-[#151c2e]"
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected ? "bg-white/20 text-white" : "bg-[#0a0d16] border border-[#1e283d]"
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold flex items-center space-x-2">
                        <span>{cmd.title}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-[#0a0d16] text-slate-400 border border-[#1e283d]"
                          }`}
                        >
                          {cmd.category}
                        </span>
                      </div>
                      {cmd.subtitle && (
                        <div
                          className={`text-[11px] truncate mt-0.5 ${isSelected ? "text-indigo-100" : "text-slate-400"}`}
                        >
                          {cmd.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {cmd.shortcut && (
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ml-2 shrink-0 ${
                        isSelected
                          ? "bg-white/20 border-white/30 text-white"
                          : "bg-[#0a0d16] border-[#1e283d] text-slate-400"
                      }`}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#0a0d16] border-t border-[#1e283d] flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="px-1 py-0.5 bg-[#151c2e] border border-[#1e283d] rounded text-slate-300">↑</kbd>{" "}
              <kbd className="px-1 py-0.5 bg-[#151c2e] border border-[#1e283d] rounded text-slate-300">↓</kbd> to
              navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-[#151c2e] border border-[#1e283d] rounded text-slate-300">↵</kbd> to select
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-[#151c2e] border border-[#1e283d] rounded text-slate-300">1-5</kbd> direct
              tab
            </span>
          </div>
          <span className="text-indigo-400 font-sans font-semibold">LeadForge Navigator</span>
        </div>
      </div>
    </div>
  );
};
