import { createCrawlerAdapter } from "./crawl.js";

export {
  canonicalizeUrl,
  chunkText,
  chunkStructuredText,
  detectPromptInjectionSignals,
  extractLinks,
  extractMainHtml,
  extractSitemapUrls,
  extractTitle,
  htmlToText,
  isAllowedUrl,
  sanitizePromptInjectionLines,
  stripHtmlNoise,
  stripNoiseLines,
  splitStructuredSections,
  splitIntoSections,
} from "./crawl.js";

export const ingestOpenAIDocs = createCrawlerAdapter("openai", {
  allowPathPrefixes: ["/docs"],
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [
    /^(search|search docs)$/i,
    /^(copy page|copy link|view all docs)$/i,
    /^on this page$/i,
    /^was this page helpful\??$/i,
  ],
});
