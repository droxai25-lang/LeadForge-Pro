export class RuntimeConfigurationError extends Error {}

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "::1", "localhost"]);
const SUPPORTED_SERVER_HOSTS = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0", "::"]);

export interface RuntimeSafetyConfiguration {
  readonly localOnlyMode: boolean;
  readonly containerized: boolean;
  readonly serverHost: string;
}

export interface DeliveryConfigurationReadiness {
  readonly smtpSendingEnabled: boolean;
  readonly appUrlValid: boolean;
  readonly unsubscribeSecretStrong: boolean;
  readonly deliveryWebhookSecretStrong: boolean;
  readonly ready: boolean;
}

export function shouldUseSecureCookies(environment: NodeJS.ProcessEnv): boolean {
  return environment.NODE_ENV === "production" && environment.LOCAL_ONLY_MODE !== "true";
}

function parseBooleanFlag(environment: NodeJS.ProcessEnv, name: string, defaultValue: boolean): boolean {
  const configuredValue = environment[name]?.trim().toLowerCase();
  if (!configuredValue) return defaultValue;
  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;
  throw new RuntimeConfigurationError(`${name} must be either true or false.`);
}

function isLoopbackUrl(configuredValue: string, settingName: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(configuredValue);
  } catch {
    throw new RuntimeConfigurationError(`${settingName} must contain valid absolute URLs.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new RuntimeConfigurationError(`${settingName} must use HTTP(S) URLs.`);
  }
  return LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase());
}

export function validateRuntimeSafety(environment: NodeJS.ProcessEnv): RuntimeSafetyConfiguration {
  const localOnlyMode = parseBooleanFlag(environment, "LOCAL_ONLY_MODE", true);
  const containerized = parseBooleanFlag(environment, "CONTAINERIZED", false);
  const serverHost = (environment.HOST || "127.0.0.1").trim().toLowerCase();

  if (!SUPPORTED_SERVER_HOSTS.has(serverHost)) {
    throw new RuntimeConfigurationError("HOST must be one of 127.0.0.1, ::1, localhost, 0.0.0.0, or ::.");
  }

  const wildcardHost = serverHost === "0.0.0.0" || serverHost === "::";
  if (localOnlyMode && wildcardHost && !containerized) {
    throw new RuntimeConfigurationError("LOCAL_ONLY_MODE forbids a wildcard HOST outside the containerized runtime.");
  }

  if (localOnlyMode && environment.SMTP_SENDING_ENABLED?.trim().toLowerCase() === "true") {
    throw new RuntimeConfigurationError("LOCAL_ONLY_MODE requires SMTP_SENDING_ENABLED=false.");
  }

  const configuredAppUrl = environment.APP_URL?.trim();
  if (localOnlyMode && configuredAppUrl && !isLoopbackUrl(configuredAppUrl, "APP_URL")) {
    throw new RuntimeConfigurationError("LOCAL_ONLY_MODE permits APP_URL only on localhost or a loopback address.");
  }

  const allowedOrigins = (environment.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (localOnlyMode && allowedOrigins.some((origin) => !isLoopbackUrl(origin, "CORS_ORIGINS"))) {
    throw new RuntimeConfigurationError("LOCAL_ONLY_MODE permits only localhost or loopback CORS origins.");
  }

  return { localOnlyMode, containerized, serverHost };
}

export function validateAppUrl(
  configuredValue: string | undefined,
  options: { readonly required: boolean; readonly production: boolean }
): string {
  const configuredAppUrl = (configuredValue || "").trim().replace(/\/+$/, "");
  if (!configuredAppUrl) {
    if (options.required) {
      throw new RuntimeConfigurationError("APP_URL is required for tracking and unsubscribe links.");
    }
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredAppUrl);
  } catch {
    throw new RuntimeConfigurationError("APP_URL must be a valid absolute HTTP(S) URL without embedded whitespace.");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new RuntimeConfigurationError("APP_URL must be a valid absolute HTTP(S) URL.");
  }
  if (options.production && parsed.protocol !== "https:") {
    throw new RuntimeConfigurationError("APP_URL must use HTTPS in production.");
  }
  return configuredAppUrl;
}

export function getDeliveryConfigurationReadiness(environment: NodeJS.ProcessEnv): DeliveryConfigurationReadiness {
  let appUrlValid = false;
  try {
    appUrlValid = Boolean(
      validateAppUrl(environment.APP_URL, {
        required: true,
        production: environment.NODE_ENV === "production"
      })
    );
  } catch {
    appUrlValid = false;
  }
  const unsubscribeSecretStrong = (environment.UNSUBSCRIBE_SECRET || "").trim().length >= 32;
  const deliveryWebhookSecretStrong = (environment.DELIVERY_WEBHOOK_SECRET || "").trim().length >= 32;
  const smtpSendingEnabled = environment.SMTP_SENDING_ENABLED === "true";
  return {
    smtpSendingEnabled,
    appUrlValid,
    unsubscribeSecretStrong,
    deliveryWebhookSecretStrong,
    ready: smtpSendingEnabled && appUrlValid && unsubscribeSecretStrong && deliveryWebhookSecretStrong
  };
}
