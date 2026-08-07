// CLI entry point.
//
//   npm run bench -- <scenario> [options]
//
// See bench/README.md for what each scenario measures and how to read the
// output.

import { defaultConfig, type RunConfig, type ScenarioName } from "./config";
import { MetricsClient } from "./metricsClient";
import { runFixed, runRamp } from "./ramp";
import { printHeader, printStep, printSummary, writeJson } from "./report";
import { SCENARIOS } from "./scenarios";

const SCENARIO_NAMES: ScenarioName[] = ["http", "idle-ws", "single-room", "many-rooms"];

function usage(): string {
  return `
CoChart capacity harness

Usage: npm run bench -- <scenario> [options]

Scenarios
  http           Users NOT in rooms: solo chart users hitting /api/candles + /api/search
  idle-ws        Open connections held silent: per-connection cost, independent of traffic
  single-room    Users in ONE room: the O(n^2) cursor fan-out case
  many-rooms     Rooms at full occupancy: aggregate load plus SQLite flush pressure

Options
  --target <url>          Server under test            (default http://localhost:4000)
  --ws <url>              WebSocket origin             (default derived from --target)
  --metrics-token <tok>   Matches the server's METRICS_TOKEN
  --ramp                  Search for the limit instead of running one fixed level
  --ramp-start <n>        First ramp level             (default 5)
  --ramp-factor <n>       Growth per coarse step       (default 2)
  --ramp-max <n>          Ceiling to stop at           (default 20000)
  --users <n>             Fixed level, or users/room for many-rooms  (default 10)
  --rooms <n>             Fixed room count for many-rooms            (default 1)
  --warmup <sec>          Settle time before measuring (default 5)
  --hold <sec>            Measured steady state        (default 20)
  --duty <0..1>           Fraction of time a user moves their cursor (default 0.3)
  --cursor-hz <n>         Cursor sends/sec while active              (default 25)
  --draw-per-min <n>      Drawing edits per user per minute          (default 6)
  --chat-per-min <n>      Chat messages per user per minute          (default 1)
  --connect-rate <n>      New sockets per second       (default 200)
  --workers <n>           Generator worker threads     (default cores-2)
  --think <sec>           http: seconds between a user's requests    (default 5)
  --upstream <mode>       http: cached | live          (default cached)
  --p95 <ms>              SLO: p95 latency budget      (default 150)
  --p99 <ms>              SLO: p99 latency budget      (default 400)
  --loop-p99 <ms>         SLO: server event-loop budget (default 100)
  --out <path>            Write full results as JSON
  --verbose               Print per-step counters
  --help

Examples
  npm run bench -- single-room --ramp --out results/single-room.json
  npm run bench -- many-rooms --ramp --users 8
  npm run bench -- http --ramp --think 5
`;
}

function parseArgs(argv: string[]): { cfg: RunConfig; error?: string } {
  const cfg = defaultConfig();
  const positional = argv.filter((a) => !a.startsWith("--"));

  const scenario = positional[0] as ScenarioName | undefined;
  if (!scenario || !SCENARIO_NAMES.includes(scenario)) {
    return {
      cfg,
      error: scenario
        ? `unknown scenario "${scenario}" (expected one of: ${SCENARIO_NAMES.join(", ")})`
        : "no scenario given",
    };
  }
  cfg.scenario = scenario;

  let wsExplicit = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const next = () => argv[++i];
    const num = (label: string) => {
      const parsed = Number(next());
      if (!Number.isFinite(parsed)) throw new Error(`${label} needs a number`);
      return parsed;
    };

    switch (arg) {
      case "--target": cfg.target = next(); break;
      case "--ws": cfg.wsTarget = next(); wsExplicit = true; break;
      case "--metrics-token": cfg.metricsToken = next(); break;
      case "--ramp": cfg.ramp = true; break;
      case "--ramp-start": cfg.rampStart = num(arg); break;
      case "--ramp-factor": cfg.rampFactor = num(arg); break;
      case "--ramp-max": cfg.rampMaxLevel = num(arg); break;
      case "--users": cfg.users = num(arg); break;
      case "--rooms": cfg.rooms = num(arg); break;
      case "--warmup": cfg.warmupSec = num(arg); break;
      case "--hold": cfg.holdSec = num(arg); break;
      case "--duty": cfg.duty = num(arg); break;
      case "--cursor-hz": cfg.cursorHz = num(arg); break;
      case "--draw-per-min": cfg.drawEditsPerMin = num(arg); break;
      case "--chat-per-min": cfg.chatPerMin = num(arg); break;
      case "--connect-rate": cfg.connectRatePerSec = num(arg); break;
      case "--workers": cfg.workers = num(arg); break;
      case "--think": cfg.thinkSec = num(arg); break;
      case "--upstream": {
        const mode = next();
        if (mode !== "cached" && mode !== "live") {
          return { cfg, error: `--upstream must be "cached" or "live"` };
        }
        cfg.upstream = mode;
        break;
      }
      case "--p95": cfg.slo.p95LatencyMs = num(arg); break;
      case "--p99": cfg.slo.p99LatencyMs = num(arg); break;
      case "--loop-p99": cfg.slo.serverLoopP99Ms = num(arg); break;
      case "--out": cfg.out = next(); break;
      case "--verbose": cfg.verbose = true; break;
      case "--help": return { cfg, error: "help" };
      default:
        return { cfg, error: `unknown option ${arg}` };
    }
  }

  if (!wsExplicit) {
    cfg.wsTarget = cfg.target.replace(/^http/, "ws");
  }
  return { cfg };
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${(err as Error).message}\n${usage()}`);
    process.exit(1);
  }

  const { cfg, error } = parsed;
  if (error) {
    if (error === "help") {
      console.log(usage());
      process.exit(0);
    }
    console.error(`Error: ${error}\n${usage()}`);
    process.exit(1);
  }

  const scenario = SCENARIOS[cfg.scenario];

  if (cfg.scenario === "http" && cfg.upstream === "live") {
    console.warn(
      "\n\x1b[33mWARNING: --upstream=live requests the trailing partial candle block, which\n" +
        "bypasses both the server cache and single-flight coalescing. Every virtual user\n" +
        "produces a real request to Coinbase/Binance. Sustained runs risk getting the\n" +
        "server's IP rate-limited or banned by the exchange. Keep the level and duration\n" +
        "small.\x1b[0m\n",
    );
  }

  const metrics = new MetricsClient(cfg.target, cfg.metricsToken);
  printHeader(scenario, cfg);

  const onStep = (record: Parameters<typeof printStep>[0]) => printStep(record, cfg);

  const result = cfg.ramp
    ? await runRamp(cfg, scenario, metrics, onStep)
    : await runFixed(cfg, scenario, metrics, onStep);

  printSummary(result, scenario, cfg, metrics.unavailable);
  if (cfg.out) writeJson(cfg.out, result, scenario, cfg);

  // A run that established no capacity at all is a failed run, so CI can catch
  // a regression that takes the server below the first ramp level.
  process.exit(result.capacity === null ? 1 : 0);
}

main().catch((err) => {
  console.error("\nBench failed:", err);
  process.exit(1);
});
