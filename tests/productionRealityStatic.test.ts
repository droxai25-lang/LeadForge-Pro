import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string): string => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("production-reality UI contracts", () => {
  it("does not persist lead or campaign drafts in browser storage", () => {
    const app = readProjectFile("src/App.tsx");
    const ingest = readProjectFile("src/components/BatchIngestView.tsx");
    const campaigns = readProjectFile("src/components/CampaignSequencerView.tsx");

    expect(`${app}\n${ingest}\n${campaigns}`).not.toMatch(/\b(?:localStorage|sessionStorage)\b/);
  });

  it("does not expose canned lead datasets or a fake reseed operation", () => {
    const app = readProjectFile("src/App.tsx");
    const admin = readProjectFile("src/components/AdminConsoleModal.tsx");
    const ingest = readProjectFile("src/components/BatchIngestView.tsx");
    const server = readProjectFile("server.ts");

    expect(ingest).not.toMatch(/Sample Datasets|Load 5 SaaS|Load JSON Tech Founders/);
    expect(admin).not.toMatch(/Reseed Benchmark|benchmark records restored/i);
    expect(app).not.toContain("/api/admin/reset-data");
    expect(server).not.toContain('app.post("/api/admin/reset-data"');
  });

  it("renders health from the API instead of hard-coded success telemetry", () => {
    const app = readProjectFile("src/App.tsx");
    const admin = readProjectFile("src/components/AdminConsoleModal.tsx");

    expect(app).not.toContain(">14ms<");
    expect(app).not.toMatch(/Redis:\s*<[^>]+>UP</);
    expect(app).toContain("health?.dependencies?.redis");
    expect(admin).not.toContain("/api/admin/raw-dump");
  });

  it("uses persisted lead provenance instead of inferring sources from IDs", () => {
    const filterDrawer = readProjectFile("src/components/AdvancedFilterDrawer.tsx");
    const leadTable = readProjectFile("src/components/LeadTable.tsx");

    expect(filterDrawer).not.toContain('startsWith("sim-")');
    expect(filterDrawer).not.toContain('startsWith("gtm-")');
    expect(leadTable).not.toContain('startsWith("sim-")');
    expect(leadTable).not.toContain('startsWith("gtm-")');
    expect(filterDrawer).toContain('lead.sourceType || "unknown"');
    expect(leadTable).toContain('lead.sourceType || "unknown"');
  });
});
