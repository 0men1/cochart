import { describe, it, expect, vi, afterEach } from "vitest";
import type { IncomingMessage } from "node:http";

// clientIp reads TRUST_PROXY once at module load, so each case imports a fresh
// copy of the module with the env set beforehand.
async function loadClientIp(trustProxy: string | undefined) {
  vi.resetModules();
  if (trustProxy === undefined) vi.stubEnv("TRUST_PROXY", "");
  else vi.stubEnv("TRUST_PROXY", trustProxy);
  return (await import("./http")).clientIp;
}

const req = (xff: string | undefined, remote = "10.0.0.9") =>
  ({
    headers: xff === undefined ? {} : { "x-forwarded-for": xff },
    socket: { remoteAddress: remote },
  }) as unknown as IncomingMessage;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clientIp", () => {
  it("ignores x-forwarded-for when TRUST_PROXY is unset (anti-spoof)", async () => {
    const clientIp = await loadClientIp(undefined);
    expect(clientIp(req("1.2.3.4, 5.6.7.8"))).toBe("10.0.0.9");
  });

  it("honours the leftmost x-forwarded-for hop when TRUST_PROXY=1", async () => {
    const clientIp = await loadClientIp("1");
    expect(clientIp(req("1.2.3.4, 5.6.7.8"))).toBe("1.2.3.4");
  });

  it("falls back to the socket address when TRUST_PROXY=1 but no header", async () => {
    const clientIp = await loadClientIp("1");
    expect(clientIp(req(undefined))).toBe("10.0.0.9");
  });
});
