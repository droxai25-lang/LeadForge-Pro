import type React from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { Lead, Campaign, EmailStep } from "../types";
import { useRef } from "react";
import {
  Mail,
  Sparkles,
  Send,
  Plus,
  Trash2,
  Play,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Split,
  Calendar,
  Layers,
  Eye,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
  Inbox
} from "lucide-react";

const SPAM_TRIGGER_WORDS = [
  {
    word: "100% free",
    category: "Deceptive Free",
    severity: "high",
    suggestion: "complimentary / included"
  },
  {
    word: "free $$$",
    category: "Spam Symbols",
    severity: "high",
    suggestion: "incentive"
  },
  {
    word: "guaranteed",
    category: "Overpromise",
    severity: "high",
    suggestion: "engineered / projected"
  },
  {
    word: "act now",
    category: "Urgency Pressure",
    severity: "high",
    suggestion: "when you have a moment"
  },
  {
    word: "risk-free",
    category: "Overpromise",
    severity: "medium",
    suggestion: "low friction"
  },
  {
    word: "risk free",
    category: "Overpromise",
    severity: "medium",
    suggestion: "low friction"
  },
  {
    word: "click here",
    category: "Suspicious Link",
    severity: "high",
    suggestion: "feel free to check"
  },
  {
    word: "buy now",
    category: "Aggressive Pitch",
    severity: "high",
    suggestion: "explore options"
  },
  {
    word: "order now",
    category: "Aggressive Pitch",
    severity: "high",
    suggestion: "get started"
  },
  {
    word: "no catch",
    category: "Deceptive",
    severity: "medium",
    suggestion: "transparent"
  },
  {
    word: "winner",
    category: "Spam Cliché",
    severity: "high",
    suggestion: "selected partner"
  },
  {
    word: "unlimited",
    category: "Overpromise",
    severity: "medium",
    suggestion: "scalable"
  },
  {
    word: "urgent",
    category: "Artificial Urgency",
    severity: "medium",
    suggestion: "timely"
  },
  {
    word: "make money",
    category: "Financial Spam",
    severity: "high",
    suggestion: "accelerate revenue"
  }
];

function evaluateSpintax(text: string, seed = 0): string {
  if (!text) return "";
  return text.replace(/\{([^{}]+)\}/g, (_, choices: string) => {
    const parts = choices.split("|");
    return parts[seed % parts.length].trim();
  });
}

function replaceTags(text: string, lead: Lead): string {
  if (!text) return "";
  return text
    .replace(/\{\{firstName\}\}/gi, lead.firstName || "[missing first name]")
    .replace(/\{\{lastName\}\}/gi, lead.lastName || "")
    .replace(/\{\{companyName\}\}/gi, lead.companyName || "[missing company name]")
    .replace(/\{\{companyDomain\}\}/gi, lead.companyDomain || "[missing company domain]")
    .replace(/\{\{jobTitle\}\}/gi, lead.jobTitle || "[missing job title]")
    .replace(/\{\{industry\}\}/gi, lead.industry || "[industry not available]")
    .replace(/\{\{seniority\}\}/gi, (lead.seniority || "").replace("_", " "));
}

interface TelemetryMetrics {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
}

interface OutboundDispatchRecord {
  id: string;
  recipientEmail: string;
  subject: string;
  status: string;
  opensCount: number;
  clicksCount: number;
  sentAt?: string;
  createdAt: string;
  errorMessage?: string;
}

interface MailboxSummary {
  id: string;
  email: string;
  senderName: string;
  status: string;
  sentTodayCount: number;
  dailySendLimit: number;
}

interface CampaignsViewProps {
  leads: Lead[];
  onRefreshPipeline?: () => void;
  pendingHook?: string | null;
  onPendingHookApplied?: () => void;
}

interface DeliveryReadiness {
  smtpSendingEnabled: boolean;
  appUrlValid: boolean;
  unsubscribeSecretStrong: boolean;
  deliveryWebhookSecretStrong: boolean;
  ready: boolean;
}

export const CampaignSequencerView: React.FC<CampaignsViewProps> = ({
  leads,
  onRefreshPipeline,
  pendingHook,
  onPendingHookApplied
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [dirtyCampaignId, setDirtyCampaignId] = useState<string | null>(null);
  const campaignEditVersionRef = useRef(0);
  const pendingHookAppliedRef = useRef(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [previewLeadId, setPreviewLeadId] = useState<string>(leads[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"editor" | "outbox" | "analytics">("editor");

  const [mailboxes, setMailboxes] = useState<MailboxSummary[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>("");
  const [telemetryMetrics, setTelemetryMetrics] = useState<TelemetryMetrics>({
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    openRate: 0,
    clickRate: 0
  });
  const [recentDispatches, setRecentDispatches] = useState<OutboundDispatchRecord[]>([]);
  const [deliveryReadiness, setDeliveryReadiness] = useState<DeliveryReadiness | null>(null);

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiFramework, setAiFramework] = useState<"pas" | "aida" | "bab" | "qvc" | "punchy" | "executive">("pas");
  const [aiTone, setAiTone] = useState<"consultative" | "direct" | "executive" | "casual" | "roi_focused">("executive");
  const [aiPainPoint, setAiPainPoint] = useState("");
  const [aiCompanyPitch, setAiCompanyPitch] = useState("");

  const [spintaxSampleIndex, setSpintaxSampleIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const fetchCampaignWorkspace = useCallback(async () => {
    try {
      const [campaignsRes, telemetryRes, mailboxesRes, healthRes] = await Promise.all([
        fetch("/api/campaigns"),
        fetch("/api/mailboxes/telemetry"),
        fetch("/api/mailboxes"),
        fetch("/api/health")
      ]);

      if (campaignsRes.ok) {
        const campaignData = await campaignsRes.json();
        if (campaignData.success && Array.isArray(campaignData.campaigns)) {
          setCampaigns(campaignData.campaigns);
          setSelectedCampaignId((current) =>
            campaignData.campaigns.some((campaign: Campaign) => campaign.id === current)
              ? current
              : campaignData.campaigns[0]?.id || ""
          );
          setDirtyCampaignId(null);
        }
      }

      if (telemetryRes.ok) {
        const tData = await telemetryRes.json();
        if (tData.success && tData.metrics) {
          setTelemetryMetrics(tData.metrics);
          setRecentDispatches(tData.recentDispatches || []);
        }
      }

      if (mailboxesRes.ok) {
        const mData = await mailboxesRes.json();
        if (mData.success && Array.isArray(mData.mailboxes)) {
          setMailboxes(mData.mailboxes);
          setSelectedMailboxId((current) => {
            if (current && mData.mailboxes.some((mailbox: MailboxSummary) => mailbox.id === current)) {
              return current;
            }
            const activeMailbox = mData.mailboxes.find((mailbox: MailboxSummary) => mailbox.status === "active");
            return activeMailbox?.id || mData.mailboxes[0]?.id || "";
          });
        }
      }
      if (healthRes.ok || healthRes.status === 503) {
        const healthData = await healthRes.json();
        setDeliveryReadiness(healthData.deliveryConfiguration || null);
      }
    } catch (err) {
      console.error("Campaign workspace fetch failure:", err);
      setDispatchStatus({ type: "error", message: "Campaign workspace could not be loaded." });
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaignWorkspace();
  }, [fetchCampaignWorkspace]);

  useEffect(() => {
    if (leads.length > 0 && !leads.some((lead) => lead.id === previewLeadId)) {
      setPreviewLeadId(leads[0].id);
    }
  }, [leads, previewLeadId]);

  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0];
  }, [campaigns, selectedCampaignId]);

  const activeStep = useMemo(() => {
    if (!activeCampaign || activeCampaign.steps.length === 0) return null;
    return activeCampaign.steps[selectedStepIndex] || activeCampaign.steps[0];
  }, [activeCampaign, selectedStepIndex]);

  const previewLead = useMemo<Lead | null>(() => {
    return leads.find((lead) => lead.id === previewLeadId) || leads[0] || null;
  }, [leads, previewLeadId]);

  const persistCampaign = useCallback(async (campaign: Campaign): Promise<Campaign> => {
    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign.name,
        description: campaign.description || "",
        dailySendingLimit: campaign.dailySendingLimit,
        steps: campaign.steps
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Campaign could not be saved.");
    }
    return data.campaign as Campaign;
  }, []);

  const markCampaignDirty = useCallback((campaignId: string) => {
    campaignEditVersionRef.current += 1;
    setDirtyCampaignId(campaignId);
  }, []);

  const handleUpdateActiveStep = useCallback(
    (updates: Partial<EmailStep>) => {
      if (!activeCampaign || !activeStep) return;
      if (activeCampaign.status !== "draft") {
        setDispatchStatus({ type: "error", message: "Only draft campaign steps can be edited." });
        return;
      }
      const updatedSteps = activeCampaign.steps.map((step, index) =>
        index === selectedStepIndex ? { ...step, ...updates } : step
      );
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === activeCampaign.id
            ? { ...campaign, steps: updatedSteps, updatedAt: new Date().toISOString() }
            : campaign
        )
      );
      markCampaignDirty(activeCampaign.id);
    },
    [activeCampaign, activeStep, markCampaignDirty, selectedStepIndex]
  );

  useEffect(() => {
    if (!dirtyCampaignId) return;
    const campaign = campaigns.find((candidate) => candidate.id === dirtyCampaignId);
    if (campaign?.status !== "draft") {
      setDirtyCampaignId(null);
      return;
    }
    const editVersion = campaignEditVersionRef.current;
    const timeout = window.setTimeout(async () => {
      setIsSavingCampaign(true);
      try {
        const savedCampaign = await persistCampaign(campaign);
        if (campaignEditVersionRef.current === editVersion) {
          setCampaigns((current) =>
            current.map((candidate) => (candidate.id === savedCampaign.id ? savedCampaign : candidate))
          );
          setDirtyCampaignId(null);
        }
      } catch (error) {
        setDispatchStatus({
          type: "error",
          message: error instanceof Error ? error.message : "Campaign could not be saved."
        });
      } finally {
        setIsSavingCampaign(false);
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [campaigns, dirtyCampaignId, persistCampaign]);

  // #1: When a scraped/verified lead with a saved AI email draft is selected for
  // preview, surface that draft as the campaign step body so the writing flows
  // directly from web-scrape → cold-email draft with zero copy-paste.
  useEffect(() => {
    if (!previewLeadId || !activeStep || !activeCampaign) return;
    const lead = leads.find((l) => l.id === previewLeadId);
    if (lead?.aiEmailDraft && lead.aiEmailDraft.trim().length > 0) {
      const currentBodyIsGeneric =
        !activeStep.body.includes("{{") || activeStep.body.trim().length < lead.aiEmailDraft.length;
      if (currentBodyIsGeneric) {
        handleUpdateActiveStep({ body: lead.aiEmailDraft, subject: activeStep.subject });
      }
    }
  }, [activeCampaign, activeStep, handleUpdateActiveStep, leads, previewLeadId]);

  const renderedSubject = useMemo(() => {
    if (!activeStep || !previewLead) return "";
    const withTags = replaceTags(activeStep.subject, previewLead);
    return evaluateSpintax(withTags, spintaxSampleIndex);
  }, [activeStep, previewLead, spintaxSampleIndex]);

  const renderedBody = useMemo(() => {
    if (!activeStep || !previewLead) return "";
    const withTags = replaceTags(activeStep.body, previewLead);
    return evaluateSpintax(withTags, spintaxSampleIndex);
  }, [activeStep, previewLead, spintaxSampleIndex]);

  const spamAnalysis = useMemo(() => {
    if (!activeStep) {
      return {
        score: 100,
        riskLevel: "safe",
        flagged: [],
        wordCount: 0,
        readingTimeSec: 0
      };
    }

    const fullContent = `${activeStep.subject} ${activeStep.body}`.toLowerCase();
    const flagged: Array<{
      word: string;
      category: string;
      severity: string;
      suggestion: string;
    }> = [];

    for (const item of SPAM_TRIGGER_WORDS) {
      if (fullContent.includes(item.word.toLowerCase())) {
        flagged.push(item);
      }
    }

    let score = 100;
    for (const f of flagged) {
      if (f.severity === "high") score -= 18;
      else if (f.severity === "medium") score -= 9;
      else score -= 4;
    }

    if (
      activeStep.subject &&
      activeStep.subject === activeStep.subject.toUpperCase() &&
      activeStep.subject.length > 5
    ) {
      score -= 25;
      flagged.push({
        word: "ALL CAPS SUBJECT",
        category: "Aggressive Formatting",
        severity: "high",
        suggestion: "Use natural sentence casing"
      });
    }

    score = Math.max(5, Math.min(100, score));
    const riskLevel = score >= 80 ? "safe" : score >= 55 ? "moderate" : "high";
    const words = activeStep.body.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingTimeSec = Math.max(5, Math.round((wordCount / 200) * 60));

    return { score, riskLevel, flagged, wordCount, readingTimeSec };
  }, [activeStep]);

  useEffect(() => {
    if (pendingHookAppliedRef.current || !activeStep) return;
    const pending = pendingHook;
    if (pending && pending.trim().length > 0) {
      pendingHookAppliedRef.current = true;
      handleUpdateActiveStep({
        body:
          activeStep.body && activeStep.body.trim().length > 0
            ? `${activeStep.body.trim()}\n\n${pending.trim()}`
            : pending.trim(),
        subject: activeStep.subject
      });
      onPendingHookApplied?.();
    }
  }, [activeStep, handleUpdateActiveStep, onPendingHookApplied, pendingHook]);

  const handleAddStep = () => {
    if (!activeCampaign) return;
    if (activeCampaign.status !== "draft") {
      setDispatchStatus({ type: "error", message: "Only draft campaigns can add steps." });
      return;
    }
    const newStepNum = activeCampaign.steps.length + 1;
    const newStep: EmailStep = {
      id: `step-${Date.now()}`,
      stepNumber: newStepNum,
      delayDays: 3,
      subject: "Following up about {{companyName}}",
      body: `Hi {{firstName}},\n\nI wanted to follow up on my previous note. If this isn’t relevant right now, no problem at all.\n\nBest,\nDustin Hill`,
      tone: "consultative",
      framework: "qvc"
    };
    const updated = [...activeCampaign.steps, newStep];
    setCampaigns((prev) =>
      prev.map((c) => (c.id === activeCampaign.id ? { ...c, steps: updated, updatedAt: new Date().toISOString() } : c))
    );
    markCampaignDirty(activeCampaign.id);
    setSelectedStepIndex(updated.length - 1);
  };

  const handleDeleteStep = (stepIdx: number) => {
    if (!activeCampaign || activeCampaign.steps.length <= 1) return;
    if (activeCampaign.status !== "draft") {
      setDispatchStatus({ type: "error", message: "Only draft campaigns can remove steps." });
      return;
    }
    const updated = activeCampaign.steps.filter((_, i) => i !== stepIdx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setCampaigns((prev) =>
      prev.map((c) => (c.id === activeCampaign.id ? { ...c, steps: updated, updatedAt: new Date().toISOString() } : c))
    );
    markCampaignDirty(activeCampaign.id);
    setSelectedStepIndex(Math.max(0, stepIdx - 1));
  };

  const handleCreateNewCampaign = async () => {
    setDispatchStatus(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Outbound Campaign #${campaigns.length + 1}`,
          description: "Targeted, evidence-based outbound campaign",
          dailySendingLimit: 50,
          steps: [
            {
              stepNumber: 1,
              delayDays: 0,
              subject: "Quick question about {{companyName}}",
              body: `Hi {{firstName}},\n\nI’m reaching out because your role at {{companyName}} may be relevant to LeadForge. We help teams research leads, verify mail infrastructure, and prepare careful outreach.\n\nWould a short overview be useful?\n\nBest,\nDustin Hill`,
              tone: "consultative",
              framework: "qvc"
            }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Campaign creation failed.");
      const newCampaign = data.campaign as Campaign;
      setCampaigns((current) => [newCampaign, ...current]);
      setSelectedCampaignId(newCampaign.id);
      setSelectedStepIndex(0);
    } catch (error) {
      setDispatchStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Campaign creation failed."
      });
    }
  };

  const handleGenerateAiSequence = async () => {
    if (!previewLead || !activeCampaign) {
      setDispatchStatus({
        type: "error",
        message: "Select a real lead before generating a personalized sequence."
      });
      return;
    }
    setIsGeneratingAi(true);
    setDispatchStatus(null);
    try {
      const res = await fetch("/api/ai/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: previewLead.id,
          tone: aiTone,
          customPitch: [aiCompanyPitch.trim(), aiPainPoint.trim()].filter(Boolean).join(". "),
          stepCount: activeCampaign?.steps.length || 3
        })
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.sequence) && data.sequence.length > 0) {
        const generatedSteps = data.sequence as Array<{
          step?: number;
          delayDays?: number;
          subject?: string;
          body?: string;
        }>;
        if (generatedSteps.some((step) => !step.subject?.trim() || !step.body?.trim())) {
          throw new Error("The AI returned an incomplete email step; nothing was saved.");
        }
        const mappedSteps: EmailStep[] = generatedSteps.map((step, idx) => ({
          id: `step-ai-${Date.now()}-${idx}`,
          stepNumber: step.step || idx + 1,
          delayDays: step.delayDays !== undefined ? step.delayDays : idx === 0 ? 0 : 3,
          subject: step.subject || "",
          body: step.body || "",
          tone: aiTone,
          framework: aiFramework,
          targetPainPoint: aiPainPoint
        }));

        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === activeCampaign.id
              ? {
                  ...c,
                  steps: mappedSteps,
                  name: `${aiTone.toUpperCase()} — ${previewLead.companyName || "Outbound Sequence"}`,
                  updatedAt: new Date().toISOString()
                }
              : c
          )
        );
        markCampaignDirty(activeCampaign.id);
        setSelectedStepIndex(0);
        setDispatchStatus({
          type: "success",
          message: `Generated ${mappedSteps.length}-step sequence via ${data.model || "Ollama"}.`
        });
      } else {
        setDispatchStatus({
          type: "error",
          message: data.error || "Failed to generate sequence."
        });
      }
    } catch (err: unknown) {
      setDispatchStatus({
        type: "error",
        message: `AI generation failed: ${err instanceof Error ? err.message : String(err)}`
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleLaunchLiveCampaign = async () => {
    const qualifiedLeads = leads.filter((l) => l.isQualified);
    const targetLeads = qualifiedLeads.length > 0 ? qualifiedLeads : leads;

    if (targetLeads.length === 0) {
      setDispatchStatus({
        type: "error",
        message: "No prospects available. Ingest leads via CSV or Waterfall first."
      });
      return;
    }

    if (!activeCampaign || !activeStep) {
      setDispatchStatus({
        type: "error",
        message: "No active email template configured."
      });
      return;
    }

    setIsDispatching(true);
    setDispatchStatus(null);

    try {
      if (dirtyCampaignId === activeCampaign.id) {
        campaignEditVersionRef.current += 1;
        const savedCampaign = await persistCampaign(activeCampaign);
        setCampaigns((current) =>
          current.map((campaign) => (campaign.id === savedCampaign.id ? savedCampaign : campaign))
        );
        setDirtyCampaignId(null);
      }
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId: selectedMailboxId || undefined,
          leadIds: targetLeads.map((l) => l.id)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchStatus({
          type: "success",
          message: `Campaign live: ${data.enrolledCount} leads enrolled, ${data.scheduledDispatchCount} step deliveries scheduled, ${data.suppressedCount} suppressed.`
        });
        await fetchCampaignWorkspace();
        if (onRefreshPipeline) onRefreshPipeline();
      } else {
        setDispatchStatus({
          type: "error",
          message: data.error || "Failed to launch campaign dispatch."
        });
      }
    } catch (err: unknown) {
      setDispatchStatus({
        type: "error",
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCampaignStateChange = async (action: "pause" | "resume") => {
    if (!activeCampaign) return;
    setIsDispatching(true);
    setDispatchStatus(null);
    try {
      const response = await fetch(`/api/campaigns/${activeCampaign.id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `Campaign ${action} failed.`);
      await fetchCampaignWorkspace();
      setDispatchStatus({
        type: "success",
        message: action === "pause" ? "Campaign paused. No scheduled steps will be sent." : "Campaign resumed."
      });
    } catch (error) {
      setDispatchStatus({
        type: "error",
        message: error instanceof Error ? error.message : `Campaign ${action} failed.`
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    if (!activeStep) return;
    const textarea = document.getElementById("email-body-editor") as HTMLTextAreaElement | null;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const original = activeStep.body;
      const updated = `${original.substring(0, start)}{{${tag}}}${original.substring(end)}`;
      handleUpdateActiveStep({ body: updated });
    } else {
      handleUpdateActiveStep({ body: `${activeStep.body} {{${tag}}}` });
    }
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(renderedBody);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header & Campaign Selector Bar */}
      <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-5 shadow-card-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-600/30 border border-purple-400/20">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Outbound Campaign Sequencer & AI Copy Studio
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full">
                Live SMTP Queue Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-step cadence builder, live spintax renderer, spam risk analyzer, and background SMTP delivery.
            </p>
          </div>
        </div>

        {/* Campaign Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedCampaignId}
            onChange={(e) => {
              setSelectedCampaignId(e.target.value);
              setSelectedStepIndex(0);
            }}
            className="text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 focus:ring-1 focus:ring-indigo-500 font-semibold outline-none cursor-pointer max-w-[260px] truncate"
          >
            {campaigns.length === 0 && <option value="">No campaigns yet</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.steps.length} Steps)
              </option>
            ))}
          </select>

          <span className="text-[10px] font-mono text-slate-400">
            {isLoadingCampaigns
              ? "Loading from PostgreSQL…"
              : isSavingCampaign
                ? "Saving draft…"
                : dirtyCampaignId
                  ? "Draft changed"
                  : "Server saved"}
          </span>

          <button
            type="button"
            onClick={handleCreateNewCampaign}
            className="flex items-center space-x-1.5 bg-[#0a0d16] hover:bg-[#151c2e] text-slate-200 border border-[#1e283d] hover:border-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Campaign</span>
          </button>

          <div className="flex items-center p-1 bg-[#0a0d16] border border-[#1e283d] rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === "editor" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sequence Editor
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("outbox");
                fetchCampaignWorkspace();
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === "outbox" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Live Outbox Queue ({recentDispatches.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("analytics");
                fetchCampaignWorkspace();
              }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === "analytics" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Delivery Telemetry
            </button>
          </div>
        </div>
      </div>

      {/* Real-time KPI Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sent Messages</p>
            <Send className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-white mt-1 tabular-nums">
            {telemetryMetrics.totalSent.toLocaleString()}
          </p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-2 font-mono">
            <span className="text-emerald-400 font-bold">
              {telemetryMetrics.totalSent > 0
                ? `${Math.round(((telemetryMetrics.totalSent - telemetryMetrics.totalBounced) / telemetryMetrics.totalSent) * 100)}%`
                : "100%"}
            </span>
            <span>Delivery Rate</span>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tracked Opens</p>
            <Eye className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400 mt-1 tabular-nums">
            {telemetryMetrics.openRate}%
          </p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-2 font-mono">
            <span className="text-white font-bold">{telemetryMetrics.totalOpened} Verified Opens</span>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CTA Click-Through</p>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">{telemetryMetrics.clickRate}%</p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-2 font-mono">
            <span className="text-white font-bold">{telemetryMetrics.totalClicked} Engagements</span>
          </div>
        </div>

        <div className="bg-[#0f1523] border border-[#1e283d] p-4 rounded-2xl shadow-card-subtle">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Prospects</p>
            <Calendar className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-mono font-bold text-purple-400 mt-1 tabular-nums">
            {leads.filter((l) => l.isQualified).length} / {leads.length}
          </p>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-2 font-mono">
            <span className="text-emerald-400 font-bold">Verified ICP</span>
            <span>Ready for outreach</span>
          </div>
        </div>
      </div>

      {/* VIEW: SEQUENCE EDITOR */}
      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Cadence Steps & AI Generator */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-4 shadow-card-subtle space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1e283d]">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cadence Sequence ({activeCampaign?.steps.length} Steps)</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="flex items-center space-x-1 text-[11px] font-bold text-indigo-400 hover:text-white bg-[#0a0d16] hover:bg-indigo-600 px-2 py-1 rounded-lg border border-[#1e283d] transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Step</span>
                </button>
              </div>

              <div className="space-y-2">
                {activeCampaign?.steps.map((step, idx) => {
                  const isSelected = idx === selectedStepIndex;
                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border transition flex items-center justify-between ${
                        isSelected
                          ? "bg-[#151c2e] border-indigo-500 shadow-md shadow-indigo-600/10"
                          : "bg-[#0a0d16] hover:bg-[#151c2e]/60 border-[#1e283d] text-slate-300"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedStepIndex(idx)}
                        aria-pressed={isSelected}
                        className="flex flex-1 items-center space-x-2.5 p-3 text-left cursor-pointer"
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {step.stepNumber}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">
                            {idx === 0 ? "Initial Touchpoint" : `Follow-up #${idx}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {idx === 0 ? "Immediate (Day 0)" : `+${step.delayDays} days after Step ${idx}`}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center space-x-1 pr-3">
                        {step.variantSubjectB && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px] font-bold font-mono">
                            A/B
                          </span>
                        )}
                        {activeCampaign.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteStep(idx);
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="Delete step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Generator Panel */}
            <div className="bg-[#0f1523] border border-indigo-900/60 rounded-2xl p-5 shadow-card-subtle space-y-4">
              <div className="flex items-center space-x-2.5 border-b border-[#1e283d] pb-3">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ollama Sequence Generator</h3>
                  <p className="text-[11px] text-slate-400">Generate full multi-touch outbound copy</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label
                    htmlFor="campaign-ai-framework"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    Framework
                  </label>
                  <select
                    id="campaign-ai-framework"
                    value={aiFramework}
                    onChange={(event) => setAiFramework(event.target.value as typeof aiFramework)}
                    className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="pas">PAS (Problem - Agitate - Solution)</option>
                    <option value="aida">AIDA (Attention - Interest - Desire - Action)</option>
                    <option value="bab">BAB (Before - After - Bridge)</option>
                    <option value="qvc">QVC (Question - Value - Call to Action)</option>
                    <option value="punchy">1-Sentence Direct Pitch</option>
                    <option value="executive">C-Level Executive Brief</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="campaign-ai-tone" className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Tone Archetype
                  </label>
                  <select
                    id="campaign-ai-tone"
                    value={aiTone}
                    onChange={(event) => setAiTone(event.target.value as typeof aiTone)}
                    className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="executive">Executive & Strategic</option>
                    <option value="consultative">Consultative & Data-Driven</option>
                    <option value="direct">Direct & Problem-Solving</option>
                    <option value="roi_focused">ROI & Financial Impact</option>
                    <option value="casual">Casual & Conversational</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="campaign-ai-pain-point"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    Core Pain Point
                  </label>
                  <input
                    id="campaign-ai-pain-point"
                    type="text"
                    value={aiPainPoint}
                    onChange={(e) => setAiPainPoint(e.target.value)}
                    className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="campaign-ai-value-proposition"
                    className="block text-[11px] font-semibold text-slate-300 mb-1"
                  >
                    Value Proposition
                  </label>
                  <input
                    id="campaign-ai-value-proposition"
                    type="text"
                    value={aiCompanyPitch}
                    onChange={(e) => setAiCompanyPitch(e.target.value)}
                    className="w-full text-xs bg-[#0a0d16] border border-[#1e283d] rounded-xl px-3 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiSequence}
                  disabled={isGeneratingAi || !previewLead}
                  className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? "animate-spin" : ""}`} />
                  <span>{isGeneratingAi ? "Generating Sequence..." : "Generate AI Copy"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Step Editor & Live Live Prospect Render */}
          <div className="lg:col-span-8 space-y-4">
            {activeStep ? (
              <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-5">
                {/* Step Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e283d]">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold font-mono text-sm shadow-sm">
                      #{activeStep.stepNumber}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">
                        {activeStep.stepNumber === 1
                          ? "Step 1: Introduction"
                          : `Step ${activeStep.stepNumber}: Follow-up`}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {activeStep.stepNumber === 1
                          ? "Initial outreach touchpoint"
                          : `Scheduled +${activeStep.delayDays} days after previous email`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {activeStep.stepNumber > 1 && (
                      <div className="flex items-center space-x-1.5 bg-[#0a0d16] border border-[#1e283d] px-3 py-1.5 rounded-xl text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400">Wait:</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={activeStep.delayDays}
                          onChange={(e) =>
                            handleUpdateActiveStep({
                              delayDays: parseInt(e.target.value, 10) || 1
                            })
                          }
                          className="w-12 bg-transparent text-slate-100 font-mono font-bold text-center outline-none border-b border-indigo-500"
                        />
                        <span className="text-slate-400">days</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (activeStep.variantSubjectB !== undefined) {
                          handleUpdateActiveStep({
                            variantSubjectB: undefined,
                            variantBodyB: undefined
                          });
                        } else {
                          handleUpdateActiveStep({
                            variantSubjectB: `Alternative Angle: ${activeStep.subject}`,
                            variantBodyB: `Hey {{firstName}},\n\nSaw your team at {{companyName}}...`
                          });
                        }
                      }}
                      className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                        activeStep.variantSubjectB !== undefined
                          ? "bg-purple-950/80 border-purple-500 text-purple-200"
                          : "bg-[#0a0d16] hover:bg-[#151c2e] border-[#1e283d] text-slate-300"
                      }`}
                    >
                      <Split className="w-3.5 h-3.5 text-purple-400" />
                      <span>{activeStep.variantSubjectB !== undefined ? "A/B Active" : "Add A/B Variant"}</span>
                    </button>
                  </div>
                </div>

                {/* Variable Pills Toolbar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-400">Insert Personalization Tags:</span>
                    <span className="text-slate-500 font-mono">Spintax: {"{Option1|Option2}"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { tag: "firstName", label: "{{firstName}}" },
                      { tag: "lastName", label: "{{lastName}}" },
                      { tag: "companyName", label: "{{companyName}}" },
                      { tag: "jobTitle", label: "{{jobTitle}}" },
                      { tag: "industry", label: "{{industry}}" },
                      { tag: "seniority", label: "{{seniority}}" },
                      { tag: "companyDomain", label: "{{companyDomain}}" }
                    ].map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        onClick={() => handleInsertTag(v.tag)}
                        className="px-2.5 py-1 rounded-lg bg-[#0a0d16] hover:bg-indigo-950 text-indigo-300 hover:text-white border border-[#1e283d] hover:border-indigo-600 font-mono text-[11px] font-medium transition cursor-pointer"
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Line Input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="campaign-subject-a"
                    className="block text-xs font-bold text-slate-300 uppercase tracking-wider"
                  >
                    Subject Line (Variant A)
                  </label>
                  <input
                    id="campaign-subject-a"
                    type="text"
                    value={activeStep.subject}
                    onChange={(e) => handleUpdateActiveStep({ subject: e.target.value })}
                    placeholder="e.g. {Quick question|Thought for} {{firstName}} re: {{companyName}}"
                    className="w-full text-xs font-mono text-slate-100 bg-[#0a0d16] border border-[#1e283d] rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 shadow-inner"
                  />
                </div>

                {/* Optional Variant B Subject */}
                {activeStep.variantSubjectB !== undefined && (
                  <div className="space-y-1.5 p-3 rounded-xl bg-purple-950/20 border border-purple-900/50">
                    <label
                      htmlFor="campaign-subject-b"
                      className="block text-xs font-bold text-purple-300 uppercase tracking-wider"
                    >
                      Subject Line (Variant B Split Test)
                    </label>
                    <input
                      id="campaign-subject-b"
                      type="text"
                      value={activeStep.variantSubjectB}
                      onChange={(e) =>
                        handleUpdateActiveStep({
                          variantSubjectB: e.target.value
                        })
                      }
                      className="w-full text-xs font-mono text-slate-100 bg-[#0a0d16] border border-purple-800/60 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500 shadow-inner"
                    />
                  </div>
                )}

                {/* Email Body Editor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="email-body-editor"
                      className="block text-xs font-bold text-slate-300 uppercase tracking-wider"
                    >
                      Email Body (Variant A)
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {spamAnalysis.wordCount} words • ~{spamAnalysis.readingTimeSec}s read
                    </span>
                  </div>
                  <textarea
                    id="email-body-editor"
                    rows={8}
                    value={activeStep.body}
                    onChange={(e) => handleUpdateActiveStep({ body: e.target.value })}
                    className="w-full text-xs font-mono text-slate-100 bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                  />
                </div>

                {/* Deliverability & Spam Word Scanner */}
                <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck
                        className={`w-4 h-4 ${
                          spamAnalysis.riskLevel === "safe"
                            ? "text-emerald-400"
                            : spamAnalysis.riskLevel === "moderate"
                              ? "text-amber-400"
                              : "text-rose-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                        Deliverability Health & Spam Scanner
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 font-mono">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          spamAnalysis.score >= 80
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : spamAnalysis.score >= 55
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                        }`}
                      >
                        {spamAnalysis.score}/100 Safety Score
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 bg-[#151c2e] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        spamAnalysis.score >= 80
                          ? "bg-emerald-500"
                          : spamAnalysis.score >= 55
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${spamAnalysis.score}%` }}
                    ></div>
                  </div>

                  {spamAnalysis.flagged.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-rose-400">
                        Trigger Words Detected ({spamAnalysis.flagged.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {spamAnalysis.flagged.map((f) => (
                          <div
                            key={`${f.word}-${f.category}`}
                            className="px-2 py-1 rounded-lg bg-rose-950/80 border border-rose-800/80 text-[10px] text-rose-300 font-mono flex items-center space-x-1"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span className="font-bold">"{f.word}"</span>
                            <span className="text-slate-400">→ Try: {f.suggestion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Zero spam trigger words detected. Safe for primary inbox placement.</span>
                    </div>
                  )}
                </div>

                {/* Real-time Prospect Preview */}
                <div className="bg-[#0a0d16] border border-indigo-950/60 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e283d] pb-2.5">
                    <div className="flex items-center space-x-2">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Live Prospect Render Preview
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <select
                        value={previewLeadId}
                        onChange={(e) => setPreviewLeadId(e.target.value)}
                        disabled={leads.length === 0}
                        className="text-[11px] bg-[#0f1523] border border-[#1e283d] rounded-lg px-2 py-1 text-slate-300 outline-none cursor-pointer max-w-[200px] truncate"
                      >
                        {leads.length === 0 && <option value="">No real leads available</option>}
                        {leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.firstName} {l.lastName} ({l.companyName})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setSpintaxSampleIndex((prev) => prev + 1)}
                        disabled={!previewLead}
                        className="flex items-center space-x-1 text-[11px] font-semibold text-indigo-300 hover:text-white bg-[#151c2e] border border-[#1e283d] px-2.5 py-1 rounded-lg transition cursor-pointer"
                        title="Spin preview variants"
                      >
                        <RotateCcw className="w-3 h-3 text-indigo-400" />
                        <span>Spin & Test</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyBody}
                        disabled={!previewLead}
                        className="flex items-center space-x-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-[#151c2e] border border-[#1e283d] px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {previewLead ? (
                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 bg-[#0f1523] rounded-lg border border-[#1e283d]/60 text-slate-300">
                        <span className="text-slate-500 font-bold">Subject:</span> {renderedSubject}
                      </div>
                      <div className="p-3.5 bg-[#0f1523] rounded-lg border border-[#1e283d]/60 text-slate-200 whitespace-pre-line leading-relaxed">
                        {renderedBody}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-[#0f1523] rounded-lg border border-[#1e283d]/60 text-xs text-amber-300">
                      Add or import a real lead to render and generate personalized email copy.
                    </div>
                  )}
                </div>

                {/* Dispatch Trigger Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#1e283d]">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs text-slate-400 font-mono">
                      Target Cohort:{" "}
                      <span className="text-emerald-400 font-bold">
                        {leads.filter((l) => l.isQualified).length} Qualified Leads
                      </span>
                    </div>

                    {mailboxes.length > 0 ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Sender:</span>
                        <select
                          value={selectedMailboxId}
                          onChange={(e) => setSelectedMailboxId(e.target.value)}
                          className="bg-[#0a0d16] border border-[#1e283d] text-slate-200 px-2 py-1 rounded text-xs outline-none"
                        >
                          {mailboxes.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.email} ({m.senderName})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-400">
                        No mailboxes detected. Connect SMTP in Deliverability tab.
                      </div>
                    )}
                  </div>

                  {activeCampaign?.status === "draft" && (
                    <>
                      <button
                        type="button"
                        onClick={handleLaunchLiveCampaign}
                        disabled={
                          isDispatching ||
                          isSavingCampaign ||
                          leads.length === 0 ||
                          !selectedMailboxId ||
                          deliveryReadiness?.ready !== true
                        }
                        className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 text-white text-xs font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
                      >
                        {isDispatching ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Creating durable schedule…</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Launch Durable Campaign</span>
                          </>
                        )}
                      </button>
                      {deliveryReadiness && !deliveryReadiness.ready && (
                        <p className="text-[11px] text-amber-400">
                          Live launch unavailable: enable SMTP sending and complete delivery configuration.
                        </p>
                      )}
                    </>
                  )}
                  {activeCampaign?.status === "active" && (
                    <button
                      type="button"
                      onClick={() => handleCampaignStateChange("pause")}
                      disabled={isDispatching}
                      className="flex items-center justify-center space-x-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-3 rounded-xl transition cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Pause Scheduled Sends</span>
                    </button>
                  )}
                  {activeCampaign?.status === "paused" && (
                    <button
                      type="button"
                      onClick={() => handleCampaignStateChange("resume")}
                      disabled={isDispatching}
                      className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-3 rounded-xl transition cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>Resume Campaign</span>
                    </button>
                  )}
                </div>

                {dispatchStatus && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                      dispatchStatus.type === "success"
                        ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                        : "bg-rose-950/60 border-rose-800 text-rose-300"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{dispatchStatus.message}</span>
                    </div>
                    {dispatchStatus.type === "success" && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("outbox");
                          fetchCampaignWorkspace();
                        }}
                        className="text-xs font-bold text-white underline hover:text-emerald-200"
                      >
                        View Queue
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 bg-[#0f1523] border border-[#1e283d] rounded-2xl">
                <p>No active email step selected</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: LIVE OUTBOX QUEUE */}
      {activeTab === "outbox" && (
        <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e283d]">
            <div>
              <h3 className="text-sm font-bold text-white">Live Outbound Dispatch Queue & Sender Mailboxes</h3>
              <p className="text-xs text-slate-400">
                Scheduled and transmitted emails processed by the Redis BullMQ worker.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchCampaignWorkspace}
              className="flex items-center space-x-1.5 bg-[#0a0d16] hover:bg-[#151c2e] text-slate-200 border border-[#1e283d] text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {recentDispatches.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs font-medium text-slate-400">No outbound dispatches recorded yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("editor")}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  Configure and launch a campaign sequence
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0a0d16] text-slate-400 font-semibold border-b border-[#1e283d]">
                  <tr>
                    <th className="p-3">Target Prospect</th>
                    <th className="p-3">Subject</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Telemetry</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e283d]/60 font-mono text-[11px]">
                  {recentDispatches.map((d) => (
                    <tr key={d.id} className="hover:bg-[#151c2e]/40 transition">
                      <td className="p-3">
                        <div className="text-indigo-400 font-bold">{d.recipientEmail}</div>
                      </td>
                      <td className="p-3 font-sans text-slate-300 max-w-[280px] truncate">{d.subject}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            d.status === "sent"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : d.status === "failed"
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 font-mono">
                        {d.opensCount > 0 && <span className="text-emerald-400 mr-2">{d.opensCount} Opens</span>}
                        {d.clicksCount > 0 && <span className="text-amber-400">{d.clicksCount} Clicks</span>}
                        {d.opensCount === 0 && d.clicksCount === 0 && <span className="text-slate-500">None</span>}
                      </td>
                      <td className="p-3 text-right text-slate-400">
                        {new Date(d.sentAt || d.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* VIEW: DELIVERY TELEMETRY & CONVERSION ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="bg-[#0f1523] border border-[#1e283d] rounded-2xl p-6 shadow-card-subtle space-y-6">
          <div className="pb-4 border-b border-[#1e283d]">
            <h3 className="text-sm font-bold text-white">Campaign Funnel Velocity & Telemetry</h3>
            <p className="text-xs text-slate-400">
              Aggregated open and click-through metrics across your connected sending accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-indigo-400 font-mono">Total Volume</span>
              <p className="text-xl font-bold text-white font-mono">{telemetryMetrics.totalSent} Dispatches</p>
              <p className="text-[11px] text-slate-400">Recorded across active campaign mailboxes.</p>
            </div>

            <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-emerald-400 font-mono">Open Conversion</span>
              <p className="text-xl font-bold text-emerald-400 font-mono">{telemetryMetrics.openRate}%</p>
              <p className="text-[11px] text-slate-400">
                {telemetryMetrics.totalOpened} unique opens verified by pixel.
              </p>
            </div>

            <div className="bg-[#0a0d16] border border-[#1e283d] rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-amber-400 font-mono">Click-Through Action</span>
              <p className="text-xl font-bold text-amber-400 font-mono">{telemetryMetrics.clickRate}%</p>
              <p className="text-[11px] text-slate-400">{telemetryMetrics.totalClicked} CTA redirects recorded.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
