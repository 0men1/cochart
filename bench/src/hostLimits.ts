// Limits of the machine running the harness, as opposed to the server.
//
// A single-machine load test has a hard ceiling that has nothing to do with the
// software under test: every outbound connection to the same host:port needs a
// distinct local source port, and the ephemeral range is finite (16,384 by
// default on macOS). Run past it and connections start failing — which looks
// exactly like the server refusing them. Detecting this is the difference
// between reporting "the server caps at 16k connections" and the truth, which
// is "we could not open more than 16k from one machine".

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function readEphemeralPortCount(): number | null {
  try {
    if (process.platform === "linux") {
      const raw = readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8");
      const [low, high] = raw.trim().split(/\s+/).map(Number);
      if (Number.isFinite(low) && Number.isFinite(high)) return high - low + 1;
      return null;
    }
    if (process.platform === "darwin") {
      const get = (key: string) =>
        Number(execFileSync("sysctl", ["-n", key], { encoding: "utf8" }).trim());
      const low = get("net.inet.ip.portrange.first");
      const high = get("net.inet.ip.portrange.last");
      if (Number.isFinite(low) && Number.isFinite(high)) return high - low + 1;
      return null;
    }
  } catch {
    // Not fatal — we simply cannot warn about a ceiling we cannot read.
  }
  return null;
}

export const EPHEMERAL_PORTS = readEphemeralPortCount();

/**
 * Returns a warning when a level's connection count is close enough to the
 * ephemeral port ceiling that join failures are more likely to be the
 * harness's fault than the server's.
 */
export function portCeilingWarning(connections: number): string | null {
  if (EPHEMERAL_PORTS === null) return null;
  if (connections < EPHEMERAL_PORTS * 0.85) return null;
  return `${connections} connections is at or near this machine's ephemeral port ceiling (${EPHEMERAL_PORTS}); join failures here are a harness limit, not a server limit. Drive load from additional machines or source IPs to measure past it.`;
}
