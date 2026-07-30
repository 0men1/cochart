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

// isAllowedWsOrigin reads its env allowlists once at module load, so each case
// imports a fresh copy with the env set beforehand.
async function loadIsAllowedWsOrigin(env: {
  ws?: string;
  dev?: string;
}) {
  vi.resetModules();
  vi.stubEnv("ALLOWED_WS_ORIGINS", env.ws ?? "");
  vi.stubEnv("ALLOWED_DEV_ORIGINS", env.dev ?? "");
  return (await import("./http")).isAllowedWsOrigin;
}

describe("isAllowedWsOrigin", () => {
  it("allows a missing Origin header (same-origin / non-browser client)", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({});
    expect(isAllowed(undefined, { dev: false })).toBe(true);
  });

  it("allows localhost in dev regardless of the allowlist", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({});
    expect(isAllowed("http://localhost:3000", { dev: true })).toBe(true);
    expect(isAllowed("http://127.0.0.1:3000", { dev: true })).toBe(true);
  });

  it("denies localhost in production when not allowlisted", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({});
    expect(isAllowed("http://localhost:3000", { dev: false })).toBe(false);
  });

  it("allows an origin on the production allowlist", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({ ws: "https://cochart.app,https://www.cochart.app" });
    expect(isAllowed("https://cochart.app", { dev: false })).toBe(true);
    expect(isAllowed("https://www.cochart.app", { dev: false })).toBe(true);
  });

  it("denies an origin not on the production allowlist", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({ ws: "https://cochart.app" });
    expect(isAllowed("https://evil.example", { dev: false })).toBe(false);
  });

  it("denies all cross-origin when the production allowlist is empty", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({});
    expect(isAllowed("https://evil.example", { dev: false })).toBe(false);
  });

  it("honours ALLOWED_DEV_ORIGINS in dev", async () => {
    const isAllowed = await loadIsAllowedWsOrigin({ dev: "https://preview.cochart.app" });
    expect(isAllowed("https://preview.cochart.app", { dev: true })).toBe(true);
    expect(isAllowed("https://preview.cochart.app", { dev: false })).toBe(false);
  });
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
