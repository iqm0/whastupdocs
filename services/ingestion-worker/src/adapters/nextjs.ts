import { createCrawlerAdapter } from "./crawl.js";

export const ingestNextJSDocs = createCrawlerAdapter("nextjs", {
  allowPathPrefixes: ["/docs"],
  denyPathPrefixes: ["/docs/messages"],
  maxPages: 60,
  maxDepth: 1,
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [
    /^on this page$/i,
    /^(previous|next)$/i,
    /^edit this page$/i,
    /^supported by vercel$/i,
  ],
});
