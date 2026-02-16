import { z } from "zod";

export const QueryFiltersSchema = z
  .object({
    sources: z.array(z.string()).optional(),
    version: z.string().optional(),
    updated_after: z.string().datetime().optional(),
    language: z.string().optional(),
    region: z.string().optional(),
    plan: z.string().optional(),
    deployment_type: z.string().optional(),
    cloud: z.string().optional(),
    reference_date: z.string().datetime().optional(),
  })
  .strict();

export const SearchDocsInputSchema = z
  .object({
    query: z.string().min(2),
    sources: z.array(z.string()).optional(),
    version: z.string().optional(),
    top_k: z.number().int().min(1).max(50).optional(),
    updated_after: z.string().datetime().optional(),
    language: z.string().optional(),
    region: z.string().optional(),
    plan: z.string().optional(),
    deployment_type: z.string().optional(),
    cloud: z.string().optional(),
    reference_date: z.string().datetime().optional(),
    compact: z.boolean().optional(),
  })
  .strict();

export const AnswerWithSourcesInputSchema = z
  .object({
    question: z.string().min(3),
    sources: z.array(z.string()).optional(),
    version: z.string().optional(),
    style: z.enum(["concise", "detailed"]).optional(),
    max_citations: z.number().int().min(1).max(10).optional(),
    updated_after: z.string().datetime().optional(),
    language: z.string().optional(),
    region: z.string().optional(),
    plan: z.string().optional(),
    deployment_type: z.string().optional(),
    cloud: z.string().optional(),
    reference_date: z.string().datetime().optional(),
    compact: z.boolean().optional(),
  })
  .strict();

export const CheckFreshnessInputSchema = z
  .object({
    sources: z.array(z.string()).optional(),
    compact: z.boolean().optional(),
  })
  .strict();

export const ListChangesInputSchema = z
  .object({
    source: z.string().optional(),
    event_type: z
      .enum(["document_added", "updated", "deprecation", "breaking_change"])
      .optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    compact: z.boolean().optional(),
  })
  .strict();

export const DocsPreflightInputSchema = z
  .object({
    task: z.string().min(3),
    sources: z.array(z.string()).optional(),
  })
  .strict();
