import { createHash } from "node:crypto";

import type { Pool } from "pg";

import { newId } from "./id.js";
import type { IngestedDocument, IngestRunResult } from "./adapters/types.js";

type PersistStats = {
  inserted_documents: number;
  updated_documents: number;
  inserted_chunks: number;
  change_events: number;
};

type ExistingDocument = {
  id: string;
  content_hash: string;
  title: string;
};

type DocumentChangeEvent = {
  event_type: "document_added" | "updated" | "deprecation" | "breaking_change";
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  details: Record<string, unknown>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function estimateTokenCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(words, Math.ceil(text.length / 4));
}

function detectDocumentChangeEvents(
  previousText: string,
  nextText: string,
  title: string,
): DocumentChangeEvent[] {
  const events: DocumentChangeEvent[] = [];

  const prevLower = previousText.toLowerCase();
  const nextLower = nextText.toLowerCase();

  const introducedDeprecation =
    !prevLower.includes("deprecated") &&
    (nextLower.includes("deprecated") || nextLower.includes("deprecation"));

  const introducedBreaking =
    (nextLower.includes("breaking change") ||
      nextLower.includes("no longer supported") ||
      nextLower.includes("removed") ||
      nextLower.includes("sunset")) &&
    !(
      prevLower.includes("breaking change") ||
      prevLower.includes("no longer supported") ||
      prevLower.includes("removed") ||
      prevLower.includes("sunset")
    );

  if (introducedBreaking) {
    events.push({
      event_type: "breaking_change",
      severity: "high",
      summary: `Potential breaking change detected in ${title}`,
      details: {
        detector: "keyword",
        keyword_family: "breaking_or_removed",
      },
    });
  }

  if (introducedDeprecation) {
    events.push({
      event_type: "deprecation",
      severity: "medium",
      summary: `Deprecation language detected in ${title}`,
      details: {
        detector: "keyword",
        keyword_family: "deprecation",
      },
    });
  }

  if (events.length === 0) {
    events.push({
      event_type: "updated",
      severity: "low",
      summary: `Documentation updated for ${title}`,
      details: {
        detector: "content_hash",
      },
    });
  }

  return events;
}

async function insertChangeEvents(
  db: Pool,
  sourceId: string,
  documentId: string,
  canonicalUrl: string,
  title: string,
  detectedAt: string,
  events: DocumentChangeEvent[],
): Promise<number> {
  let inserted = 0;

  for (const event of events) {
    await db.query(
      `
        INSERT INTO change_event (
          id,
          source_id,
          document_id,
          canonical_url,
          title,
          event_type,
          severity,
          summary,
          details,
          detected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
      `,
      [
        newId("chg"),
        sourceId,
        documentId,
        canonicalUrl,
        title,
        event.event_type,
        event.severity,
        event.summary,
        JSON.stringify(event.details),
        detectedAt,
      ],
    );
    inserted += 1;
  }

  return inserted;
}

async function findDocument(
  db: Pool,
  sourceId: string,
  canonicalUrl: string,
  versionTag?: string,
): Promise<ExistingDocument | null> {
  const result = await db.query(
    `
      SELECT id, content_hash, title
      FROM document
      WHERE source_id = $1
        AND canonical_url = $2
        AND COALESCE(version_tag, '') = COALESCE($3, '')
      LIMIT 1
    `,
    [sourceId, canonicalUrl, versionTag ?? null],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: String(result.rows[0]?.id),
    content_hash: String(result.rows[0]?.content_hash),
    title: String(result.rows[0]?.title),
  };
}

async function getCurrentDocumentText(db: Pool, documentId: string): Promise<string> {
  const result = await db.query(
    `
      SELECT text
      FROM chunk
      WHERE document_id = $1
      ORDER BY chunk_index ASC
    `,
    [documentId],
  );

  return result.rows.map((row) => String(row.text ?? "")).join("\n\n");
}

async function replaceChunks(
  db: Pool,
  documentId: string,
  chunks: string[],
  validFrom: string,
): Promise<number> {
  await db.query(`DELETE FROM chunk WHERE document_id = $1`, [documentId]);

  let inserted = 0;
  for (const [index, chunk] of chunks.entries()) {
    await db.query(
      `
        INSERT INTO chunk (
          id,
          document_id,
          chunk_index,
          text,
          token_count,
          valid_from,
          valid_to
        )
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz, NULL)
      `,
      [newId("chk"), documentId, index, chunk, estimateTokenCount(chunk), validFrom],
    );
    inserted += 1;
  }

  return inserted;
}

async function persistDocument(
  db: Pool,
  sourceId: string,
  doc: IngestedDocument,
  ingestedAt: string,
): Promise<{ changed: boolean; chunks_inserted: number; change_events: number }> {
  const contentHash = sha256(doc.content);
  const existing = await findDocument(db, sourceId, doc.canonical_url, doc.version_tag);

  if (!existing) {
    const documentId = newId("doc");
    await db.query(
      `
        INSERT INTO document (
          id,
          source_id,
          canonical_url,
          title,
          version_tag,
          language,
          first_seen_at,
          last_seen_at,
          last_changed_at,
          content_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz, $7::timestamptz, $8)
      `,
      [
        documentId,
        sourceId,
        doc.canonical_url,
        doc.title,
        doc.version_tag ?? null,
        doc.language,
        ingestedAt,
        contentHash,
      ],
    );

    const chunksInserted = await replaceChunks(db, documentId, doc.chunks, ingestedAt);
    const changeEvents = await insertChangeEvents(
      db,
      sourceId,
      documentId,
      doc.canonical_url,
      doc.title,
      ingestedAt,
      [
        {
          event_type: "document_added",
          severity: "low",
          summary: `Documentation added for ${doc.title}`,
          details: { detector: "new_document" },
        },
      ],
    );

    return { changed: true, chunks_inserted: chunksInserted, change_events: changeEvents };
  }

  const changed = existing.content_hash !== contentHash;
  await db.query(
    `
      UPDATE document
      SET
        title = $2,
        language = $3,
        last_seen_at = $4::timestamptz,
        last_changed_at = CASE WHEN $5 THEN $4::timestamptz ELSE last_changed_at END,
        content_hash = CASE WHEN $5 THEN $6 ELSE content_hash END
      WHERE id = $1
    `,
    [existing.id, doc.title, doc.language, ingestedAt, changed, contentHash],
  );

  if (!changed) {
    return { changed: false, chunks_inserted: 0, change_events: 0 };
  }

  const previousText = await getCurrentDocumentText(db, existing.id);
  const chunksInserted = await replaceChunks(db, existing.id, doc.chunks, ingestedAt);
  const events = detectDocumentChangeEvents(previousText, doc.content, doc.title);
  const changeEvents = await insertChangeEvents(
    db,
    sourceId,
    existing.id,
    doc.canonical_url,
    doc.title,
    ingestedAt,
    events,
  );

  return { changed: true, chunks_inserted: chunksInserted, change_events: changeEvents };
}

export async function persistIngestRun(
  db: Pool,
  sourceId: string,
  run: IngestRunResult,
  ingestedAt: string,
): Promise<PersistStats> {
  const stats: PersistStats = {
    inserted_documents: 0,
    updated_documents: 0,
    inserted_chunks: 0,
    change_events: 0,
  };

  for (const doc of run.documents) {
    const existing = await findDocument(db, sourceId, doc.canonical_url, doc.version_tag);
    const saved = await persistDocument(db, sourceId, doc, ingestedAt);

    if (!existing) {
      stats.inserted_documents += 1;
    } else if (saved.changed) {
      stats.updated_documents += 1;
    }

    stats.inserted_chunks += saved.chunks_inserted;
    stats.change_events += saved.change_events;
  }

  return stats;
}
