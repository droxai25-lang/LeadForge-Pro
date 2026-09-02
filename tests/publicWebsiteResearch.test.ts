import { describe, expect, it } from "vitest";
import { researchPublicWebsite } from "../src/lib/publicWebsiteResearch";

describe("public website research", () => {
  it("rejects non-public or non-HTTPS crawl targets before network access", async () => {
    await expect(researchPublicWebsite("localhost")).rejects.toThrow("fully qualified public hostname");
    await expect(researchPublicWebsite("http://example.com")).rejects.toThrow("Only HTTPS");
  });
});
