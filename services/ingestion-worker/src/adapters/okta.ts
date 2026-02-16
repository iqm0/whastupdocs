import { createCrawlerAdapter } from "./crawl.js";

export const ingestOktaDocs = createCrawlerAdapter("okta", {
  allowPathPrefixes: ["/docs", "/docs/reference", "/docs/guides"],
  maxPages: 80,
  maxDepth: 2,
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [/^last updated/i, /^table of contents$/i, /^improve this page$/i],
});

