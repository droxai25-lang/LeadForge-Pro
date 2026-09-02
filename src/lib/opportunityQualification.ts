import { normalizeSingleLineText } from "./plainText";

export type ProspectQualificationStatus = "pending" | "qualified" | "disqualified" | "insufficient_evidence" | "failed";

export interface QualificationSignalRule {
  key: string;
  weight: number;
  required: boolean;
}

export interface TargetCompanyCharacteristics {
  minEmployees: number | null;
  maxEmployees: number | null;
  allowUnknownEmployeeCount: boolean;
  minSourceConfidence: number;
  requirePublicEmail: boolean;
  requirePublicPhone: boolean;
  requiredTechnologies: string[];
  excludedTechnologies: string[];
}

export interface QualificationContract {
  schemaVersion: 1;
  clientOffer: string;
  targetIndustries: string[];
  targetGeography: string[];
  targetCompanyCharacteristics: TargetCompanyCharacteristics;
  desiredBuyerRoles: string[];
  qualifyingSignals: QualificationSignalRule[];
  disqualifyingSignalKeys: string[];
  minEvidenceCount: number;
  minEvidenceQuality: number;
  minOpportunityScore: number;
  notes: string | null;
}

export interface QualificationResearchPage {
  sourceUrl: string;
  fetchedAt: Date | string;
  snapshotSha256: string;
  snapshotBytes: number;
  snapshotTruncated: boolean;
  latencyMs: number;
  responseHeaders: Record<string, string>;
  html: string;
}

export interface QualificationNamedContact {
  email: string;
  firstName: string;
  lastName: string | null;
  position: string;
  sourceUrl: string;
}

export interface OpportunitySignalObservation {
  key: string;
  title: string;
  category: string;
  observation: string;
  opportunity: string;
  evidenceQuality: number;
  sourceUrl: string;
  observedAt: string;
  snapshotSha256: string;
}

export interface WebsiteOpportunityAnalysis {
  observations: OpportunitySignalObservation[];
  detectedTechnologies: string[];
  contactPageUrl: string | null;
}

export interface ProspectCandidate {
  companyName: string;
  domain: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  employeeCount: number | null;
  sourceConfidence: number | null;
  publicEmails: string[];
  phones: string[];
  namedContacts: QualificationNamedContact[];
}

export interface BestPublicContact {
  type: "named_person" | "public_email" | "phone" | "contact_page";
  value: string;
  name: string | null;
  jobTitle: string | null;
  sourceUrl: string;
}

export interface ProspectEvaluation {
  status: ProspectQualificationStatus;
  opportunityScore: number;
  evidenceQuality: number;
  qualificationReasons: string[];
  disqualificationReasons: string[];
  matchedSignals: Array<OpportunitySignalObservation & { scoreContribution: number; required: boolean }>;
  bestContact: BestPublicContact | null;
  outreachAngle: string | null;
}

export interface QualificationSignalDefinition {
  key: string;
  title: string;
  category: "conversion" | "automation" | "mobile" | "trust" | "marketing" | "contactability" | "performance";
  opportunity: string;
}

const DEFINITIONS: QualificationSignalDefinition[] = [
  {
    key: "missing_online_scheduling",
    title: "No online scheduling observed",
    category: "conversion",
    opportunity: "add a self-service scheduling path"
  },
  {
    key: "has_online_scheduling",
    title: "Online scheduling observed",
    category: "conversion",
    opportunity: "build on the existing scheduling experience"
  },
  {
    key: "missing_online_estimate",
    title: "No online estimate or quote path observed",
    category: "conversion",
    opportunity: "add an estimate or quote conversion path"
  },
  {
    key: "has_online_estimate",
    title: "Online estimate or quote path observed",
    category: "conversion",
    opportunity: "improve the existing estimate path"
  },
  {
    key: "missing_after_hours_intake",
    title: "No after-hours intake mechanism observed",
    category: "automation",
    opportunity: "add after-hours lead intake and routing"
  },
  {
    key: "has_after_hours_intake",
    title: "After-hours intake evidence observed",
    category: "automation",
    opportunity: "extend the existing after-hours workflow"
  },
  {
    key: "missing_contact_form",
    title: "No contact form observed",
    category: "conversion",
    opportunity: "add a structured inquiry form"
  },
  {
    key: "has_contact_form",
    title: "Contact form observed",
    category: "conversion",
    opportunity: "optimize the existing inquiry form"
  },
  {
    key: "missing_live_chat",
    title: "No live-chat or automated chat intake observed",
    category: "automation",
    opportunity: "add conversational lead capture"
  },
  {
    key: "has_live_chat",
    title: "Live-chat or automated chat intake observed",
    category: "automation",
    opportunity: "improve the existing chat workflow"
  },
  {
    key: "missing_financing_cta",
    title: "No financing call to action observed",
    category: "conversion",
    opportunity: "make financing options visible in the conversion path"
  },
  {
    key: "has_financing_cta",
    title: "Financing call to action observed",
    category: "conversion",
    opportunity: "optimize the existing financing conversion path"
  },
  {
    key: "missing_conversion_cta",
    title: "No clear conversion call to action observed",
    category: "conversion",
    opportunity: "create a clear request, quote, or booking action"
  },
  {
    key: "has_conversion_cta",
    title: "Conversion call to action observed",
    category: "conversion",
    opportunity: "improve the existing conversion action"
  },
  {
    key: "missing_mobile_viewport",
    title: "Mobile viewport metadata missing",
    category: "mobile",
    opportunity: "repair a directly observable mobile-rendering prerequisite"
  },
  {
    key: "has_mobile_viewport",
    title: "Mobile viewport metadata observed",
    category: "mobile",
    opportunity: "retain the existing mobile viewport configuration"
  },
  {
    key: "missing_local_business_schema",
    title: "LocalBusiness structured data not observed",
    category: "marketing",
    opportunity: "add relevant local-business structured data"
  },
  {
    key: "has_local_business_schema",
    title: "LocalBusiness structured data observed",
    category: "marketing",
    opportunity: "validate and extend existing structured data"
  },
  {
    key: "missing_meta_description",
    title: "Homepage meta description missing",
    category: "marketing",
    opportunity: "add a factual search-result description"
  },
  {
    key: "missing_hsts",
    title: "Strict-Transport-Security header missing",
    category: "trust",
    opportunity: "strengthen the website transport-security posture"
  },
  {
    key: "missing_csp",
    title: "Content-Security-Policy header missing",
    category: "trust",
    opportunity: "add a reviewed browser content policy"
  },
  {
    key: "slow_homepage_response",
    title: "Slow initial homepage response observed",
    category: "performance",
    opportunity: "investigate and reduce initial response latency"
  },
  {
    key: "oversized_homepage",
    title: "Large or truncated homepage HTML observed",
    category: "performance",
    opportunity: "reduce the initial document payload"
  },
  {
    key: "missing_analytics",
    title: "Common analytics instrumentation not observed",
    category: "marketing",
    opportunity: "add measurable conversion instrumentation"
  },
  {
    key: "has_analytics",
    title: "Analytics instrumentation observed",
    category: "marketing",
    opportunity: "use the existing measurement foundation"
  },
  {
    key: "missing_marketing_automation",
    title: "Common marketing automation not observed",
    category: "automation",
    opportunity: "connect inquiries to an automated follow-up workflow"
  },
  {
    key: "has_marketing_automation",
    title: "Marketing automation observed",
    category: "automation",
    opportunity: "improve the existing marketing automation"
  },
  {
    key: "no_public_email",
    title: "No public company email observed",
    category: "contactability",
    opportunity: "improve the public inquiry route"
  },
  {
    key: "has_public_email",
    title: "Public company email observed",
    category: "contactability",
    opportunity: "use the directly published company email"
  },
  {
    key: "no_public_phone",
    title: "No public telephone link observed",
    category: "contactability",
    opportunity: "make a public telephone route directly accessible"
  },
  {
    key: "has_public_phone",
    title: "Public telephone route observed",
    category: "contactability",
    opportunity: "use the directly published telephone route"
  }
];

const DEFINITION_BY_KEY = new Map(DEFINITIONS.map((definition) => [definition.key, definition]));

export function qualificationSignalCatalog(): QualificationSignalDefinition[] {
  return DEFINITIONS.map((definition) => ({ ...definition }));
}

export class QualificationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationContractError";
  }
}

function boundedText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new QualificationContractError(`${field} is required.`);
  const normalized = normalizeSingleLineText(value);
  if (!normalized) throw new QualificationContractError(`${field} is required.`);
  if (normalized.length > maxLength)
    throw new QualificationContractError(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

function boundedStringArray(value: unknown, field: string, minItems: number, maxItems: number): string[] {
  if (!Array.isArray(value)) throw new QualificationContractError(`${field} must be an array.`);
  const normalized = [...new Set(value.map((entry) => boundedText(entry, field, 160)))];
  if (normalized.length < minItems || normalized.length > maxItems) {
    throw new QualificationContractError(`${field} must contain ${minItems}-${maxItems} unique values.`);
  }
  return normalized;
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new QualificationContractError(`${field} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function boundedRatio(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 1) {
    throw new QualificationContractError(`${field} must be between 0.5 and 1.`);
  }
  return Math.round(parsed * 100) / 100;
}

function optionalEmployeeBound(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return boundedInteger(value, field, 1, 10_000_000);
}

function signalKeys(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new QualificationContractError(`${field} must be an array.`);
  const keys = [...new Set(value.map((entry) => boundedText(entry, field, 80)))];
  if (keys.length > 20) throw new QualificationContractError(`${field} cannot contain more than 20 values.`);
  const unsupported = keys.filter((key) => !DEFINITION_BY_KEY.has(key));
  if (unsupported.length)
    throw new QualificationContractError(`${field} contains unsupported signal keys: ${unsupported.join(", ")}.`);
  return keys;
}

export function normalizeQualificationContract(value: unknown): QualificationContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QualificationContractError("A structured qualification contract is required.");
  }
  const input = value as Record<string, unknown>;
  const characteristicsInput = input.targetCompanyCharacteristics;
  if (!characteristicsInput || typeof characteristicsInput !== "object" || Array.isArray(characteristicsInput)) {
    throw new QualificationContractError("targetCompanyCharacteristics must be an object.");
  }
  const characteristics = characteristicsInput as Record<string, unknown>;
  const minEmployees = optionalEmployeeBound(characteristics.minEmployees, "minEmployees");
  const maxEmployees = optionalEmployeeBound(characteristics.maxEmployees, "maxEmployees");
  if (minEmployees !== null && maxEmployees !== null && minEmployees > maxEmployees) {
    throw new QualificationContractError("minEmployees cannot exceed maxEmployees.");
  }
  if (
    !Array.isArray(input.qualifyingSignals) ||
    input.qualifyingSignals.length < 1 ||
    input.qualifyingSignals.length > 20
  ) {
    throw new QualificationContractError("qualifyingSignals must contain 1-20 weighted rules.");
  }
  const qualifyingSignals = input.qualifyingSignals.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new QualificationContractError(`qualifyingSignals[${index}] must be an object.`);
    }
    const rule = entry as Record<string, unknown>;
    const key = boundedText(rule.key, `qualifyingSignals[${index}].key`, 80);
    if (!DEFINITION_BY_KEY.has(key)) throw new QualificationContractError(`Unsupported qualifying signal key: ${key}.`);
    return {
      key,
      weight: boundedInteger(rule.weight, `qualifyingSignals[${index}].weight`, 1, 100),
      required: rule.required === true
    };
  });
  if (new Set(qualifyingSignals.map((rule) => rule.key)).size !== qualifyingSignals.length) {
    throw new QualificationContractError("qualifyingSignals cannot contain duplicate keys.");
  }
  const disqualifyingSignalKeys = signalKeys(input.disqualifyingSignalKeys ?? [], "disqualifyingSignalKeys");
  const overlap = qualifyingSignals.filter((rule) => disqualifyingSignalKeys.includes(rule.key));
  if (overlap.length)
    throw new QualificationContractError(
      `A signal cannot both qualify and disqualify: ${overlap.map((rule) => rule.key).join(", ")}.`
    );
  return {
    schemaVersion: 1,
    clientOffer: boundedText(input.clientOffer, "clientOffer", 500),
    targetIndustries: boundedStringArray(input.targetIndustries, "targetIndustries", 1, 25),
    targetGeography: boundedStringArray(input.targetGeography, "targetGeography", 1, 25),
    targetCompanyCharacteristics: {
      minEmployees,
      maxEmployees,
      allowUnknownEmployeeCount: characteristics.allowUnknownEmployeeCount !== false,
      minSourceConfidence: boundedRatio(characteristics.minSourceConfidence ?? 0.65, "minSourceConfidence"),
      requirePublicEmail: characteristics.requirePublicEmail === true,
      requirePublicPhone: characteristics.requirePublicPhone === true,
      requiredTechnologies: boundedStringArray(
        characteristics.requiredTechnologies ?? [],
        "requiredTechnologies",
        0,
        20
      ),
      excludedTechnologies: boundedStringArray(
        characteristics.excludedTechnologies ?? [],
        "excludedTechnologies",
        0,
        20
      )
    },
    desiredBuyerRoles: boundedStringArray(input.desiredBuyerRoles, "desiredBuyerRoles", 1, 25),
    qualifyingSignals,
    disqualifyingSignalKeys,
    minEvidenceCount: boundedInteger(input.minEvidenceCount, "minEvidenceCount", 1, 20),
    minEvidenceQuality: boundedRatio(input.minEvidenceQuality, "minEvidenceQuality"),
    minOpportunityScore: boundedInteger(input.minOpportunityScore, "minOpportunityScore", 1, 100),
    notes:
      input.notes === null || input.notes === undefined || input.notes === ""
        ? null
        : boundedText(input.notes, "notes", 1000)
  };
}

function hasPattern(html: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(html);
}

function observedAtIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function analyzeWebsiteOpportunity(input: {
  pages: QualificationResearchPage[];
  publicEmails: string[];
  phones: string[];
}): WebsiteOpportunityAnalysis {
  if (!Array.isArray(input.pages) || input.pages.length === 0)
    return { observations: [], detectedTechnologies: [], contactPageUrl: null };
  const pages = input.pages.filter((page) => page.html && page.snapshotSha256 && page.sourceUrl);
  if (pages.length === 0) return { observations: [], detectedTechnologies: [], contactPageUrl: null };
  const homepage = pages[0];
  const combinedHtml = pages
    .map((page) => page.html)
    .join("\n")
    .toLowerCase();
  const successfulPageCount = pages.length;
  const absenceQuality = successfulPageCount >= 3 ? 0.9 : successfulPageCount === 2 ? 0.82 : 0.7;
  const contactPage = pages.find((page) => {
    try {
      return /\b(contact|estimate|quote|schedule|book)\b/i.test(new URL(page.sourceUrl).pathname);
    } catch {
      return false;
    }
  });
  const technologies = new Set<string>();
  if (/__next|\/_next\//i.test(combinedHtml)) technologies.add("Next.js");
  if (/data-reactroot|react-dom/i.test(combinedHtml)) technologies.add("React");
  if (/__nuxt/i.test(combinedHtml)) technologies.add("Nuxt");
  if (/wp-content\/|wp-includes\//i.test(combinedHtml)) technologies.add("WordPress");
  if (/cdn\.shopify\.com|shopify\.theme/i.test(combinedHtml)) technologies.add("Shopify");
  if (/js\.hs-scripts\.com|hubspotutk/i.test(combinedHtml)) technologies.add("HubSpot");
  if (/js\.stripe\.com/i.test(combinedHtml)) technologies.add("Stripe");
  if (/googletagmanager\.com|google-analytics\.com|gtag\s*\(/i.test(combinedHtml))
    technologies.add("Google Analytics / GTM");
  if (/widget\.intercom\.io/i.test(combinedHtml)) technologies.add("Intercom");

  const facts = {
    scheduling: hasPattern(
      combinedHtml,
      /(?:schedule|appointment|book(?:ing)?(?:\s+online)?|calendly|acuity|servicetitan)/i
    ),
    estimate: hasPattern(
      combinedHtml,
      /(?:request|get|free|online)\s+(?:an?\s+)?(?:estimate|quote)|estimate\s+request|quote\s+request/i
    ),
    afterHours: hasPattern(
      combinedHtml,
      /24\s*(?:\/|hours?\s+a\s+day)\s*7|24[-\s]?hour|after[-\s]?hours?|emergency\s+(?:service|repair|response)/i
    ),
    contactForm: hasPattern(combinedHtml, /<form\b[^>]*>[\s\S]*?(?:<input\b|<textarea\b|<select\b)/i),
    liveChat: hasPattern(
      combinedHtml,
      /intercom|drift\.com|tidio|crisp\.chat|livechatinc|chat[-_ ]widget|hubspot-messages|tawk\.to/i
    ),
    financing: hasPattern(combinedHtml, /\bfinanc(?:e|ing)\b|payment\s+plan|monthly\s+payment/i),
    conversionCta: hasPattern(
      combinedHtml,
      /(?:call\s+now|contact\s+us|request\s+(?:service|a\s+quote|an?\s+estimate)|get\s+(?:a\s+)?(?:quote|estimate)|schedule\s+(?:service|an?\s+appointment)|book\s+(?:online|now|service))/i
    ),
    mobileViewport: hasPattern(homepage.html, /<meta\b[^>]*name\s*=\s*["']viewport["']/i),
    localBusinessSchema: hasPattern(
      combinedHtml,
      /["']@type["']\s*:\s*["'][^"']*(?:LocalBusiness|HVACBusiness|HomeAndConstructionBusiness|ProfessionalService|Store|Restaurant|MedicalBusiness)[^"']*["']/i
    ),
    metaDescription:
      hasPattern(homepage.html, /<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']+/i) ||
      hasPattern(homepage.html, /<meta\b[^>]*content\s*=\s*["'][^"']+["'][^>]*name\s*=\s*["']description["']/i),
    analytics: hasPattern(combinedHtml, /googletagmanager\.com|google-analytics\.com|gtag\s*\(|plausible\.io|matomo/i),
    marketingAutomation: hasPattern(
      combinedHtml,
      /js\.hs-scripts\.com|hubspotutk|marketo|pardot|mailchimp|activecampaign/i
    ),
    hsts: Object.keys(homepage.responseHeaders).some((key) => key.toLowerCase() === "strict-transport-security"),
    csp: Object.keys(homepage.responseHeaders).some((key) => key.toLowerCase() === "content-security-policy"),
    slow: homepage.latencyMs >= 3_000,
    oversized: homepage.snapshotTruncated || homepage.snapshotBytes >= 350 * 1024,
    publicEmail: input.publicEmails.length > 0,
    publicPhone: input.phones.length > 0
  };

  const observations: OpportunitySignalObservation[] = [];
  const add = (present: boolean, positiveKey: string, missingKey: string, directDescription: string) => {
    const selectedKey = present ? positiveKey : missingKey;
    const definition = DEFINITION_BY_KEY.get(selectedKey);
    if (!definition) return;
    observations.push({
      ...definition,
      observation: present
        ? directDescription
        : `${definition.title} across ${successfulPageCount} bounded public page${successfulPageCount === 1 ? "" : "s"} crawled.`,
      evidenceQuality: present ? 1 : absenceQuality,
      sourceUrl: homepage.sourceUrl,
      observedAt: observedAtIso(homepage.fetchedAt),
      snapshotSha256: homepage.snapshotSha256
    });
  };

  add(
    facts.scheduling,
    "has_online_scheduling",
    "missing_online_scheduling",
    "An online scheduling or appointment path was directly observed in the crawled website markup."
  );
  add(
    facts.estimate,
    "has_online_estimate",
    "missing_online_estimate",
    "An estimate or quote request path was directly observed in the crawled website markup."
  );
  add(
    facts.afterHours,
    "has_after_hours_intake",
    "missing_after_hours_intake",
    "After-hours or emergency-service language was directly observed on the public website."
  );
  add(
    facts.contactForm,
    "has_contact_form",
    "missing_contact_form",
    "A public HTML inquiry form was directly observed."
  );
  add(
    facts.liveChat,
    "has_live_chat",
    "missing_live_chat",
    "A recognized public chat widget marker was directly observed."
  );
  add(
    facts.financing,
    "has_financing_cta",
    "missing_financing_cta",
    "Financing or payment-plan language was directly observed."
  );
  add(
    facts.conversionCta,
    "has_conversion_cta",
    "missing_conversion_cta",
    "A direct call, contact, quote, estimate, booking, or scheduling action was observed."
  );
  add(
    facts.mobileViewport,
    "has_mobile_viewport",
    "missing_mobile_viewport",
    "The homepage contains viewport metadata for mobile rendering."
  );
  add(
    facts.localBusinessSchema,
    "has_local_business_schema",
    "missing_local_business_schema",
    "Local-business JSON-LD structured data was directly observed."
  );
  add(
    facts.analytics,
    "has_analytics",
    "missing_analytics",
    "A recognized analytics instrumentation marker was directly observed."
  );
  add(
    facts.marketingAutomation,
    "has_marketing_automation",
    "missing_marketing_automation",
    "A recognized marketing-automation marker was directly observed."
  );
  add(
    facts.publicEmail,
    "has_public_email",
    "no_public_email",
    facts.publicEmail ? `A public company email was directly observed: ${input.publicEmails[0]}.` : ""
  );
  add(
    facts.publicPhone,
    "has_public_phone",
    "no_public_phone",
    facts.publicPhone ? `A public telephone route was directly observed: ${input.phones[0]}.` : ""
  );

  const addOneWay = (key: string, present: boolean, observation: string, quality = 1) => {
    if (!present) return;
    const definition = DEFINITION_BY_KEY.get(key);
    if (!definition) return;
    observations.push({
      ...definition,
      observation,
      evidenceQuality: quality,
      sourceUrl: homepage.sourceUrl,
      observedAt: observedAtIso(homepage.fetchedAt),
      snapshotSha256: homepage.snapshotSha256
    });
  };
  addOneWay(
    "missing_meta_description",
    !facts.metaDescription,
    "The homepage HTML contains no non-empty meta description.",
    1
  );
  addOneWay(
    "missing_hsts",
    !facts.hsts,
    "The homepage response did not include a Strict-Transport-Security header.",
    1
  );
  addOneWay("missing_csp", !facts.csp, "The homepage response did not include a Content-Security-Policy header.", 1);
  addOneWay(
    "slow_homepage_response",
    facts.slow,
    `The measured initial homepage request took ${homepage.latencyMs} ms.`,
    1
  );
  addOneWay(
    "oversized_homepage",
    facts.oversized,
    homepage.snapshotTruncated
      ? "The homepage evidence snapshot reached the configured byte limit and was truncated."
      : `The homepage HTML snapshot was ${homepage.snapshotBytes} bytes.`,
    1
  );

  return {
    observations,
    detectedTechnologies: [...technologies].sort(),
    contactPageUrl: contactPage?.sourceUrl || null
  };
}

function normalizedTechnologySet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase().replace(/\s+/g, " ").trim()));
}

function chooseBestContact(
  contract: QualificationContract,
  candidate: ProspectCandidate,
  contactPageUrl: string | null
): BestPublicContact | null {
  const desiredRoleTokens = contract.desiredBuyerRoles.flatMap((role) =>
    role
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
  const rankedContacts = [...candidate.namedContacts].sort((left, right) => {
    const leftScore = desiredRoleTokens.filter((token) => left.position.toLowerCase().includes(token)).length;
    const rightScore = desiredRoleTokens.filter((token) => right.position.toLowerCase().includes(token)).length;
    return rightScore - leftScore || left.email.localeCompare(right.email);
  });
  const named = rankedContacts[0];
  if (named) {
    return {
      type: "named_person",
      value: named.email,
      name: `${named.firstName}${named.lastName ? ` ${named.lastName}` : ""}`,
      jobTitle: named.position,
      sourceUrl: named.sourceUrl
    };
  }
  if (candidate.publicEmails[0])
    return {
      type: "public_email",
      value: candidate.publicEmails[0],
      name: null,
      jobTitle: null,
      sourceUrl: `https://${candidate.domain}/`
    };
  if (candidate.phones[0])
    return {
      type: "phone",
      value: candidate.phones[0],
      name: null,
      jobTitle: null,
      sourceUrl: `https://${candidate.domain}/`
    };
  if (contactPageUrl)
    return { type: "contact_page", value: contactPageUrl, name: null, jobTitle: null, sourceUrl: contactPageUrl };
  return null;
}

export function evaluateProspect(input: {
  contract: QualificationContract;
  candidate: ProspectCandidate;
  analysis: WebsiteOpportunityAnalysis;
}): ProspectEvaluation {
  const { contract, candidate, analysis } = input;
  const observationByKey = new Map(analysis.observations.map((observation) => [observation.key, observation]));
  const totalWeight = contract.qualifyingSignals.reduce((sum, rule) => sum + rule.weight, 0);
  const matchedSignals = contract.qualifyingSignals.flatMap((rule) => {
    const observation = observationByKey.get(rule.key);
    if (!observation) return [];
    return [
      {
        ...observation,
        scoreContribution: Math.round((rule.weight / totalWeight) * 1000) / 10,
        required: rule.required
      }
    ];
  });
  const matchedWeight = contract.qualifyingSignals.reduce(
    (sum, rule) => sum + (observationByKey.has(rule.key) ? rule.weight : 0),
    0
  );
  const opportunityScore = Math.round((matchedWeight / totalWeight) * 1000) / 10;
  const weightedQuality = matchedSignals.reduce((sum, signal) => {
    const rule = contract.qualifyingSignals.find((candidateRule) => candidateRule.key === signal.key);
    return rule ? sum + signal.evidenceQuality * rule.weight : sum;
  }, 0);
  const evidenceQuality = matchedWeight ? Math.round((weightedQuality / matchedWeight) * 100) / 100 : 0;
  const reasons = matchedSignals.map((signal) => signal.key);
  const disqualificationReasons: string[] = [];
  for (const rule of contract.qualifyingSignals.filter((candidateRule) => candidateRule.required)) {
    if (!observationByKey.has(rule.key)) {
      const definition = DEFINITION_BY_KEY.get(rule.key);
      disqualificationReasons.push(`Required qualifying signal was not observed: ${definition?.title || rule.key}.`);
    }
  }
  for (const key of contract.disqualifyingSignalKeys) {
    const observation = observationByKey.get(key);
    if (observation) disqualificationReasons.push(`Disqualifying condition observed: ${observation.title}.`);
  }
  const characteristics = contract.targetCompanyCharacteristics;
  if (candidate.sourceConfidence === null || candidate.sourceConfidence < characteristics.minSourceConfidence) {
    disqualificationReasons.push(
      `Source confidence ${candidate.sourceConfidence === null ? "was unavailable" : `was ${candidate.sourceConfidence}`} below the required ${characteristics.minSourceConfidence}.`
    );
  }
  if (candidate.employeeCount === null) {
    if (
      !characteristics.allowUnknownEmployeeCount &&
      (characteristics.minEmployees !== null || characteristics.maxEmployees !== null)
    ) {
      disqualificationReasons.push("Employee count was required but not publicly evidenced.");
    }
  } else {
    if (characteristics.minEmployees !== null && candidate.employeeCount < characteristics.minEmployees)
      disqualificationReasons.push(
        `Employee count ${candidate.employeeCount} was below the required minimum ${characteristics.minEmployees}.`
      );
    if (characteristics.maxEmployees !== null && candidate.employeeCount > characteristics.maxEmployees)
      disqualificationReasons.push(
        `Employee count ${candidate.employeeCount} exceeded the allowed maximum ${characteristics.maxEmployees}.`
      );
  }
  if (characteristics.requirePublicEmail && candidate.publicEmails.length === 0)
    disqualificationReasons.push("A directly published company email was required but not observed.");
  if (characteristics.requirePublicPhone && candidate.phones.length === 0)
    disqualificationReasons.push("A directly published telephone route was required but not observed.");
  const technologies = normalizedTechnologySet(analysis.detectedTechnologies);
  for (const required of characteristics.requiredTechnologies) {
    if (!technologies.has(required.toLowerCase()))
      disqualificationReasons.push(`Required technology was not observed: ${required}.`);
  }
  for (const excluded of characteristics.excludedTechnologies) {
    if (technologies.has(excluded.toLowerCase()))
      disqualificationReasons.push(`Excluded technology was observed: ${excluded}.`);
  }

  const thresholdReasons: string[] = [];
  if (matchedSignals.length < contract.minEvidenceCount)
    thresholdReasons.push(
      `Only ${matchedSignals.length} qualifying observations met the minimum evidence count of ${contract.minEvidenceCount}.`
    );
  if (evidenceQuality < contract.minEvidenceQuality)
    thresholdReasons.push(
      `Evidence quality ${evidenceQuality.toFixed(2)} was below the required ${contract.minEvidenceQuality.toFixed(2)}.`
    );
  if (opportunityScore < contract.minOpportunityScore)
    thresholdReasons.push(
      `Opportunity score ${opportunityScore.toFixed(1)} was below the required ${contract.minOpportunityScore}.`
    );
  const status: ProspectQualificationStatus = disqualificationReasons.length
    ? "disqualified"
    : thresholdReasons.length
      ? "insufficient_evidence"
      : "qualified";
  const bestContact = chooseBestContact(contract, candidate, analysis.contactPageUrl);
  const qualificationReasons = reasons;
  return {
    status,
    opportunityScore,
    evidenceQuality,
    qualificationReasons,
    disqualificationReasons: [...disqualificationReasons, ...thresholdReasons],
    matchedSignals,
    bestContact,
    outreachAngle: null
  };
}
