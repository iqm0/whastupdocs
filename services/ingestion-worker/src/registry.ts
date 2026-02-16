import { readFile } from "node:fs/promises";
import path from "node:path";

export type SourceRegistryEntry = {
  id: string;
  name: string;
  kind: "docs" | "repo" | "api_ref" | "changelog";
  base_url: string;
  trust_score: number;
  poll_interval_minutes: number;
  sitemap_url?: string;
  seed_urls?: string[];
};

const defaultRegistryPath = "config/source-registry.json";

export async function loadSourceRegistry(): Promise<Map<string, SourceRegistryEntry>> {
  const filePath = process.env.SOURCE_REGISTRY_PATH ?? defaultRegistryPath;
  const resolved = path.resolve(process.cwd(), filePath);

  const raw = await readFile(resolved, "utf8");
  const entries = JSON.parse(raw) as SourceRegistryEntry[];

  const map = new Map<string, SourceRegistryEntry>();
  for (const entry of entries) {
    map.set(entry.id, entry);
  }

  return map;
}
