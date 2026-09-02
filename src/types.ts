export type SeniorityLevel = "c_level" | "vp" | "director" | "manager" | "individual_contributor" | "unknown";
export type LeadStage = "discovered" | "enriched" | "verified" | "qualified" | "disqualified" | "exported" | "archived";
export type VerificationStatus =
  | "unverified"
  | "domain_accepts_mail"
  | "mailbox_accepted"
  | "provider_verified"
  | "invalid"
  | "disposable"
  | "risky"
  | "mx_not_found";
export type LeadSourceType = "unknown" | "manual" | "batch" | "csv" | "crawl" | "waterfall" | "api" | "hunter";

export interface Lead {
  id: string;
  accountId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle: string;
  seniority: SeniorityLevel;
  companyName: string;
  companyDomain: string;
  industry?: string;
  employeeCount?: number;
  annualRevenueUsd?: number;
  stage: LeadStage;
  verificationStatus: VerificationStatus;
  fitScore: number;
  engagementScore: number;
  isQualified: boolean;
  mxHosts: string[];
  linkedinUrl?: string;
  personalizationPrompt?: string;
  aiEmailDraft?: string;
  createdAt: string;
  updatedAt: string;
  sourceType: LeadSourceType;
  sourceReference?: string;
  sourceObservedAt?: string;
}

export interface Account {
  id: string;
  companyName: string;
  domain: string;
  industry?: string;
  employeeCount?: number;
  annualRevenueUsd?: number;
  websiteUrl?: string;
  phone?: string;
  description?: string;
  country?: string;
  state?: string;
  city?: string;
  sourceProvider?: string;
  sourceReference?: string;
  sourceObservedAt?: string;
  createdAt: string;
}

export interface SystemHealth {
  status: string;
  version: string;
  hasLlmKey?: boolean;
  dependencies: {
    postgres: boolean;
    redis: boolean;
  };
  stats?: {
    totalLeads: number;
    totalAccounts: number;
  };
}

export type UserRole = "developer_admin" | "sales_director" | "sdr_operator" | "read_only";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  isDeveloper: boolean;
  lastLoginAt: string;
  permissions: string[];
}

export type ActiveTab =
  | "leads"
  | "accounts"
  | "discovery"
  | "campaigns"
  | "deliverability"
  | "hygiene"
  | "ingest"
  | "exports"
  | "verify"
  | "signals"
  | "waterfall";

export interface DiscoveryCompany {
  id: string;
  name: string;
  domain: string;
  industry?: string | null;
  employeeCount?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  websiteUrl: string;
  publicEmail?: string | null;
  phone?: string | null;
  streetAddress?: string | null;
  confidence?: number | null;
  datasetRelease?: string | null;
  sourceUrls: string[];
  status: "discovered" | "researching" | "completed" | "no_contacts" | "failed";
  outcome?: "found" | "not_found" | "rate_limited" | "blocked" | "failed" | null;
  errorMessage?: string | null;
  qualificationStatus: "pending" | "qualified" | "disqualified" | "insufficient_evidence" | "failed";
  opportunityScore?: number | null;
  evidenceQuality?: number | null;
  qualificationReasons: string[];
  disqualificationReasons: string[];
  bestContact?: {
    type: string;
    value: string;
    name?: string | null;
    jobTitle?: string | null;
    sourceUrl: string;
  } | null;
  outreachAngle?: string | null;
  qualifiedAt?: string | null;
  opportunitySignals?: Array<{
    id: string;
    key: string;
    title: string;
    category: string;
    observation: string;
    opportunity: string;
    evidenceQuality: number;
    scoreContribution: number;
    matchedQualifyingRule: boolean;
    matchedDisqualifyingRule: boolean;
    sourceUrl: string;
    snapshotSha256?: string | null;
    observedAt: string;
  }>;
}

export interface DiscoveryContact {
  id: string;
  companyId: string;
  leadId?: string | null;
  email: string;
  firstName: string;
  lastName?: string | null;
  position: string;
  seniority?: string | null;
  department?: string | null;
  decisionMaker: boolean;
  confidence?: number | null;
  verificationStatus?: string | null;
  sourceUrls: string[];
  status: "discovered" | "promoted" | "duplicate" | "invalid";
}

export interface DiscoveryRun {
  id: string;
  query: string;
  provider: "overture_maps" | "overture_maps+hunter" | "hunter";
  clientId?: string | null;
  status: "queued" | "running" | "completed" | "partial" | "failed" | "cancel_requested" | "cancelled";
  outcome?: "found" | "not_found" | "rate_limited" | "blocked" | "failed" | null;
  companyLimit: number;
  contactsPerCompany: number;
  maxDomainSearches: number;
  providerResultCount: number;
  companiesProcessed: number;
  domainSearchesPerformed: number;
  contactsFound: number;
  leadsCreated: number;
  candidatesEvaluated: number;
  prospectsQualified: number;
  prospectsDisqualified: number;
  qualificationFailures: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  companies?: DiscoveryCompany[];
  contacts?: DiscoveryContact[];
  client?: { id: string; name: string } | null;
}

export interface EmailStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  variantSubjectB?: string;
  variantBodyB?: string;
  tone?: "consultative" | "direct" | "executive" | "casual" | "roi_focused";
  framework?: "pas" | "aida" | "bab" | "qvc" | "punchy" | "executive";
  targetPainPoint?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  mailboxId?: string | null;
  trackOpens?: boolean;
  trackClicks?: boolean;
  targetSegment?: string;
  targetSeniority?: SeniorityLevel | "all";
  dailySendingLimit: number;
  steps: EmailStep[];
  enrolledLeadIds: string[];
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    meetingsBooked: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SpamCheckResult {
  score: number; // 0 (spammy) to 100 (clean)
  riskLevel: "safe" | "moderate" | "high";
  flaggedWords: Array<{
    word: string;
    severity: "high" | "medium" | "low";
    category: string;
    suggestion: string;
  }>;
  readability: {
    wordCount: number;
    charCount: number;
    readingTimeSec: number;
    readingGrade: string;
    questionCount: number;
    hasSpintax: boolean;
    hasVariables: boolean;
  };
}

export type ActivityActionType =
  | "bulk_enrich"
  | "bulk_stage_change"
  | "single_enrich"
  | "delete"
  | "bulk_delete"
  | "export_csv"
  | "export_json"
  | "export_pdf"
  | "webhook_dispatch"
  | "single_ingest"
  | "batch_ingest"
  | "dns_verify"
  | "role_switch"
  | "data_hygiene"
  | "lead_discovery_started"
  | "lead_discovery_completed"
  | "lead_discovery_cancel_requested"
  | "login"
  | "custom";

export interface ActivityLogRecord {
  id: string;
  timestamp: string;
  actionType: ActivityActionType;
  operatorEmail: string;
  operatorRole: string;
  targetCount: number;
  description: string;
  status: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
}

export interface HygieneSummary {
  totalLeads: number;
  healthScore: number;
  totalFlaggedIssues: number;
  duplicateEmailsCount: number;
  redundantDuplicatesCount: number;
  invalidDomainCount: number;
  invalidEmailFormatCount: number;
  disposableOrInvalidCount: number;
  staleZeroFitCount: number;
}

export interface HygieneAuditReport {
  success: boolean;
  timestamp: string;
  summary: HygieneSummary;
  duplicateGroups: Array<{
    email: string;
    count: number;
    leadIds: string[];
    leads: Lead[];
  }>;
  domainIssues: Array<{
    leadId: string;
    email: string;
    companyName: string;
    domain: string;
    reason: string;
  }>;
  emailFormatIssues: Array<{
    leadId: string;
    email: string;
    companyName: string;
    reason: string;
  }>;
  disposableIssues: Array<{
    leadId: string;
    email: string;
    companyName: string;
    domain: string;
  }>;
  staleZeroFitIssues: Array<{
    leadId: string;
    email: string;
    companyName: string;
    fitScore: number;
    stage: string;
  }>;
}

export type DuplicateAction = "merge" | "ignore" | "import_separate";

export interface IngestLeadInput {
  [key: string]: unknown;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  email_address?: string;
  phone?: string;
  jobTitle?: string;
  job_title?: string;
  title?: string;
  companyName?: string;
  company_name?: string;
  companyDomain?: string;
  company_domain?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number | string;
  employee_count?: number | string;
  annualRevenueUsd?: number;
  rawIndex?: number;
}

export interface DuplicateCandidate {
  id: string;
  incomingLead: IngestLeadInput;
  existingLead?: Lead;
  matchedReason: "exact_email" | "domain_and_name" | "batch_redundancy";
  action: DuplicateAction;
  differences: Array<{
    field: string;
    label: string;
    existingValue: unknown;
    incomingValue: unknown;
  }>;
}

export interface AdvancedFilterState {
  scoreRange: { min: number; max: number };
  stages: LeadStage[];
  sources: LeadSourceType[];
  seniorities: SeniorityLevel[];
  deliverability: VerificationStatus[];
  hasAiDraft: "all" | "yes" | "no";
  employeeRanges: string[]; // "1-50", "51-250", "251-1000", "1000+"
  isQualifiedOnly: boolean;
}
