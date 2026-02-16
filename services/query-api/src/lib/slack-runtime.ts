import { createHmac, timingSafeEqual } from "node:crypto";

import type { Pool } from "pg";

import { answerQuestion, listChanges, searchDocsWithPolicy } from "./docs-service.js";
import type { TenantPolicy } from "./policy.js";

type SlackCommandInput = {
  command: string;
  text: string;
  user_id?: string;
  channel_id?: string;
  response_url?: string;
  team_id?: string;
};

type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    text?: string;
    channel?: string;
    user?: string;
    ts?: string;
    thread_ts?: string;
  };
};

function parseFormEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

function parseSlackSigningTimestamp(value: string | undefined): number {
  const timestamp = Number(value ?? "0");
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 0;
  }
  return timestamp;
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function verifySlackRequest(input: {
  signingSecret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string;
  nowMs?: number;
}): boolean {
  const timestamp = parseSlackSigningTimestamp(input.timestampHeader);
  const nowMs = input.nowMs ?? Date.now();

  if (!timestamp || !input.signatureHeader) {
    return false;
  }

  const ageMs = Math.abs(nowMs - timestamp * 1000);
  if (ageMs > 5 * 60 * 1000) {
    return false;
  }

  const base = `v0:${timestamp}:${input.rawBody}`;
  const digest = createHmac("sha256", input.signingSecret).update(base).digest("hex");
  const expected = `v0=${digest}`;
  return safeEquals(expected, input.signatureHeader);
}

function buildHelpText(): string {
  return [
    "what is up, docs Slack commands:",
    "- `help`",
    "- `search <query>`",
    "- `changes [source]`",
    "- `<question>` (default: answer with sources)",
  ].join("\n");
}

async function postSlackResponseUrl(responseUrl: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function postSlackMessage(token: string, payload: {
  channel: string;
  text: string;
  thread_ts?: string;
}): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`slack_post_message_failed status=${response.status} body=${body}`);
  }

  const parsed = (await response.json()) as { ok?: boolean; error?: string };
  if (!parsed.ok) {
    throw new Error(`slack_post_message_failed error=${parsed.error ?? "unknown"}`);
  }
}

function defaultSources(): string[] | undefined {
  const sources = (process.env.WIUD_SLACK_COMMAND_SOURCES ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return sources.length > 0 ? sources : undefined;
}

function summarizeCitations(citations: Array<{ title: string; url: string; source: string }>): string {
  if (citations.length === 0) {
    return "";
  }
  const lines = citations.slice(0, 3).map((item) => `- ${item.source}: ${item.title} (${item.url})`);
  return `\nSources:\n${lines.join("\n")}`;
}

async function runSlackCommand(db: Pool, input: SlackCommandInput, policy: TenantPolicy): Promise<string> {
  const text = input.text.trim();
  if (!text || text.toLowerCase() === "help") {
    return buildHelpText();
  }

  if (text.toLowerCase().startsWith("search ")) {
    const query = text.slice(7).trim();
    if (!query) {
      return "Provide a query after `search`.";
    }
    const result = await searchDocsWithPolicy(
      db,
      {
        query,
        top_k: 3,
        filters: { sources: defaultSources() },
      },
      { policy },
    );
    if (result.results.length === 0) {
      return "No matching docs found.";
    }
    return result.results
      .slice(0, 3)
      .map((item) => `- ${item.title} (${item.source}) ${item.url}`)
      .join("\n");
  }

  if (text.toLowerCase().startsWith("changes")) {
    const parts = text.split(/\s+/).filter(Boolean);
    const source = parts.length > 1 ? parts[1] : undefined;
    const changes = await listChanges(
      db,
      {
        source,
        limit: 5,
      },
      { policy },
    );
    if (changes.changes.length === 0) {
      return source ? `No recent changes found for ${source}.` : "No recent changes found.";
    }

    return changes.changes
      .slice(0, 5)
      .map((change) => `- [${change.severity}] ${change.event_type} ${change.title} :: ${change.summary}`)
      .join("\n");
  }

  const answer = await answerQuestion(
    db,
    {
      question: text,
      style: "concise",
      max_citations: 3,
      filters: { sources: defaultSources() },
    },
    { policy },
  );

  return `${answer.answer}${summarizeCitations(answer.citations)}`;
}

export async function handleSlackCommand(input: {
  db: Pool;
  rawBody: string;
  policy: TenantPolicy;
}): Promise<{ immediate: Record<string, unknown>; deferred?: () => Promise<void> }> {
  const form = parseFormEncoded(input.rawBody);
  const commandInput: SlackCommandInput = {
    command: form.command ?? "/wiud",
    text: form.text ?? "",
    user_id: form.user_id,
    channel_id: form.channel_id,
    response_url: form.response_url,
    team_id: form.team_id,
  };

  if (!commandInput.response_url) {
    const text = await runSlackCommand(input.db, commandInput, input.policy);
    return {
      immediate: {
        response_type: "ephemeral",
        text,
      },
    };
  }

  const deferred = async (): Promise<void> => {
    try {
      const text = await runSlackCommand(input.db, commandInput, input.policy);
      await postSlackResponseUrl(commandInput.response_url!, {
        response_type: "ephemeral",
        replace_original: false,
        text,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await postSlackResponseUrl(commandInput.response_url!, {
        response_type: "ephemeral",
        replace_original: false,
        text: `Request failed: ${message}`,
      });
    }
  };

  return {
    immediate: {
      response_type: "ephemeral",
      text: "Working on it...",
    },
    deferred,
  };
}

export async function handleSlackEvent(input: {
  db: Pool;
  rawBody: string;
  policy: TenantPolicy;
}): Promise<{ status: number; body: Record<string, unknown>; deferred?: () => Promise<void> }> {
  const envelope = JSON.parse(input.rawBody) as SlackEventEnvelope;

  if (envelope.type === "url_verification") {
    return {
      status: 200,
      body: {
        challenge: envelope.challenge ?? "",
      },
    };
  }

  if (envelope.type !== "event_callback") {
    return {
      status: 200,
      body: { ok: true },
    };
  }

  const event = envelope.event;
  if (!event || event.type !== "app_mention") {
    return {
      status: 200,
      body: { ok: true },
    };
  }

  const token = process.env.WIUD_SLACK_BOT_TOKEN;
  if (!token || !event.channel) {
    return {
      status: 200,
      body: { ok: true },
    };
  }

  const deferred = async (): Promise<void> => {
    try {
      const prompt = (event.text ?? "")
        .replace(/<@[^>]+>/g, "")
        .trim();

      const answer = await answerQuestion(
        input.db,
        {
          question: prompt || "help",
          style: "concise",
          max_citations: 3,
          filters: { sources: defaultSources() },
        },
        { policy: input.policy },
      );

      await postSlackMessage(token, {
        channel: event.channel!,
        thread_ts: event.thread_ts ?? event.ts,
        text: `${answer.answer}${summarizeCitations(answer.citations)}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await postSlackMessage(token, {
        channel: event.channel!,
        thread_ts: event.thread_ts ?? event.ts,
        text: `Request failed: ${message}`,
      });
    }
  };

  return {
    status: 200,
    body: { ok: true },
    deferred,
  };
}
