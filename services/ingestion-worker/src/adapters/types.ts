import type { SourceRegistryEntry } from "../registry.js";

export type IngestedDocument = {
  canonical_url: string;
  title: string;
  language: string;
  version_tag?: string;
  content: string;
  chunks: string[];
};

export type IngestRunResult = {
  source: string;
  status: "success" | "partial" | "failed";
  documents: IngestedDocument[];
  fetched_urls: string[];
  failed_urls: string[];
  errors: string[];
};

export type SourceAdapter = (
  source: SourceRegistryEntry,
) => Promise<IngestRunResult>;
