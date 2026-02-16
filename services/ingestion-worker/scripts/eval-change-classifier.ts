import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectDocumentChangeEvents } from "../src/store.js";

type Fixture = {
  id: string;
  title: string;
  previous: string;
  next: string;
  expected_primary_event: "updated" | "deprecation" | "breaking_change";
};

type FixtureSet = {
  fixtures: Fixture[];
};

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturePath = path.resolve(__dirname, "../../../scripts/eval/change-classifier-fixtures.json");
  const raw = await readFile(fixturePath, "utf8");
  const fixtureSet = JSON.parse(raw) as FixtureSet;

  let correct = 0;
  for (const fixture of fixtureSet.fixtures) {
    const events = detectDocumentChangeEvents(fixture.previous, fixture.next, fixture.title);
    const predicted = events[0]?.event_type ?? "updated";
    if (predicted === fixture.expected_primary_event) {
      correct += 1;
    } else {
      process.stdout.write(
        `mismatch fixture=${fixture.id} expected=${fixture.expected_primary_event} predicted=${predicted}\n`,
      );
    }
  }

  const total = fixtureSet.fixtures.length;
  const accuracy = total === 0 ? 1 : correct / total;
  process.stdout.write(
    `change-classifier accuracy=${accuracy.toFixed(3)} (${correct}/${total})\n`,
  );

  const minAccuracy = Number(process.env.WIUD_CHANGE_CLASSIFIER_MIN_ACCURACY ?? 0.8);
  if (accuracy < minAccuracy) {
    process.stderr.write(
      `accuracy ${accuracy.toFixed(3)} is below threshold ${minAccuracy.toFixed(3)}\n`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
