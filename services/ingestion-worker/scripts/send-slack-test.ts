import { sendSlackTestMessage } from "../src/notifications.js";

function parseArgs(argv: string[]): { source?: string; message?: string; webhookUrl?: string } {
  const parsed: { source?: string; message?: string; webhookUrl?: string } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--source") {
      parsed.source = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--message") {
      parsed.message = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--webhook-url") {
      parsed.webhookUrl = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await sendSlackTestMessage({
    webhook_url: args.webhookUrl,
    source: args.source,
    actor: process.env.USER ?? "operator",
    message: args.message,
  });

  process.stdout.write("slack_test_notification_sent\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`send_slack_test_failed: ${message}\n`);
  process.exit(1);
});
