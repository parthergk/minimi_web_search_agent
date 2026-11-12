import { and, asc, desc, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import {
  EMBEDDING_MODEL,
  createEmbedding,
  createEmbeddings,
  type AgentMemoryItem,
} from "@minimi/agent";
import {
  conversations,
  db as dbInstance,
  messageEmbeddings,
  messages,
} from "@minimi/db";

type DbClient = typeof dbInstance;

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const BUFFER_MS = 12 * 60 * 60 * 1000;

function dayWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0) -
      BUFFER_MS
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999) +
      BUFFER_MS
  );
  return { start, end };
}

export function parseTemporalWindow(
  query: string,
  now: Date = new Date()
): { start: Date; end: Date } | null {
  const lower = query.toLowerCase();

  // ISO date: YYYY-MM-DD
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    return dayWindow(new Date(Date.UTC(year, month, day)));
  }

  // "3 November" or "November 3" (with optional year)
  const monthNames = Object.keys(MONTHS).join("|");
  const dayFirst = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`)
  );
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = MONTHS[dayFirst[2]!];
    const year = dayFirst[3] ? Number(dayFirst[3]) : now.getUTCFullYear();
    if (month !== undefined) {
      let target = new Date(Date.UTC(year, month, day));
      if (!dayFirst[3] && target > now) {
        target = new Date(Date.UTC(year - 1, month, day));
      }
      return dayWindow(target);
    }
  }

  const monthFirst = lower.match(
    new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`)
  );
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!];
    const day = Number(monthFirst[2]);
    const year = monthFirst[3] ? Number(monthFirst[3]) : now.getUTCFullYear();
    if (month !== undefined) {
      let target = new Date(Date.UTC(year, month, day));
      if (!monthFirst[3] && target > now) {
        target = new Date(Date.UTC(year - 1, month, day));
      }
      return dayWindow(target);
    }
  }

  if (/\byesterday\b/.test(lower)) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    return dayWindow(d);
  }

  // "on Monday", "last Tuesday", etc.
  const weekdayNames = Object.keys(WEEKDAYS).join("|");
  const weekdayMatch = lower.match(
    new RegExp(`\\b(last\\s+)?(${weekdayNames})\\b`)
  );
  if (weekdayMatch) {
    const isLast = Boolean(weekdayMatch[1]);
    const targetDay = WEEKDAYS[weekdayMatch[2]!];
    if (targetDay !== undefined) {
      const currentDay = now.getUTCDay();
      let diff = (currentDay - targetDay + 7) % 7;
      if (diff === 0) diff = 7;
      if (isLast && diff < 7 && targetDay > currentDay) {
        // "last Tuesday" when today is Monday -> already 6 days ago; if today is Wed -> 1 day or 8 days
      }
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - diff);
      return dayWindow(d);
    }
  }

  if (/\blast week\b/.test(lower)) {
    const end = new Date(now);
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 14);
    return { start, end };
  }

  return null;
}

export async function saveMessageEmbeddings(
  db: DbClient,
  items: Array<{ messageId: string; content: string }>
): Promise<void> {
  const validItems = items.filter((item) => item.content.trim().length > 0);
  if (validItems.length === 0) return;

  const embeddings = await createEmbeddings(
    validItems.map((item) => item.content)
  );

  await db
    .insert(messageEmbeddings)
    .values(
      validItems.map((item, idx) => ({
        messageId: item.messageId,
        embedding: embeddings[idx]!,
        model: EMBEDDING_MODEL,
      }))
    )
    .onConflictDoNothing();
}

export interface RetrieveMemoryInput {
  userId: string;
  query: string;
  excludeMessageIds?: string[];
  limit?: number;
}

export async function retrieveMemory(
  db: DbClient,
  {
    userId,
    query,
    excludeMessageIds = [],
    limit = 8,
  }: RetrieveMemoryInput
): Promise<AgentMemoryItem[]> {
  const baseFilters = [eq(conversations.userId, userId)];
  if (excludeMessageIds.length > 0) {
    baseFilters.push(notInArray(messages.id, excludeMessageIds));
  }

  const temporalWindow = parseTemporalWindow(query);

  const [vectorRows, keywordRows, temporalRows] = await Promise.all([
    // 1. Semantic vector search (pgvector HNSW)
    (async () => {
      const queryEmbedding = await createEmbedding(query);
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;
      const distance = sql<number>`${messageEmbeddings.embedding} <=> ${vectorLiteral}::vector`;

      return db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messageEmbeddings)
        .innerJoin(messages, eq(messageEmbeddings.messageId, messages.id))
        .innerJoin(
          conversations,
          eq(messages.conversationId, conversations.id)
        )
        .where(and(...baseFilters))
        .orderBy(asc(distance))
        .limit(5);
    })(),

    // 2. Full-text keyword search (GIN to_tsvector)
    (async () => {
      const tsQuery = sql`plainto_tsquery('english', ${query})`;
      const tsVector = sql`to_tsvector('english', ${messages.content})`;
      const rank = sql<number>`ts_rank(${tsVector}, ${tsQuery})`;

      return db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(
          conversations,
          eq(messages.conversationId, conversations.id)
        )
        .where(and(...baseFilters, sql`${tsVector} @@ ${tsQuery}`))
        .orderBy(desc(rank))
        .limit(5);
    })(),

    // 3. Temporal date-range search (for "3 November", "On Monday", "Last Tuesday")
    temporalWindow
      ? db
          .select({
            id: messages.id,
            role: messages.role,
            content: messages.content,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .innerJoin(
            conversations,
            eq(messages.conversationId, conversations.id)
          )
          .where(
            and(
              ...baseFilters,
              gte(messages.createdAt, temporalWindow.start),
              lte(messages.createdAt, temporalWindow.end)
            )
          )
          .orderBy(asc(messages.createdAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  const seen = new Map<string, AgentMemoryItem>();

  const addRows = (
    rows: Array<{
      id: string;
      role: "user" | "assistant" | "tool";
      content: string;
      createdAt: Date;
    }>,
    source: AgentMemoryItem["source"]
  ) => {
    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.set(row.id, {
          role: row.role,
          content: row.content,
          createdAt: row.createdAt.toISOString(),
          source,
        });
      }
    }
  };

  // Prioritize temporal matches when a date is referenced, then keyword, then semantic
  addRows(temporalRows, "temporal");
  addRows(keywordRows, "keyword");
  addRows(vectorRows, "semantic");

  return Array.from(seen.values()).slice(0, limit);
}

