import type React from "react";
import { useEffect, useRef, useMemo, useState } from "react";
import type { Lead, SeniorityLevel } from "../types";
import { TrendingUp, BarChart3, ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import Chart from "chart.js/auto";


export interface SegmentFilter {
  type: "stage" | "seniority" | "deliverability" | "qualified" | "search" | "score";
  value: string | number | boolean;
  label: string;
}


interface SeniorityChartEntry {
  name: string;
  key: SeniorityLevel;
  count: number;
  fill: string;
}

interface LeadAnalyticsChartProps {
  leads: Lead[];
  activeSegmentFilter?: SegmentFilter | null;
  onFilterSegment?: (segment: SegmentFilter | null) => void;
}

export const LeadAnalyticsChart: React.FC<LeadAnalyticsChartProps> = ({
  leads,
  activeSegmentFilter,
  onFilterSegment
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [chartView, setChartView] = useState<"trends" | "seniority">("trends");
  const trendChartRef = useRef<HTMLCanvasElement>(null);
  const seniorityChartRef = useRef<HTMLCanvasElement>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  const seniorityChartInstance = useRef<Chart | null>(null);

  // 1. Chronological qualification trends
  const trendData = useMemo(() => {
    if (leads.length === 0) return [];

    const groups: { [date: string]: { total: number; qualified: number; disqualified: number; verified: number } } = {};

    const sortedLeads = [...leads].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    sortedLeads.forEach((lead) => {
      const date = new Date(lead.createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      });
      if (!groups[date]) {
        groups[date] = { total: 0, qualified: 0, disqualified: 0, verified: 0 };
      }
      groups[date].total += 1;
      if (lead.isQualified) groups[date].qualified += 1;
      if (
        lead.stage === "disqualified" ||
        lead.verificationStatus === "disposable" ||
        lead.verificationStatus === "invalid"
      ) {
        groups[date].disqualified += 1;
      }
      if (lead.verificationStatus === "mailbox_accepted") {
        groups[date].verified += 1;
      }
    });

    const dates = Object.keys(groups);
    return dates.map((date) => ({
      date,
      total: groups[date].total,
      qualified: groups[date].qualified,
      disqualified: groups[date].disqualified,
      verified: groups[date].verified
    }));
  }, [leads]);

  // 2. Seniority tier breakdown
  const seniorityDistribution = useMemo(() => {
    const counts: { [k: string]: number } = {
      c_level: 0,
      vp: 0,
      director: 0,
      manager: 0,
      individual_contributor: 0
    };

    leads.forEach((l) => {
      const s = l.seniority || "individual_contributor";
      counts[s] = (counts[s] || 0) + 1;
    });

    return [
      { name: "C-Suite", key: "c_level" as SeniorityLevel, count: counts.c_level, fill: "#a855f7" },
      { name: "VP / Head of", key: "vp" as SeniorityLevel, count: counts.vp, fill: "#6366f1" },
      { name: "Director", key: "director" as SeniorityLevel, count: counts.director, fill: "#3b82f6" },
      { name: "Manager", key: "manager" as SeniorityLevel, count: counts.manager, fill: "#14b8a6" },
      {
        name: "Staff / IC",
        key: "individual_contributor" as SeniorityLevel,
        count: counts.individual_contributor,
        fill: "#64748b"
      }
    ];
  }, [leads]);

  const totalQualified = leads.filter((l) => l.isQualified).length;
  const qualificationRate = leads.length > 0 ? Math.round((totalQualified / leads.length) * 100) : 0;

  // Render trend chart
  useEffect(() => {
    if (!isExpanded || chartView !== "trends" || !trendChartRef.current || trendData.length === 0) return;

    if (trendChartInstance.current) {
      trendChartInstance.current.destroy();
    }

    const ctx = trendChartRef.current.getContext("2d");
    if (!ctx) return;

    trendChartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: trendData.map((d) => d.date),
        datasets: [
          {
            label: "Total Ingested",
            data: trendData.map((d) => d.total),
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#6366f1",
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBorderWidth: 0
          },
          {
            label: "ICP Qualified",
            data: trendData.map((d) => d.qualified),
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#10b981",
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBorderWidth: 0
          },
          {
            label: "Valid MX",
            data: trendData.map((d) => d.verified),
            borderColor: "#06b6d4",
            backgroundColor: "rgba(6, 182, 212, 0.1)",
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#06b6d4",
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBorderWidth: 0,
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(10, 13, 22, 0.95)",
            borderColor: "#1e283d",
            borderWidth: 1,
            titleColor: "#94a3b8",
            bodyColor: "#f8fafc",
            padding: 12,
            titleFont: { size: 12, weight: "bold" },
            bodyFont: { size: 11, family: "monospace" },
            caretSize: 5,
            displayColors: true,
            callbacks: {
              afterLabel: () => "Click to filter pipeline table"
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: "transparent"
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 }
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: "#1e283d"
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 },
              stepSize: Math.ceil((Math.max(...trendData.map((d) => d.total)) || 10) / 5)
            }
          }
        }
      },
      plugins: [
        {
          id: "customCanvasBackgroundColor",
          beforeDraw: (chart) => {
            const { ctx } = chart;
            ctx.save();
            ctx.globalCompositeOperation = "destination-over";
            ctx.fillStyle = "transparent";
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
          }
        }
      ]
    });

    return () => {
      if (trendChartInstance.current) {
        trendChartInstance.current.destroy();
      }
    };
  }, [isExpanded, chartView, trendData]);

  // Render seniority chart
  useEffect(() => {
    if (!isExpanded || chartView !== "seniority" || !seniorityChartRef.current) return;

    if (seniorityChartInstance.current) {
      seniorityChartInstance.current.destroy();
    }

    const ctx = seniorityChartRef.current.getContext("2d");
    if (!ctx) return;

    seniorityChartInstance.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: seniorityDistribution.map((d) => d.name),
        datasets: [
          {
            label: "Prospects",
            data: seniorityDistribution.map((d) => d.count),
            backgroundColor: seniorityDistribution.map((d) => d.fill),
            borderColor: seniorityDistribution.map((d) =>
              activeSegmentFilter?.type === "seniority" && activeSegmentFilter.value === d.key ? "#ffffff" : "transparent"
            ),
            borderWidth: 2,
            borderRadius: 6,
            hoverBackgroundColor: seniorityDistribution.map((d) => d.fill)
          }
        ]
      },
      options: {
        indexAxis: "x",
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(10, 13, 22, 0.95)",
            borderColor: "#1e283d",
            borderWidth: 1,
            titleColor: "#94a3b8",
            bodyColor: "#f8fafc",
            padding: 12,
            titleFont: { size: 12, weight: "bold" },
            bodyFont: { size: 11, family: "monospace" },
            caretSize: 5
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: "transparent"
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 }
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: "#1e283d"
            },
            ticks: {
              color: "#64748b",
              font: { size: 11 }
            }
          }
        }
      }
    });

    return () => {
      if (seniorityChartInstance.current) {
        seniorityChartInstance.current.destroy();
      }
    };
  }, [isExpanded, chartView, seniorityDistribution, activeSegmentFilter]);

  const handleSeniorityClick = (entry: SeniorityChartEntry) => {
    if (!onFilterSegment) return;
    if (!entry?.key) return;

    if (activeSegmentFilter?.type === "seniority" && activeSegmentFilter.value === entry.key) {
      onFilterSegment(null);
    } else {
      onFilterSegment({
        type: "seniority",
        value: entry.key,
        label: `Seniority: ${entry.name}`
      });
    }
  };

  return (
    <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl shadow-card-subtle overflow-hidden">
      {/* Header & View Controls */}
      <div className="p-4 sm:px-6 border-b border-[#1e283d] flex flex-wrap items-center justify-between gap-3 bg-[#0f1523]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-950/80 text-indigo-400 border border-indigo-800/40 rounded-xl">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Lead Pipeline Analytics & Qualification Trends
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                {qualificationRate}% Overall ICP Conversion
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive analytics dashboard. Click on chart bars or trend lines to instantly segment the prospect roster.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Active Segment Filter Banner Indicator */}
          {activeSegmentFilter && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-950/90 border border-indigo-700 rounded-lg text-xs font-mono text-indigo-300">
              <Filter className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate max-w-[130px]">{activeSegmentFilter.label}</span>
              <button
                type="button"
                onClick={() => onFilterSegment?.(null)}
                className="hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Clear segment filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-[#0a0d16] border border-[#1e283d] rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setChartView("trends")}
              title="Display lead qualification and deliverability trends over time"
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                chartView === "trends" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Qualification Trends</span>
            </button>
            <button
              type="button"
              onClick={() => setChartView("seniority")}
              title="Display decision maker seniority breakdown"
              className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                chartView === "seniority" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Seniority</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white bg-[#0a0d16] border border-[#1e283d] rounded-xl transition cursor-pointer"
            title={isExpanded ? "Collapse analytics visualization" : "Expand analytics visualization"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {isExpanded && (
        <div className="p-5 sm:p-6 bg-[#0c101d]/60">
          {chartView === "trends" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="flex items-center gap-1.5">
                  <span>Chronological Lead Qualification & Deliverability Trends</span>
                  <span className="text-[10px] text-slate-500 font-mono">(Click curve to filter)</span>
                </span>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => onFilterSegment?.(null)}
                    className="flex items-center space-x-1.5 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                    <span>All Leads ({leads.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onFilterSegment?.({
                        type: "qualified",
                        value: true,
                        label: "ICP Qualified Leads"
                      })
                    }
                    className="flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span>ICP Qualified ({totalQualified})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onFilterSegment?.({
                        type: "deliverability",
                        value: "mailbox_accepted",
                        label: "SMTP-Accepted Leads Only"
                      })
                    }
                    className="flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    <span>
                      SMTP Accepted ({leads.filter((l) => l.verificationStatus === "mailbox_accepted").length})
                    </span>
                  </button>
                </div>
              </div>

              <div className="h-64 w-full relative">
                <canvas ref={trendChartRef} style={{ display: "block" }} />
              </div>
            </div>
          )}

          {chartView === "seniority" && (
            <div className="space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Prospect Seniority & Decision-Maker Classification</span>
                <span className="text-[11px] text-indigo-400 font-mono">
                  Click any bar to filter LeadTable by seniority
                </span>
              </div>

              <div className="h-60 w-full relative">
                <canvas ref={seniorityChartRef} style={{ display: "block" }} />
              </div>

              {/* Quick Seniority Click Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1e283d]">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Quick Filter:</span>
                {seniorityDistribution.map((item) => {
                  const isSelected =
                    activeSegmentFilter?.type === "seniority" && activeSegmentFilter.value === item.key;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => handleSeniorityClick(item)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? "bg-indigo-600 text-white font-bold shadow-sm"
                          : "bg-[#0a0d16] border border-[#1e283d] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }}></span>
                      <span>{item.name}</span>
                      <span className="text-slate-500 text-[10px]">({item.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
