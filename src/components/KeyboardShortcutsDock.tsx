import type React from "react";
import { useState, useEffect } from "react";
import { Keyboard, X, Sparkles, Activity, Shield, Search, RefreshCw } from "lucide-react";
import type { ActiveTab } from "../types";

interface KeyboardShortcutsDockProps {
  activeTab: ActiveTab;
  onSelectTab?: (tab: ActiveTab) => void;
  onSwitchTab?: (tab: ActiveTab) => void;
  onOpenActivityLog: () => void;
  onToggleAdminModal?: () => void;
  onOpenAdminConsole?: () => void;
  onRefreshData?: () => void;
  onFocusSearch?: () => void;
  onQuickSearch?: () => void;
  onOpenCommandPalette?: () => void;
  isDeveloperAdmin?: boolean;
}

export const KeyboardShortcutsDock: React.FC<KeyboardShortcutsDockProps> = ({
  activeTab,
  onSelectTab,
  onSwitchTab,
  onOpenActivityLog,
  onToggleAdminModal,
  onOpenAdminConsole,
  onRefreshData,
  onFocusSearch,
  onQuickSearch,
  onOpenCommandPalette,
  isDeveloperAdmin = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSelectTab = onSelectTab || onSwitchTab || (() => {});
  const handleToggleAdmin = onToggleAdminModal || onOpenAdminConsole;
  const handleSearch = onFocusSearch || onQuickSearch;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      ) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        handleSelectTab("leads");
      } else if (e.key === "2") {
        e.preventDefault();
        handleSelectTab("accounts");
      } else if (e.key === "3") {
        e.preventDefault();
        handleSelectTab("campaigns");
      } else if (e.key === "4") {
        e.preventDefault();
        handleSelectTab("deliverability");
      } else if (e.key === "5") {
        e.preventDefault();
        handleSelectTab("hygiene");
      } else if (e.key === "6") {
        e.preventDefault();
        handleSelectTab("ingest");
      } else if (e.key === "7") {
        e.preventDefault();
        handleSelectTab("discovery");
      } else if (e.key === "8") {
        e.preventDefault();
        handleSelectTab("exports");
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        onOpenActivityLog();
      } else if ((e.key === "a" || e.key === "A") && handleToggleAdmin) {
        e.preventDefault();
        handleToggleAdmin();
      } else if ((e.key === "r" || e.key === "R") && onRefreshData) {
        e.preventDefault();
        onRefreshData();
      } else if (e.key === "/" && handleSearch) {
        e.preventDefault();
        handleSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectTab, onOpenActivityLog, handleToggleAdmin, onRefreshData, handleSearch]);

  const shortcutGroups = [
    {
      title: "View Navigation",
      shortcuts: [
        { key: "1", label: "Pipeline Table", tab: "leads" as ActiveTab },
        { key: "2", label: "Account Directory", tab: "accounts" as ActiveTab },
        { key: "3", label: "Cold Email Studio", tab: "campaigns" as ActiveTab },
        { key: "4", label: "DNS Verification", tab: "deliverability" as ActiveTab },
        { key: "5", label: "Data Hygiene", tab: "hygiene" as ActiveTab },
        { key: "6", label: "Batch Ingestion", tab: "ingest" as ActiveTab },
        { key: "7", label: "Autonomous Prospecting", tab: "discovery" as ActiveTab },
        { key: "8", label: "CRM Exporter", tab: "exports" as ActiveTab }
      ]
    },
    {
      title: "Global Operations & Hotkeys",
      shortcuts: [
        { key: "⌘K", label: "Command Palette / Quick Search", action: onOpenCommandPalette, icon: Search },
        { key: "L", label: "Operator Activity Audit Trail", action: onOpenActivityLog, icon: Activity },
        { key: "R", label: "Sync & Refresh Telemetry", action: onRefreshData, icon: RefreshCw },
        { key: "/", label: "Quick Filter Search", action: handleSearch, icon: Search },
        ...(isDeveloperAdmin && handleToggleAdmin
          ? [{ key: "A", label: "Developer Admin Console", action: handleToggleAdmin, icon: Shield }]
          : []),
        { key: "?", label: "Toggle Shortcuts Cheatsheet", action: () => setIsOpen((prev) => !prev), icon: Keyboard },
        { key: "ESC", label: "Dismiss Modals / Clear Selection", icon: X }
      ]
    }
  ];

  return (
    <>
      {/* Floating Persistent Dock Bar */}
      <aside
        id="persistent-keyboard-dock"
        aria-label="Keyboard Shortcuts Quick Bar"
        className="fixed bottom-3 right-4 z-30 hidden md:flex items-center gap-1.5 bg-[#0f1523]/95 text-slate-200 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 shadow-lg text-xs transition-all hover:border-slate-600"
      >
        {!isMinimized ? (
          <>
            <div className="flex items-center gap-1.5 text-slate-400 font-medium pr-1.5 border-r border-slate-700">
              <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-[11px] text-slate-300">Hotkeys:</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelectTab("leads")}
                className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition ${
                  activeTab === "leads"
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                    : "hover:bg-slate-800 text-slate-300"
                }`}
                title="Press 1 for Leads Pipeline"
              >
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-indigo-300">
                  1
                </kbd>
                <span>Leads</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab("campaigns")}
                className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition ${
                  activeTab === "campaigns"
                    ? "bg-purple-600/30 text-purple-300 border border-purple-500/40"
                    : "hover:bg-slate-800 text-slate-300"
                }`}
                title="Press 3 for Cold Email Sequences"
              >
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-purple-300">
                  3
                </kbd>
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab("deliverability")}
                className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition ${
                  activeTab === "deliverability"
                    ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                    : "hover:bg-slate-800 text-slate-300"
                }`}
                title="Press 4 for DNS Deliverability"
              >
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-emerald-300">
                  4
                </kbd>
                <span>DNS</span>
              </button>

              <button
                type="button"
                onClick={onOpenActivityLog}
                className="px-1.5 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium hover:bg-slate-800 text-slate-300 transition ml-0.5"
                title="Press L for Activity Log"
              >
                <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-amber-300">
                  L
                </kbd>
                <span>Log</span>
              </button>
            </div>

            <div className="h-3 w-px bg-slate-700 mx-0.5" />

            <button
              type="button"
              id="btn-open-shortcuts-modal"
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-1 text-slate-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition text-[11px]"
              title="Open full keyboard cheatsheet (Press ?)"
            >
              <kbd className="px-1 py-0.2 bg-slate-800 border border-slate-600 rounded text-[10px] font-mono text-slate-200">
                ?
              </kbd>
              <span className="text-slate-400">All</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded ml-0.5"
              title="Minimize shortcut bar"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white py-0.5 px-1 font-mono text-[11px]"
            title="Expand keyboard shortcut bar"
          >
            <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hotkeys [?]</span>
          </button>
        )}
      </aside>

      {/* Full Modal Cheatsheet */}
      {isOpen && (
        <div
          id="keyboard-shortcuts-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-heading"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-[#0f1523] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0a0d16]/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Keyboard className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="shortcuts-heading" className="text-base font-semibold text-white tracking-tight">
                    LeadForge Keyboard Shortcuts Cheatsheet
                  </h2>
                  <p className="text-xs text-slate-400">
                    High-velocity navigation and control hotkeys for enterprise operators
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {shortcutGroups.map((group) => (
                <section key={group.title} className="space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.shortcuts.map((sc) => (
                      <button
                        type="button"
                        key={`${group.title}-${sc.key}-${sc.label}`}
                        onClick={() => {
                          if ("tab" in sc && sc.tab) {
                            handleSelectTab(sc.tab);
                            setIsOpen(false);
                          } else if ("action" in sc && sc.action) {
                            sc.action();
                            setIsOpen(false);
                          }
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#151c2e]/60 border border-[#1e283d] hover:bg-[#151c2e] hover:border-indigo-500/40 transition cursor-pointer group text-left"
                      >
                        <span className="text-xs text-slate-300 group-hover:text-white font-medium">{sc.label}</span>
                        <kbd className="px-2 py-0.5 bg-[#0a0d16] border border-[#1e283d] rounded font-mono text-[11px] font-semibold text-indigo-400 shadow-sm">
                          {sc.key}
                        </kbd>
                      </button>
                    ))}
                  </div>
                </section>
              ))}

              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-indigo-200/90 leading-relaxed">
                  <strong>Pro-Tip:</strong> Press{" "}
                  <kbd className="px-1.5 py-0.2 bg-[#0a0d16] border border-slate-700 rounded text-[10px] font-mono text-indigo-300">
                    ⌘K
                  </kbd>{" "}
                  anywhere to open the unified search & action command palette, or press{" "}
                  <kbd className="px-1.5 py-0.2 bg-[#0a0d16] border border-slate-700 rounded text-[10px] font-mono text-amber-300">
                    L
                  </kbd>{" "}
                  to inspect the live Operator Audit Trail.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-800 bg-[#0a0d16]/80 flex items-center justify-between text-xs text-slate-400">
              <span>
                Press{" "}
                <kbd className="px-1.5 py-0.5 bg-[#151c2e] border border-slate-700 rounded text-[10px] font-mono">
                  ESC
                </kbd>{" "}
                to close
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
