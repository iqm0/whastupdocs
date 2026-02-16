import { createCrawlerAdapter } from "./crawl.js";

export {
  canonicalizeUrl,
  chunkText,
  detectPromptInjectionSignals,
  extractLinks,
  extractMainHtml,
  extractSitemapUrls,
  extractTitle,
  htmlToText,
  isAllowedUrl,
  sanitizePromptInjectionLines,
  splitIntoSections,
} from "./crawl.js";

export const ingestOpenAIDocs = createCrawlerAdapter("openai", {
  allowPathPrefixes: ["/docs"],
});
