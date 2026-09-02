import type React from "react";
import { useState, useRef, useEffect } from "react";
import type { ActiveTab, SystemHealth, AuthUser } from "../types";
import {
  Layers,
  UploadCloud,
  Send,
  Sparkles,
  RefreshCw,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Activity,
  ShieldCheck,
  Mail,
  FileCheck,
  Zap,
  Globe,
  Radar
} from "lucide-react";

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  health: SystemHealth | null;
  totalLeads: number;
  qualifiedCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenCommandPalette: () => void;
  currentUser: AuthUser | null;
  onOpenAdminConsole: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalLeads,
  qualifiedCount,
  onRefresh,
  isRefreshing,
  onOpenCommandPalette,
  currentUser,
  onOpenAdminConsole,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const tabs: {
    id: ActiveTab;
    label: string;
    description: string;
    shortcut: string;
    icon: React.ReactNode;
    badge?: string | number;
  }[] = [
    {
      id: "leads",
      label: "Lead Pipeline",
      description: "Filter, sort & manage B2B prospect records",
      shortcut: "1",
      icon: <Layers className="w-3.5 h-3.5" />,
      badge: totalLeads
    },
    {
      id: "accounts",
      label: "Account Directory",
      description: "Enriched enterprise accounts & firmographics",
      shortcut: "2",
      icon: <UploadCloud className="w-3.5 h-3.5" />
    },
    {
      id: "discovery",
      label: "Autonomous Prospecting",
      description: "Continuously discover evidence-qualified prospects",
      shortcut: "7",
      icon: <Radar className="w-3.5 h-3.5 text-fuchsia-400" />
    },
    {
      id: "campaigns",
      label: "Cold Email Studio",
      description: "Multi-step email cadence builder, Spintax & Ollama copywriter",
      shortcut: "3",
      icon: <Mail className="w-3.5 h-3.5 text-purple-400" />
    },
    {
      id: "deliverability",
      label: "DNS Verification",
      description: "Live MX, SPF, and DMARC domain checks",
      shortcut: "4",
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
    },
    {
      id: "hygiene",
      label: "Data Hygiene",
      description: "Audit duplicate emails, invalid syntax & purge stale leads",
      shortcut: "5",
      icon: <FileCheck className="w-3.5 h-3.5 text-teal-400" />
    },
    {
      id: "ingest",
      label: "Batch Ingest",
      description: "CSV & JSON payload importer with fuzzy duplicate detection",
      shortcut: "6",
      icon: <Zap className="w-3.5 h-3.5 text-amber-400" />
    },
    {
      id: "exports",
      label: "CRM & Webhook",
      description: "Export datasets & dispatch live webhooks",
      shortcut: "8",
      icon: <Send className="w-3.5 h-3.5" />
    },
    {
      id: "signals",
      label: "Web Scraper",
      description: "Live webpage signal & tech-stack extraction",
      shortcut: "0",
      icon: <Globe className="w-3.5 h-3.5 text-sky-400" />
    }
  ];

  const isDevAdmin = currentUser?.role === "developer_admin" || currentUser?.isDeveloper;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "AV";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="Header border-b border-[#1e283d] bg-[#0f1523]/95 backdrop-blur-md shadow-header sticky top-0 z-30 shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar: Brand & Utilities */}
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
              <span className="text-white font-black text-sm tracking-tight">LF</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold tracking-tight text-white">
                  LeadForge <span className="text-indigo-400 font-medium">Operator</span>
                </span>
                <span className="bg-indigo-950/80 text-indigo-400 border border-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium">
                  live data
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight mt-0.5">
                All-in-One B2B Lead Generator, DNS Validator & Cold Email Outreach Engine
              </p>
            </div>
          </div>

          {/* Quick Metrics & Engine Status */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Quick Command Palette Search Button */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="flex items-center space-x-2 bg-[#0a0d16] hover:bg-[#151c2e] border border-[#1e283d] hover:border-indigo-500/50 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer shadow-sm group"
              title="Open Navigation & Actions Palette (Cmd+K)"
            >
              <Search className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline text-[11px] font-medium">Quick Search</span>
              <kbd className="hidden sm:inline font-mono text-[10px] bg-[#151c2e] border border-[#1e283d] px-1.5 py-0.5 rounded text-slate-400 font-semibold">
                ⌘K
              </kbd>
            </button>

            <div className="hidden lg:flex items-center space-x-3 bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3.5 py-1.5 text-xs font-mono">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-sans text-[11px]">Pipeline:</span>
                <span className="font-bold text-white tabular-nums">{totalLeads}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400 font-sans text-[11px]">Qualified:</span>
                <span className="font-bold text-emerald-400 tabular-nums">{qualifiedCount}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-purple-300 font-medium text-[11px]">Ollama Cloud</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2 text-slate-400 hover:text-white hover:bg-[#151c2e] rounded-xl transition-colors border border-[#1e283d] flex items-center justify-center cursor-pointer shadow-sm"
                title="Refresh Pipeline"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-400" : ""}`} />
              </button>

              {/* User Profile & Workspace Settings Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-1.5 bg-[#0a0d16] hover:bg-[#151c2e] border border-[#1e283d] hover:border-slate-600 rounded-xl transition cursor-pointer"
                  title="Workspace Profile & Settings"
                >
                  <div className="h-7 w-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                    {getInitials(currentUser?.name)}
                  </div>
                  <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[100px] truncate">
                    {currentUser?.name?.split(" ")[0] || "Alex"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#0f1523] border border-[#1e283d] rounded-2xl shadow-2xl overflow-hidden py-1.5 z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-[#1e283d] bg-[#0a0d16]">
                      <p className="text-xs font-bold text-white truncate">{currentUser?.name || "Dustin Hill"}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {currentUser?.email || "Gofastkickass@gmail.com"}
                      </p>
                      <div className="mt-2">
                        <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md uppercase">
                          {isDevAdmin ? "Workspace Administrator" : "Revenue Operations"}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      {isDevAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenAdminConsole();
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-[#151c2e] hover:text-white flex items-center space-x-2.5 transition cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-indigo-400" />
                          <span>Workspace Administration</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab("campaigns");
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-[#151c2e] hover:text-white flex items-center space-x-2.5 transition cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-purple-400" />
                        <span>Cold Email Sequences</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setActiveTab("deliverability");
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-[#151c2e] hover:text-white flex items-center space-x-2.5 transition cursor-pointer"
                      >
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span>DNS Verification</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenCommandPalette();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-[#151c2e] hover:text-white flex items-center space-x-2.5 transition cursor-pointer"
                      >
                        <Search className="w-4 h-4 text-slate-400" />
                        <div className="flex items-center justify-between flex-1">
                          <span>Command Palette</span>
                          <span className="text-[10px] font-mono text-slate-500">⌘K</span>
                        </div>
                      </button>
                    </div>

                    <div className="border-t border-[#1e283d] pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center space-x-2.5 transition cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation - 8 Core Modules */}
        <nav
          className="flex items-center space-x-1 overflow-x-auto no-scrollbar w-full pt-1 border-t border-[#1e283d]/80 pb-0.5"
          aria-label="Main Navigation"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.description}
                className={`flex items-center justify-center space-x-1.5 py-2 px-3 text-xs font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer group flex-1 shrink-0 ${
                  isActive
                    ? "border-indigo-500 text-indigo-300 bg-[#151c2e]"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#151c2e]/50"
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
                <span
                  className={`text-[9px] font-mono font-medium px-1 rounded transition-opacity opacity-50 group-hover:opacity-100 hidden xl:inline ${
                    isActive ? "text-indigo-400" : "text-slate-500"
                  }`}
                >
                  {tab.shortcut}
                </span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 text-[9px] font-mono font-medium rounded-full tabular-nums ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-[#0a0d16] text-slate-400 border border-[#1e283d]"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
