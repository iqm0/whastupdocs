import { createCrawlerAdapter } from "./crawl.js";

export const ingestStripeDocs = createCrawlerAdapter("stripe", {
  allowPathPrefixes: ["/docs", "/api"],
});
