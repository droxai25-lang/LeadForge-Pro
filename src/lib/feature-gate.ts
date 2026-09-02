/**
 * feature-gate.ts
 *
 * Explicit feature availability checks for optional/paid provider services.
 * The LeadForge Pro local edition intentionally avoids external paid APIs.
 * This module documents which features require configuration or external services.
 */

export interface FeatureAvailability {
  available: boolean;
  reason: "configured" | "not_configured" | "disabled" | "unavailable";
  configKey?: string;
}

/**
 * Checks whether AI-powered features are enabled.
 * Currently requires an LLM endpoint and API key to be configured.
 * Falls back to `false` if not configured (feature is optional).
 */
export function checkAIFeatureAvailable(): FeatureAvailability {
  const llmEndpoint = process.env.LLM_API_ENDPOINT?.trim();
  const llmApiKey = process.env.LLM_API_KEY?.trim();

  if (!llmEndpoint || !llmApiKey) {
    return {
      available: false,
      reason: "not_configured",
      configKey: "LLM_API_ENDPOINT and LLM_API_KEY"
    };
  }

  return {
    available: true,
    reason: "configured"
  };
}

/**
 * Checks whether lead discovery via web crawl/scraping is enabled.
 * This requires external infrastructure (Redis, external scraper, etc.).
 * Falls back to `false` if not configured (feature is optional).
 */
export function checkDiscoveryFeatureAvailable(): FeatureAvailability {
  const discoveryEnabled = process.env.DISCOVERY_ENABLED?.toLowerCase() === "true";
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!discoveryEnabled) {
    return {
      available: false,
      reason: "disabled"
    };
  }

  if (!redisUrl) {
    return {
      available: false,
      reason: "not_configured",
      configKey: "REDIS_URL"
    };
  }

  return {
    available: true,
    reason: "configured"
  };
}

/**
 * Checks whether external email verification (third-party API) is enabled.
 * Falls back to `false` if not configured (feature is optional).
 */
export function checkEmailVerificationProviderAvailable(): FeatureAvailability {
  const verificationEndpoint = process.env.EMAIL_VERIFICATION_ENDPOINT?.trim();
  const verificationKey = process.env.EMAIL_VERIFICATION_API_KEY?.trim();

  if (!verificationEndpoint || !verificationKey) {
    return {
      available: false,
      reason: "not_configured",
      configKey: "EMAIL_VERIFICATION_ENDPOINT and EMAIL_VERIFICATION_API_KEY"
    };
  }

  return {
    available: true,
    reason: "configured"
  };
}

/**
 * Returns a user-facing status message explaining why a feature is unavailable.
 * Used to return clear API responses when optional providers are not configured.
 */
export function featureUnavailableMessage(feature: string, availability: FeatureAvailability): string {
  switch (availability.reason) {
    case "not_configured":
      return `${feature} is not available. Required configuration: ${availability.configKey}`;
    case "disabled":
      return `${feature} has been disabled in this deployment.`;
    case "unavailable":
      return `${feature} is temporarily unavailable. Please try again later.`;
    default:
      return `${feature} is not available.`;
  }
}
