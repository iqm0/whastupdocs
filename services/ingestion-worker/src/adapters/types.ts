import type { SourceRegistryEntry } from "../registry.js";

export type IngestedChunk = {
  text: string;
  heading_path?: string;
  code_lang?: string;
};

export type DocumentFetchMetadata = {
  etag?: string;
  last_modified?: string;
  status?: number;
  checked_at?: string;
};

export type IngestedDocument = {
  canonical_url: string;
  title: string;
  language: string;
  version_tag?: string;
  content: string;
  chunks: IngestedChunk[];
  fetch?: DocumentFetchMetadata;
};

export type NotModifiedDocument = {
  canonical_url: string;
  fetch?: DocumentFetchMetadata;
};

export type SourceAdapterContext = {
  conditional_headers?: Record<string, Pick<DocumentFetchMetadata, "etag" | "last_modified">>;
};

export type IngestRunResult = {
  source: string;
  status: "success" | "partial" | "failed";
  documents: IngestedDocument[];
  not_modified_documents: NotModifiedDocument[];
  fetched_urls: string[];
  failed_urls: string[];
  errors: string[];
};

export type SourceAdapter = (
  source: SourceRegistryEntry,
  context?: SourceAdapterContext,
) => Promise<IngestRunResult>;
