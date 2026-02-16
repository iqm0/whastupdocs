import { createCrawlerAdapter } from "./crawl.js";

export const ingestReactDocs = createCrawlerAdapter("react", {
  allowPathPrefixes: ["/reference"],
});
