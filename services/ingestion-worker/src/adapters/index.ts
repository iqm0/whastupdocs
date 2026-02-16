import { ingestOpenAIDocs } from "./openai.js";
import { ingestNextJSDocs } from "./nextjs.js";
import { ingestReactDocs } from "./react.js";
import { ingestStripeDocs } from "./stripe.js";
import type { SourceAdapter } from "./types.js";

const adapters: Record<string, SourceAdapter> = {
  openai: ingestOpenAIDocs,
  nextjs: ingestNextJSDocs,
  stripe: ingestStripeDocs,
  react: ingestReactDocs,
};

export function getSourceAdapter(sourceId: string): SourceAdapter | undefined {
  return adapters[sourceId];
}
