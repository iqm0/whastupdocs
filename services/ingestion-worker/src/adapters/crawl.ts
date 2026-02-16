import type {
  IngestedChunk,
  IngestRunResult,
  SourceAdapter,
  SourceAdapterContext,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_PAGES = 20;
const DEFAULT_MAX_CHARS_PER_CHUNK = 1800;
const DEFAULT_MAX_CRAWL_DEPTH = 1;
const DEFAULT_FETCH_RETRIES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 500;

const BLOCK_TAG_CLOSERS = [
  "p",
  "div",
  "li",
  "pre",
  "code",
  "section",
  "article",
  "main",
  "ul",
  "ol",
  "table",
  "tr",
  "td",
  "blockquote",
];

const IGNORE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".ico",
];

const PROMPT_INJECTION_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  {
    id: "override_instructions",
    regex:
      /\b(ignore|disregard|override|bypass)\b.{0,50}\b(instruction|system|developer|prompt|policy|guardrail|previous)\b/i,
  },
  {
    id: "reveal_sensitive",
    regex:
      /\b(reveal|exfiltrate|leak|print|expose)\b.{0,50}\b(secret|token|api key|credential|system prompt|hidden prompt)\b/i,
  },
  {
    id: "do_not_follow_policy",
    regex:
      /\b(do not|don't)\b.{0,40}\b(follow|obey)\b.{0,40}\b(instruction|policy|guardrail|system|developer)\b/i,
  },
  {
    id: "tool_abuse",
    regex: /\b(call|run|execute)\b.{0,30}\b(tool|function)\b.{0,60}\b(delete|transfer|override|bypass)\b/i,
  },
  {
    id: "prompt_tag_payload",
    regex: /<\s*(system|assistant|developer)\s*>|BEGIN\s+(SYSTEM|PROMPT)/i,
  },
];

export type CrawlPolicy = {
  allowPathPrefixes?: string[];
  denyPathPrefixes?: string[];
  minTextChars?: number;
  language?: string;
  versionTag?: string;
  htmlNoisePatterns?: RegExp[];
  lineNoisePatterns?: RegExp[];
  maxPages?: number;
  maxDepth?: number;
};

type StructuredSection = {
  heading_path?: string;
  text: string;
  code_lang?: string;
};

type FetchResponsePayload = {
  status: number;
  text: string;
  etag?: string;
  last_modified?: string;
  not_modified: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";

  const toDelete: string[] = [];
  for (const key of parsed.searchParams.keys()) {
    if (key.startsWith("utm_") || key === "ref" || key === "source") {
      toDelete.push(key);
    }
  }
  for (const key of toDelete) {
    parsed.searchParams.delete(key);
  }

  if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

export function extractMainHtml(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch?.[1]) {
    return mainMatch[1];
  }

  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

export function extractTitle(html: string, fallbackUrl: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch?.[1]) {
    return fallbackUrl;
  }

  return normalizeWhitespace(decodeHtmlEntities(titleMatch[1]).replace(/\s*\|.*$/, ""));
}

export function htmlToText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  cleaned = cleaned.replace(
    /<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, codeAttrs: string, codeInner: string) => {
      const classMatch = codeAttrs.match(/class=["'][^"']*language-([a-z0-9_+-]+)[^"']*["']/i);
      const lang = classMatch?.[1]?.toLowerCase() ?? "";
      const code = decodeHtmlEntities(codeInner)
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\r/g, "")
        .trim();
      return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    },
  );

  cleaned = cleaned.replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, _lvl, headingInner) => {
    const headingText = normalizeWhitespace(decodeHtmlEntities(stripTags(headingInner)));
    if (!headingText) {
      return "\n";
    }
    return `\n\n## ${headingText}\n\n`;
  });

  for (const tag of BLOCK_TAG_CLOSERS) {
    const regex = new RegExp(`<\\/${tag}>`, "gi");
    cleaned = cleaned.replace(regex, `</${tag}>\n`);
  }

  const stripped = cleaned
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeWhitespace(decodeHtmlEntities(stripped));
}

export function stripHtmlNoise(html: string, patterns: RegExp[]): string {
  let cleaned = html;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, " ");
  }
  return cleaned;
}

export function stripNoiseLines(text: string, patterns: RegExp[]): string {
  if (patterns.length === 0) {
    return text;
  }

  const kept = text
    .split("\n")
    .filter((line) => {
      const normalized = line.trim();
      if (!normalized) {
        return false;
      }
      return !patterns.some((pattern) => pattern.test(normalized));
    });

  return normalizeWhitespace(kept.join("\n"));
}

export function splitIntoSections(text: string): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];

  let heading = "";
  let body: string[] = [];

  const flush = (): void => {
    const raw = [heading, ...body].filter(Boolean).join("\n");
    const normalized = normalizeWhitespace(raw);
    if (normalized) {
      sections.push(normalized);
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (heading || body.length > 0) {
        flush();
      }
      heading = line.trim();
      body = [];
      continue;
    }

    body.push(line);
  }

  if (heading || body.length > 0) {
    flush();
  }

  return sections.length > 0 ? sections : [text];
}

export function splitStructuredSections(text: string): StructuredSection[] {
  const lines = text.split("\n");
  const sections: StructuredSection[] = [];
  let headingPath: string | undefined;
  let body: string[] = [];

  const flush = (): void => {
    const normalized = normalizeWhitespace(body.join("\n"));
    if (!normalized) {
      return;
    }

    const langMatch = normalized.match(/```([a-z0-9_+-]+)\n/i);
    sections.push({
      heading_path: headingPath,
      text: normalized,
      code_lang: langMatch?.[1]?.toLowerCase(),
    });
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (body.length > 0) {
        flush();
      }
      headingPath = line.slice(3).trim() || undefined;
      body = [line];
      continue;
    }
    body.push(line);
  }

  if (body.length > 0) {
    flush();
  }

  return sections.length > 0 ? sections : [{ text: normalizeWhitespace(text) }];
}

export function chunkStructuredText(
  text: string,
  maxChars = DEFAULT_MAX_CHARS_PER_CHUNK,
): IngestedChunk[] {
  const sections = splitStructuredSections(text);
  const chunks: IngestedChunk[] = [];

  for (const section of sections) {
    const sectionText = section.text;
    if (sectionText.length <= maxChars) {
      chunks.push({
        text: sectionText,
        heading_path: section.heading_path,
        code_lang: section.code_lang,
      });
      continue;
    }

    const paragraphs = sectionText
      .split(/\n\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    let current = "";
    for (const paragraph of paragraphs) {
      if (paragraph.length > maxChars) {
        if (current) {
          chunks.push({
            text: current.trim(),
            heading_path: section.heading_path,
            code_lang: section.code_lang,
          });
          current = "";
        }

        for (let i = 0; i < paragraph.length; i += maxChars) {
          chunks.push({
            text: paragraph.slice(i, i + maxChars),
            heading_path: section.heading_path,
            code_lang: section.code_lang,
          });
        }
        continue;
      }

      const next = current ? `${current}\n\n${paragraph}` : paragraph;
      if (next.length > maxChars) {
        chunks.push({
          text: current.trim(),
          heading_path: section.heading_path,
          code_lang: section.code_lang,
        });
        current = paragraph;
      } else {
        current = next;
      }
    }

    if (current.trim()) {
      chunks.push({
        text: current.trim(),
        heading_path: section.heading_path,
        code_lang: section.code_lang,
      });
    }
  }

  return chunks;
}

export function chunkText(text: string, maxChars = DEFAULT_MAX_CHARS_PER_CHUNK): string[] {
  return chunkStructuredText(text, maxChars).map((chunk) => chunk.text);
}

export function detectPromptInjectionSignals(value: string): string[] {
  const signals = new Set<string>();
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.regex.test(value)) {
      signals.add(pattern.id);
    }
  }
  return Array.from(signals);
}

export function sanitizePromptInjectionLines(value: string): {
  text: string;
  removed_lines: number;
  findings: string[];
} {
  const kept: string[] = [];
  const findings = new Set<string>();
  let removedLines = 0;

  for (const line of value.split("\n")) {
    const signals = detectPromptInjectionSignals(line);
    if (signals.length > 0 && line.trim().length <= 300) {
      removedLines += 1;
      for (const signal of signals) {
        findings.add(signal);
      }
      continue;
    }
    kept.push(line);
  }

  const sanitized = normalizeWhitespace(kept.join("\n"));
  return {
    text: sanitized,
    removed_lines: removedLines,
    findings: Array.from(findings),
  };
}

export function extractSitemapUrls(
  xml: string,
  baseUrl: string,
  policy?: CrawlPolicy,
): string[] {
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/gim)];
  const urls = matches
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));

  return urls
    .map((url) => canonicalizeUrl(url))
    .filter((url) => isAllowedUrl(url, baseUrl, policy));
}

export function extractLinks(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const regex = /href=["']([^"']+)["']/gim;

  for (const match of html.matchAll(regex)) {
    const href = match[1]?.trim();
    if (!href) {
      continue;
    }

    if (href.startsWith("mailto:") || href.startsWith("javascript:")) {
      continue;
    }

    try {
      const absolute = canonicalizeUrl(new URL(href, pageUrl).toString());
      urls.push(absolute);
    } catch {
      continue;
    }
  }

  return Array.from(new Set(urls));
}

export function isAllowedUrl(url: string, baseUrl: string, policy?: CrawlPolicy): boolean {
  let parsed: URL;
  let base: URL;

  try {
    parsed = new URL(url);
    base = new URL(baseUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return false;
  }

  if (parsed.host !== base.host) {
    return false;
  }

  const basePath = base.pathname.replace(/\/$/, "");
  if (basePath && !parsed.pathname.startsWith(basePath)) {
    return false;
  }

  if (policy?.allowPathPrefixes && policy.allowPathPrefixes.length > 0) {
    const matchesAllowed = policy.allowPathPrefixes.some((prefix) =>
      parsed.pathname.startsWith(prefix),
    );
    if (!matchesAllowed) {
      return false;
    }
  }

  if (policy?.denyPathPrefixes && policy.denyPathPrefixes.length > 0) {
    const blocked = policy.denyPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix));
    if (blocked) {
      return false;
    }
  }

  const lowerPath = parsed.pathname.toLowerCase();
  for (const ext of IGNORE_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      return false;
    }
  }

  return true;
}

async function fetchTextWithRetry(
  url: string,
  timeoutMs: number,
  retries: number,
  retryBackoffMs: number,
  userAgent: string,
  conditions?: { etag?: string; last_modified?: string },
): Promise<FetchResponsePayload> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": userAgent,
          ...(conditions?.etag ? { "if-none-match": conditions.etag } : {}),
          ...(conditions?.last_modified
            ? { "if-modified-since": conditions.last_modified }
            : {}),
        },
      });

      const etag = response.headers.get("etag") ?? undefined;
      const lastModified = response.headers.get("last-modified") ?? undefined;

      if (response.status === 304) {
        return {
          status: 304,
          text: "",
          etag,
          last_modified: lastModified,
          not_modified: true,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return {
        status: response.status,
        text: await response.text(),
        etag,
        last_modified: lastModified,
        not_modified: false,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await sleep(retryBackoffMs * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error(`failed_to_fetch ${url}`);
}

function getCandidateUrls(source: {
  base_url: string;
  sitemap_url?: string;
  seed_urls?: string[];
}): string[] {
  const seeds = source.seed_urls ?? [];
  const withBase = seeds.length > 0 ? seeds : [source.base_url];
  return Array.from(new Set(withBase.map((url) => canonicalizeUrl(url))));
}

export function createCrawlerAdapter(name: string, policy: CrawlPolicy = {}): SourceAdapter {
  return async (source, context?: SourceAdapterContext) => {
    const timeoutMs = Number(process.env.INGEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
    const maxPages = policy.maxPages ?? Number(process.env.MAX_INGEST_PAGES ?? DEFAULT_MAX_PAGES);
    const maxDepth = policy.maxDepth ?? Number(process.env.MAX_CRAWL_DEPTH ?? DEFAULT_MAX_CRAWL_DEPTH);
    const retries = Number(process.env.FETCH_RETRIES ?? DEFAULT_FETCH_RETRIES);
    const retryBackoffMs = Number(process.env.RETRY_BACKOFF_MS ?? DEFAULT_RETRY_BACKOFF_MS);
    const minTextChars = policy.minTextChars ?? 120;
    const userAgent = `what-is-up-docs-ingestion-worker/${name}`;

    const result: IngestRunResult = {
      source: source.id,
      status: "success",
      documents: [],
      not_modified_documents: [],
      fetched_urls: [],
      failed_urls: [],
      errors: [],
    };

    let urls = getCandidateUrls(source);

    if (source.sitemap_url) {
      try {
        const sitemapResponse = await fetchTextWithRetry(
          source.sitemap_url,
          timeoutMs,
          retries,
          retryBackoffMs,
          userAgent,
        );
        const sitemapUrls = extractSitemapUrls(sitemapResponse.text, source.base_url, policy);
        if (sitemapUrls.length > 0) {
          urls = Array.from(new Set([...urls, ...sitemapUrls]));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`sitemap: ${message}`);
        result.status = "partial";
      }
    }

    const queue: Array<{ url: string; depth: number }> = urls
      .filter((url) => isAllowedUrl(url, source.base_url, policy))
      .map((url) => ({ url, depth: 0 }));

    const seen = new Set<string>();

    while (queue.length > 0 && result.documents.length < maxPages) {
      const next = queue.shift();
      if (!next) {
        break;
      }

      const url = canonicalizeUrl(next.url);
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);

      try {
        const response = await fetchTextWithRetry(
          url,
          timeoutMs,
          retries,
          retryBackoffMs,
          userAgent,
          context?.conditional_headers?.[url],
        );

        if (response.not_modified) {
          result.not_modified_documents.push({
            canonical_url: url,
            fetch: {
              etag: response.etag,
              last_modified: response.last_modified,
              status: response.status,
              checked_at: new Date().toISOString(),
            },
          });
          result.fetched_urls.push(url);
          continue;
        }

        const html = response.text;
        const title = extractTitle(html, url);
        const mainHtml = extractMainHtml(html);
        const noiseReducedHtml = stripHtmlNoise(mainHtml, policy.htmlNoisePatterns ?? []);
        const text = stripNoiseLines(
          htmlToText(noiseReducedHtml),
          policy.lineNoisePatterns ?? [],
        );
        const sanitized = sanitizePromptInjectionLines(text);

        if (sanitized.removed_lines > 0) {
          result.errors.push(
            `${url}: sanitized ${sanitized.removed_lines} suspicious line(s) [${sanitized.findings.join(", ")}]`,
          );
          if (result.status === "success") {
            result.status = "partial";
          }
        }

        if (sanitized.text.length >= minTextChars) {
          const chunks = chunkStructuredText(sanitized.text);
          if (chunks.length > 0) {
            result.fetched_urls.push(url);
            result.documents.push({
              canonical_url: url,
              title,
              language: policy.language ?? "en",
              version_tag: policy.versionTag ?? "latest",
              content: sanitized.text,
              chunks,
              fetch: {
                etag: response.etag,
                last_modified: response.last_modified,
                status: response.status,
                checked_at: new Date().toISOString(),
              },
            });
          }
        }

        if (next.depth < maxDepth) {
          const links = extractLinks(mainHtml, url)
            .filter((link) => isAllowedUrl(link, source.base_url, policy))
            .filter((link) => !seen.has(link));

          for (const link of links) {
            queue.push({ url: link, depth: next.depth + 1 });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.failed_urls.push(url);
        result.errors.push(`${url}: ${message}`);
        result.status = "partial";
      }
    }

    if (result.documents.length === 0) {
      result.status = result.errors.length > 0 ? "failed" : "partial";
    }

    return result;
  };
}
