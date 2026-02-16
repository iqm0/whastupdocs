import { ingestOpenAIDocs } from "./openai.js";
import { ingestNextJSDocs } from "./nextjs.js";
import { ingestPlaidDocs } from "./plaid.js";
import { ingestReactDocs } from "./react.js";
import { ingestStripeDocs } from "./stripe.js";
import type { SourceAdapter } from "./types.js";

const adapters: Record<string, SourceAdapter> = {
  openai: ingestOpenAIDocs,
  nextjs: ingestNextJSDocs,
  plaid: ingestPlaidDocs,
  stripe: ingestStripeDocs,
  react: ingestReactDocs,
};

export function getSourceAdapter(sourceId: string): SourceAdapter | undefined {
  return adapters[sourceId];
}
