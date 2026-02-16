import { createCrawlerAdapter } from "./crawl.js";

// MDN HTTP reference (subset) for core HTTP semantics used in API integrations.
export const ingestMdnHttpDocs = createCrawlerAdapter("mdn-http", {
  allowPathPrefixes: ["/en-US/docs/Web/HTTP"],
  maxPages: 80,
  maxDepth: 2,
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [/^related topics$/i, /^breadcrumbs$/i, /^last modified on/i],
});

