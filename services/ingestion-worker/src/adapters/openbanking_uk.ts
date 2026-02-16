import { createCrawlerAdapter } from "./crawl.js";

// Open Banking UK Read/Write API specs are hosted on GitHub Pages.
// We keep crawl conservative (depth 1-2) and strip nav/footers.
export const ingestOpenBankingUkDocs = createCrawlerAdapter("openbanking-uk", {
  allowPathPrefixes: ["/read-write-api-specs", "/read-write-api-specs/versions"],
  maxPages: 40,
  maxDepth: 2,
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [/^edit this page$/i, /^table of contents$/i, /^was this page helpful\??$/i],
});

