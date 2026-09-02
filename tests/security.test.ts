import { describe, expect, it } from "vitest";
import type { LookupFunction } from "node:net";
import type { LookupAddress } from "node:dns";
import { createPinnedLookup, isPrivateIpAddress, SSRFGuardError } from "../src/lib/security";

describe("isPrivateIpAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:127.0.0.1"
  ])("blocks non-public address %s", (address) => {
    expect(isPrivateIpAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isPrivateIpAddress(address)).toBe(false);
  });
});

describe("DNS-pinned outbound lookup", () => {
  const runLookup = (lookup: LookupFunction, hostname: string, family: number) =>
    new Promise<{
      address: string;
      family: number;
    }>((resolve, reject) => {
      lookup(
        hostname,
        { family },
        (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], resolvedFamily?: number) => {
          if (error) reject(error);
          else if (typeof address === "string") resolve({ address, family: resolvedFamily || family });
          else reject(new Error("Expected a single DNS lookup address."));
        }
      );
    });

  it("returns only prevalidated addresses for the expected hostname", async () => {
    const lookup = createPinnedLookup("example.com", [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ]);
    await expect(runLookup(lookup, "example.com", 4)).resolves.toEqual({
      address: "93.184.216.34",
      family: 4
    });
    await expect(runLookup(lookup, "example.com", 6)).resolves.toEqual({
      address: "2606:2800:220:1:248:1893:25c8:1946",
      family: 6
    });
  });

  it("supports all-address lookups without consulting DNS again", async () => {
    const lookup = createPinnedLookup("example.com", [
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 }
    ]);
    const result = await new Promise<Array<{ address: string; family: number }>>((resolve, reject) => {
      lookup(
        "example.com",
        { family: 4, all: true },
        (error: Error | null, addresses: Array<{ address: string; family: number }>) => {
          if (error) reject(error);
          else resolve(addresses);
        }
      );
    });
    expect(result).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "93.184.216.35", family: 4 }
    ]);
  });

  it("fails closed for a hostname or address family outside the validated set", async () => {
    const lookup = createPinnedLookup("example.com", [{ address: "93.184.216.34", family: 4 }]);
    await expect(runLookup(lookup, "redirected.example", 4)).rejects.toBeInstanceOf(SSRFGuardError);
    await expect(runLookup(lookup, "example.com", 6)).rejects.toBeInstanceOf(SSRFGuardError);
  });
});
