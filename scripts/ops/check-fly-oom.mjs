#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DEFAULT_APP = "wud-ingestion-worker-prod";
const DEFAULT_WINDOW_MINUTES = 30;
const DEFAULT_THRESHOLD = 1;

const OOM_PATTERNS = [
  /oom/i,
  /out of memory/i,
  /Process appears to have been OOM killed/i,
  /node killed/i
];

function parseArgs(argv) {
  const args = {
    app: DEFAULT_APP,
    windowMinutes: DEFAULT_WINDOW_MINUTES,
    threshold: DEFAULT_THRESHOLD,
    scaleToMb: null,
    apply: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--app") {
      args.app = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--window-minutes") {
      args.windowMinutes = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--threshold") {
      args.threshold = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--scale-to-mb") {
      args.scaleToMb = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!Number.isFinite(args.windowMinutes) || args.windowMinutes <= 0) {
    throw new Error("--window-minutes must be a positive number");
  }
  if (!Number.isFinite(args.threshold) || args.threshold <= 0) {
    throw new Error("--threshold must be a positive number");
  }
  if (args.scaleToMb !== null && (!Number.isFinite(args.scaleToMb) || args.scaleToMb <= 0)) {
    throw new Error("--scale-to-mb must be a positive number");
  }
  if (args.apply && args.scaleToMb === null) {
    throw new Error("--apply requires --scale-to-mb");
  }

  return args;
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/ops/check-fly-oom.mjs [options]",
      "",
      "Options:",
      "  --app <name>             Fly app name (default: wud-ingestion-worker-prod)",
      "  --window-minutes <n>     Lookback window in minutes (default: 30)",
      "  --threshold <n>          Trigger threshold for OOM events (default: 1)",
      "  --scale-to-mb <n>        Memory target for remediation (requires --apply)",
      "  --apply                  Execute remediation action (scale memory)",
      "  --help, -h               Show this help"
    ].join("\n")
  );
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || `${command} exited with ${result.status}`);
  }
  return result.stdout || "";
}

function parseTimestamp(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s/);
  if (!match) {
    return null;
  }
  const ts = Date.parse(match[1]);
  return Number.isNaN(ts) ? null : ts;
}

function isOomLine(line) {
  return OOM_PATTERNS.some((pattern) => pattern.test(line));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const logsRaw = run("flyctl", ["logs", "--app", args.app, "--no-tail"]);
  const lines = logsRaw.split(/\r?\n/).filter(Boolean);

  const now = Date.now();
  const cutoff = now - args.windowMinutes * 60 * 1000;
  const oomLines = [];

  for (const line of lines) {
    if (!isOomLine(line)) {
      continue;
    }
    const ts = parseTimestamp(line);
    if (ts === null || ts >= cutoff) {
      oomLines.push(line);
    }
  }

  const shouldRemediate = oomLines.length >= args.threshold;

  let remediation = "none";
  if (shouldRemediate && args.apply && args.scaleToMb !== null) {
    run("flyctl", ["scale", "memory", String(args.scaleToMb), "--app", args.app]);
    remediation = `scaled_to_${args.scaleToMb}mb`;
  } else if (shouldRemediate && args.scaleToMb !== null) {
    remediation = `recommended_scale_to_${args.scaleToMb}mb`;
  }

  const summary = {
    app: args.app,
    checked_at: new Date(now).toISOString(),
    window_minutes: args.windowMinutes,
    threshold: args.threshold,
    oom_events: oomLines.length,
    should_remediate: shouldRemediate,
    remediation
  };

  console.log(JSON.stringify(summary, null, 2));

  if (oomLines.length > 0) {
    console.log("\nRecent matching log lines:");
    for (const line of oomLines.slice(0, 8)) {
      console.log(`- ${line}`);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`[check-fly-oom] ${error.message}`);
  process.exit(1);
}
