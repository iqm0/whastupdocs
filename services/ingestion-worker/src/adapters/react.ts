import { createCrawlerAdapter } from "./crawl.js";

export const ingestReactDocs = createCrawlerAdapter("react", {
  allowPathPrefixes: ["/reference"],
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [
    /^learn react$/i,
    /^api reference$/i,
    /^community$/i,
    /^blog$/i,
    /^was this page useful\??$/i,
  ],
});
