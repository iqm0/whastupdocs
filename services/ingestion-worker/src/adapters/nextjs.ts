import { createCrawlerAdapter } from "./crawl.js";

export const ingestNextJSDocs = createCrawlerAdapter("nextjs", {
  allowPathPrefixes: ["/docs"],
  denyPathPrefixes: ["/docs/messages"],
});
