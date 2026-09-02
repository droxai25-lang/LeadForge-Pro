import { describe, expect, it } from "vitest";
import { resolveDatabaseConnectionString } from "../databaseConnection";

describe("database connection configuration", () => {
  it("derives a URL-encoded host connection from the single application password", () => {
    expect(
      resolveDatabaseConnectionString({
        POSTGRES_APP_PASSWORD: "safe:p@ssword/value",
        POSTGRES_HOST_PORT: "55432"
      })
    ).toBe("postgresql://leadforge_app:safe%3Ap%40ssword%2Fvalue@127.0.0.1:55432/leadforge_prod?schema=public");
  });

  it("uses the Compose service address in a container", () => {
    expect(
      resolveDatabaseConnectionString({
        POSTGRES_APP_PASSWORD: "container-password",
        POSTGRES_HOST_PORT: "60000",
        CONTAINERIZED: "true"
      })
    ).toBe("postgresql://leadforge_app:container-password@postgres:5432/leadforge_prod?schema=public");
  });

  it("honors an explicit separately managed database URL", () => {
    const explicit = "postgresql://custom:secret@database.example:6432/custom";
    expect(resolveDatabaseConnectionString({ DATABASE_URL: ` ${explicit} ` })).toBe(explicit);
  });

  it("prevents a stale local DATABASE_URL from overriding the shared Compose password", () => {
    expect(
      resolveDatabaseConnectionString({
        POSTGRES_APP_PASSWORD: "current-password",
        POSTGRES_HOST_PORT: "55432",
        DATABASE_URL: "postgresql://leadforge_app:stale@127.0.0.1:5433/leadforge_prod"
      })
    ).toContain("current-password@127.0.0.1:55432");
  });

  it("rejects an invalid host port", () => {
    expect(() =>
      resolveDatabaseConnectionString({ POSTGRES_APP_PASSWORD: "secret", POSTGRES_HOST_PORT: "70000" })
    ).toThrow("POSTGRES_HOST_PORT");
  });
});
