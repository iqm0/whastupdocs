import { createCrawlerAdapter } from "./crawl.js";

export const ingestAwsIamDocs = createCrawlerAdapter("aws-iam", {
  allowPathPrefixes: ["/iam/latest/UserGuide"],
  maxPages: 120,
  maxDepth: 2,
  htmlNoisePatterns: [
    /<nav[\s\S]*?<\/nav>/gi,
    /<aside[\s\S]*?<\/aside>/gi,
    /<footer[\s\S]*?<\/footer>/gi,
  ],
  lineNoisePatterns: [/^document history$/i, /^previous version$/i, /^did this page help you\??$/i],
});

