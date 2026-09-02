import type { QualificationContract } from "./opportunityQualification";
import { loadAutonomousGeoNamesLocations } from "./geoNames";

export interface AutonomousSellerProfile {
  name: string;
  website: string;
  offer: string;
  capabilities: string[];
}

export interface AutonomousDiscoveryMission {
  cursor: number;
  locationIndex: number;
  coverageCycle: number;
  location: string;
  radiusKm: number;
  rowOffset: number;
  companyLimit: number;
  minConfidence: number;
  geoNamesId: string;
}

export const DROXAI_SELLER_PROFILE: AutonomousSellerProfile = {
  name: "DroxAI LLC",
  website: "https://droxaillc.com/",
  offer:
    "Website conversion improvements, AI-assisted customer intake, workflow automation, follow-up automation, and practical digital systems that help businesses capture and handle more opportunities.",
  capabilities: [
    "website conversion and lead-capture improvement",
    "online estimate, quote, appointment, and inquiry workflows",
    "AI-assisted after-hours intake and conversational lead capture",
    "customer follow-up and marketing workflow automation",
    "analytics, structured data, performance, and website trust improvements"
  ]
};

const RESULT_PAGES_PER_LOCATION = 20;

export async function autonomousCoverageSize(): Promise<number> {
  return (await loadAutonomousGeoNamesLocations()).length * RESULT_PAGES_PER_LOCATION;
}

export async function autonomousMissionAt(cursor: number, companyLimit = 25): Promise<AutonomousDiscoveryMission> {
  const safeCursor = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  const locations = await loadAutonomousGeoNamesLocations();
  const locationIndex = safeCursor % locations.length;
  const coverageCycle = Math.floor(safeCursor / locations.length) % RESULT_PAGES_PER_LOCATION;
  const location = locations[locationIndex];
  return {
    cursor: safeCursor,
    locationIndex,
    coverageCycle,
    location: location.query,
    radiusKm: 50,
    rowOffset: coverageCycle * companyLimit * 5,
    companyLimit,
    minConfidence: 0.65,
    geoNamesId: location.id
  };
}

export function buildDroxAiAutopilotContract(): QualificationContract {
  return {
    schemaVersion: 1,
    clientOffer: DROXAI_SELLER_PROFILE.offer,
    targetIndustries: ["All public business categories with an owned website"],
    targetGeography: ["Autonomous global discovery frontier"],
    targetCompanyCharacteristics: {
      minEmployees: null,
      maxEmployees: null,
      allowUnknownEmployeeCount: true,
      minSourceConfidence: 0.65,
      requirePublicEmail: false,
      requirePublicPhone: false,
      requiredTechnologies: [],
      excludedTechnologies: []
    },
    desiredBuyerRoles: ["Owner", "Founder", "General Manager", "Operations Manager", "Marketing Director"],
    qualifyingSignals: [
      { key: "slow_homepage_response", weight: 50, required: false },
      { key: "oversized_homepage", weight: 50, required: false }
    ],
    disqualifyingSignalKeys: [],
    minEvidenceCount: 1,
    minEvidenceQuality: 1,
    minOpportunityScore: 50,
    notes:
      "Autonomous discovery only promotes directly measurable homepage performance problems. Absence-based website feature checks remain available for manual research but never qualify prospects automatically."
  };
}
