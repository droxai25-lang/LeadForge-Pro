import { describe, expect, it } from "vitest";
import {
  RuntimeConfigurationError,
  getDeliveryConfigurationReadiness,
  shouldUseSecureCookies,
  validateAppUrl,
  validateRuntimeSafety
} from "../src/lib/runtimeConfiguration";

describe("validateRuntimeSafety", () => {
  it("defaults direct execution to loopback-only local operation", () => {
    expect(validateRuntimeSafety({})).toEqual({
      localOnlyMode: true,
      containerized: false,
      serverHost: "127.0.0.1"
    });
  });

  it("allows the Docker service to listen inside its network namespace", () => {
    expect(
      validateRuntimeSafety({
        LOCAL_ONLY_MODE: "true",
        CONTAINERIZED: "true",
        HOST: "0.0.0.0",
        SMTP_SENDING_ENABLED: "false",
        APP_URL: "",
        CORS_ORIGINS: "http://127.0.0.1:3000,http://localhost:3000"
      })
    ).toMatchObject({
      localOnlyMode: true,
      containerized: true,
      serverHost: "0.0.0.0"
    });
  });

  it("rejects public exposure and outbound sending in local-only mode", () => {
    expect(() => validateRuntimeSafety({ HOST: "0.0.0.0" })).toThrow("forbids a wildcard HOST");
    expect(() => validateRuntimeSafety({ SMTP_SENDING_ENABLED: "true" })).toThrow(
      "requires SMTP_SENDING_ENABLED=false"
    );
    expect(() => validateRuntimeSafety({ APP_URL: "https://leads.example.com" })).toThrow(
      "permits APP_URL only on localhost"
    );
    expect(() => validateRuntimeSafety({ CORS_ORIGINS: "https://leads.example.com" })).toThrow(
      "permits only localhost or loopback CORS origins"
    );
  });

  it("requires explicit valid boolean flags and supported server hosts", () => {
    expect(() => validateRuntimeSafety({ LOCAL_ONLY_MODE: "yes" })).toThrow("must be either true or false");
    expect(() => validateRuntimeSafety({ HOST: "192.168.1.50" })).toThrow("HOST must be one of");
  });

  it("permits a deliberate public deployment configuration", () => {
    expect(
      validateRuntimeSafety({
        LOCAL_ONLY_MODE: "false",
        CONTAINERIZED: "true",
        HOST: "0.0.0.0",
        SMTP_SENDING_ENABLED: "true",
        APP_URL: "https://leads.example.com",
        CORS_ORIGINS: "https://leads.example.com"
      })
    ).toMatchObject({
      localOnlyMode: false,
      containerized: true,
      serverHost: "0.0.0.0"
    });
  });
});

describe("shouldUseSecureCookies", () => {
  it("allows the enforced loopback HTTP runtime while keeping public production cookies secure", () => {
    expect(shouldUseSecureCookies({ NODE_ENV: "production", LOCAL_ONLY_MODE: "true" })).toBe(false);
    expect(shouldUseSecureCookies({ NODE_ENV: "production", LOCAL_ONLY_MODE: "false" })).toBe(true);
    expect(shouldUseSecureCookies({ NODE_ENV: "development", LOCAL_ONLY_MODE: "true" })).toBe(false);
  });
});

describe("validateAppUrl", () => {
  it("normalizes a valid production HTTPS URL", () => {
    expect(validateAppUrl("  https://app.example.com///  ", { required: true, production: true })).toBe(
      "https://app.example.com"
    );
  });

  it("rejects malformed and insecure production URLs", () => {
    expect(() => validateAppUrl("https://app.example.com extra", { required: true, production: true })).toThrow(
      RuntimeConfigurationError
    );
    expect(() => validateAppUrl("http://app.example.com", { required: true, production: true })).toThrow(
      "APP_URL must use HTTPS in production"
    );
  });

  it("allows an absent URL only when the caller does not require one", () => {
    expect(validateAppUrl(undefined, { required: false, production: true })).toBe("");
    expect(() => validateAppUrl(undefined, { required: true, production: true })).toThrow("APP_URL is required");
  });
});

describe("getDeliveryConfigurationReadiness", () => {
  it("reports each fail-closed delivery prerequisite without exposing values", () => {
    expect(
      getDeliveryConfigurationReadiness({
        NODE_ENV: "production",
        SMTP_SENDING_ENABLED: "true",
        APP_URL: "https://leadforge.example.com",
        UNSUBSCRIBE_SECRET: "u".repeat(32),
        DELIVERY_WEBHOOK_SECRET: "d".repeat(32)
      })
    ).toEqual({
      smtpSendingEnabled: true,
      appUrlValid: true,
      unsubscribeSecretStrong: true,
      deliveryWebhookSecretStrong: true,
      ready: true
    });

    expect(
      getDeliveryConfigurationReadiness({
        NODE_ENV: "production",
        SMTP_SENDING_ENABLED: "true",
        APP_URL: "https://leadforge.example.com with-space",
        UNSUBSCRIBE_SECRET: "short",
        DELIVERY_WEBHOOK_SECRET: "also-short"
      })
    ).toMatchObject({
      appUrlValid: false,
      unsubscribeSecretStrong: false,
      deliveryWebhookSecretStrong: false,
      ready: false
    });
  });
});
