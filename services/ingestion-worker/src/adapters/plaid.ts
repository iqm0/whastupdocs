import { createCrawlerAdapter } from "./crawl.js";

export const ingestPlaidDocs = createCrawlerAdapter("plaid", {
  allowPathPrefixes: ["/docs"],
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [
    /^search or ask a question$/i,
    /^ask bill!?$/i,
    /^all docs$/i,
    /^open nav$/i,
    /^close search modal$/i,
    /^log in$/i,
    /^get api keys$/i,
    /^was this page helpful\??$/i,
  ],
});
