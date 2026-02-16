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

export const SearchRequestSchema = z
  .object({
    query: z.string().min(2),
    filters: QueryFiltersSchema.optional(),
    top_k: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export const AnswerRequestSchema = z
  .object({
    question: z.string().min(3),
    filters: QueryFiltersSchema.optional(),
    style: z.enum(["concise", "detailed"]).optional(),
    max_citations: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export const SourceSyncRequestSchema = z
  .object({
    source: z.string().min(1),
  })
  .strict();

export const ListChangesQuerySchema = z
  .object({
    source: z.string().min(1).optional(),
    event_type: z
      .enum(["document_added", "updated", "deprecation", "breaking_change"])
      .optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export const TelemetryQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).optional(),
  })
  .strict();

export const AuditExportQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    format: z.enum(["json", "ndjson"]).optional(),
  })
  .strict();

export const SlackTestAlertRequestSchema = z
  .object({
    webhook_url: z.string().url().optional(),
    source: z.string().min(1).optional(),
    message: z.string().min(1).max(2000).optional(),
  })
  .strict();
