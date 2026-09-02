export interface HygieneLeadRecord {
  readonly id: string;
  readonly email: string;
  readonly companyName: string;
  readonly companyDomain: string;
  readonly verificationStatus: string;
  readonly fitScore: number;
  readonly stage: string;
  readonly updatedAt?: Date | string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function isValidPublicDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  if (normalized.length > 253 || !normalized.includes(".")) return false;
  return normalized
    .split(".")
    .every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

export function buildHygieneAudit<T extends HygieneLeadRecord>(leads: readonly T[]) {
  const emailGroups = new Map<string, T[]>();
  for (const lead of leads) {
    const normalizedEmail = lead.email.trim().toLowerCase();
    const group = emailGroups.get(normalizedEmail) || [];
    group.push(lead);
    emailGroups.set(normalizedEmail, group);
  }

  const duplicateGroups = Array.from(emailGroups.entries())
    .filter(([email, group]) => Boolean(email) && group.length > 1)
    .map(([email, group]) => {
      const sorted = [...group].sort((left, right) => {
        const scoreDifference = right.fitScore - left.fitScore;
        if (scoreDifference !== 0) return scoreDifference;
        return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
      });
      return {
        email,
        count: sorted.length,
        leadIds: sorted.map((lead) => lead.id),
        leads: sorted
      };
    });

  const domainIssues = leads
    .filter((lead) => !isValidPublicDomain(lead.companyDomain))
    .map((lead) => ({
      leadId: lead.id,
      email: lead.email,
      companyName: lead.companyName,
      domain: lead.companyDomain,
      reason: lead.companyDomain ? "Malformed or non-public company domain" : "Missing company domain"
    }));

  const emailFormatIssues = leads
    .filter((lead) => !isValidEmail(lead.email))
    .map((lead) => ({
      leadId: lead.id,
      email: lead.email,
      companyName: lead.companyName,
      reason: lead.email ? "Malformed email syntax" : "Missing email address"
    }));

  const invalidStatuses = new Set(["disposable", "invalid", "mx_not_found"]);
  const disposableIssues = leads
    .filter((lead) => invalidStatuses.has(lead.verificationStatus))
    .map((lead) => ({
      leadId: lead.id,
      email: lead.email,
      companyName: lead.companyName,
      domain: normalizeDomain(lead.companyDomain)
    }));

  const staleZeroFitIssues = leads
    .filter((lead) => lead.fitScore <= 0)
    .map((lead) => ({
      leadId: lead.id,
      email: lead.email,
      companyName: lead.companyName,
      fitScore: lead.fitScore,
      stage: lead.stage
    }));

  const flaggedLeadIds = new Set<string>();
  for (const group of duplicateGroups) {
    for (const leadId of group.leadIds.slice(1)) flaggedLeadIds.add(leadId);
  }
  for (const issue of [...domainIssues, ...emailFormatIssues, ...disposableIssues, ...staleZeroFitIssues]) {
    flaggedLeadIds.add(issue.leadId);
  }

  const healthScore =
    leads.length === 0 ? 100 : Math.max(0, Math.round(((leads.length - flaggedLeadIds.size) / leads.length) * 100));

  return {
    summary: {
      totalLeads: leads.length,
      healthScore,
      totalFlaggedIssues: flaggedLeadIds.size,
      duplicateEmailsCount: duplicateGroups.length,
      redundantDuplicatesCount: duplicateGroups.reduce((total, group) => total + group.count - 1, 0),
      invalidDomainCount: domainIssues.length,
      invalidEmailFormatCount: emailFormatIssues.length,
      disposableOrInvalidCount: disposableIssues.length,
      staleZeroFitCount: staleZeroFitIssues.length
    },
    duplicateGroups,
    domainIssues,
    emailFormatIssues,
    disposableIssues,
    staleZeroFitIssues
  };
}
