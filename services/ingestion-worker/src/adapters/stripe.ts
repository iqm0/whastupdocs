import { createCrawlerAdapter } from "./crawl.js";

export const ingestStripeDocs = createCrawlerAdapter("stripe", {
  allowPathPrefixes: ["/docs", "/api"],
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [
    /^ask ai$/i,
    /^view as markdown$/i,
    /^copy for llm$/i,
    /^was this page helpful\??$/i,
  ],
});
