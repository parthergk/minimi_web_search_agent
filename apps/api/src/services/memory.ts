import OpenAI from "openai";
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { messages, type Message } from "../db/schema.js";

interface RouterAnalysis {
  needs_memory: boolean;
  target_date: string | null;
  keywords: string[];
}

export interface MemoryContextResult {
  needsMemory: boolean;
  targetDate: string | null;
  keywords: string[];
  records: Message[];
  memoryPrompt: string;
}

/**
 * Pre-flight analysis using gpt-4o-mini (temperature: 0, json_object)
 * given today's exact date and day of week to extract:
 * - needs_memory (boolean)
 * - target_date (resolved YYYY-MM-DD string or null)
 * - keywords (array of entity/topic strings)
 */
export async function analyzePromptForMemory(
  userPrompt: string,
  currentDate: Date = new Date(),
  openaiClient?: OpenAI
): Promise<RouterAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!openaiClient && !apiKey) {
    return {
      needs_memory: false,
      target_date: null,
      keywords: [],
    };
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const todayIso = currentDate.toISOString().slice(0, 10);
  const dayOfWeek = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const currentYear = currentDate.getUTCFullYear();

  const systemPrompt = `You are a temporal and intent pre-flight memory router for a conversational AI assistant.
Today's exact reference date: ${todayIso} (${dayOfWeek}). Current year: ${currentYear}.

Your job is to analyze the user's prompt and extract:
1. "needs_memory": boolean - true if the user refers to past conversations, past shortlists, prior questions, previous recommendations, temporal queries (e.g. "on Monday", "last Tuesday", "on 3 November", "what did I ask", "shortlisted CRM tools"), or asks if anything changed since a prior discussion.
2. "target_date": string | null - exact resolved 'YYYY-MM-DD' date string if the user mentions a specific or relative date (e.g., "on Monday", "last Tuesday", "3 November", "yesterday", "last week"). If no date is mentioned or implied, return null. For dates like "3 November" without a year, resolve to the most recent past occurrence relative to ${todayIso}.
3. "keywords": string[] - array of lowercase entity names, products, tool names, or topic keywords to search the conversation memory (e.g. ["crm", "salesforce", "hubspot", "postgres hosting"]).

You MUST respond with valid JSON matching this schema:
{
  "needs_memory": boolean,
  "target_date": string | null,
  "keywords": string[]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { needs_memory: false, target_date: null, keywords: [] };
    }

    const parsed = JSON.parse(content) as RouterAnalysis;
    return {
      needs_memory: Boolean(parsed.needs_memory),
      target_date:
        typeof parsed.target_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.target_date)
          ? parsed.target_date
          : null,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map((k) => String(k).trim()).filter(Boolean)
        : [],
    };
  } catch (err) {
    console.error("[analyzePromptForMemory] Error analyzing prompt:", err);
    return { needs_memory: false, target_date: null, keywords: [] };
  }
}

/**
 * Pre-flight memory retrieval:
 * 1. Fetches the 4 most recent turns for conversational continuity.
 * 2. Uses gpt-4o-mini to resolve intent, relative dates, and entity keywords.
 * 3. Queries Postgres by exact date = target_date if resolved, falling back to full-text search (to_tsvector @@ to_tsquery).
 * 4. Deduplicates recent + historical records and formats prompt labeled with [Date: YYYY-MM-DD].
 */
export async function getMemoryContext(
  userPrompt: string,
  options?: {
    currentDate?: Date;
    openaiClient?: OpenAI;
  }
): Promise<MemoryContextResult> {
  const { db } = getDb();
  const currentDate = options?.currentDate ?? new Date();

  // 1. Fetch 4 most recent turns for immediate conversational continuity
  let recentTurns: Message[] = [];
  try {
    const recent = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(4);
    recentTurns = [...recent].reverse();
  } catch (err) {
    console.error("[getMemoryContext] Failed to fetch recent turns:", err);
  }

  // 2. Pre-flight intent & temporal extraction
  const analysis = await analyzePromptForMemory(
    userPrompt,
    currentDate,
    options?.openaiClient
  );

  let historicalRecords: Message[] = [];

  // 3. Retrieval: target_date lookup, with fallback to FTS
  if (analysis.target_date) {
    try {
      historicalRecords = await db
        .select()
        .from(messages)
        .where(eq(messages.date, analysis.target_date))
        .orderBy(asc(messages.createdAt))
        .limit(10);
    } catch (err) {
      console.error(
        `[getMemoryContext] Target date query failed for ${analysis.target_date}:`,
        err
      );
    }
  }

  // Fallback to full-text search if no date was specified or no records matched target_date
  if (historicalRecords.length === 0 && analysis.keywords.length > 0) {
    const sanitizedTerms = analysis.keywords
      .flatMap((k) => k.split(/\s+/))
      .map((t) => t.replace(/[^a-zA-Z0-9]/g, "").trim())
      .filter((t) => t.length > 1);

    if (sanitizedTerms.length > 0) {
      const tsqueryExpr = sanitizedTerms.map((t) => `${t}:*`).join(" | ");

      try {
        const ftsResult = await db.execute(
          sql`
            SELECT id, date, created_at, user_question, agent_answer, topics
            FROM messages
            WHERE to_tsvector('english', coalesce(user_question, '') || ' ' || coalesce(agent_answer, '') || ' ' || coalesce(topics, '')) @@ to_tsquery('english', ${tsqueryExpr})
            ORDER BY created_at DESC
            LIMIT 10
          `
        );

        historicalRecords = (ftsResult.rows as unknown as Array<{
          id: number;
          date: string;
          created_at: Date | string;
          user_question: string;
          agent_answer: string;
          topics: string;
        }>).map((r) => ({
          id: Number(r.id),
          date: String(r.date),
          createdAt: new Date(r.created_at),
          userQuestion: String(r.user_question),
          agentAnswer: String(r.agent_answer),
          topics: String(r.topics ?? ""),
        }));
      } catch (ftsErr) {
        // Fallback to plainto_tsquery if custom tsquery syntax fails
        try {
          const plainResult = await db.execute(
            sql`
              SELECT id, date, created_at, user_question, agent_answer, topics
              FROM messages
              WHERE to_tsvector('english', coalesce(user_question, '') || ' ' || coalesce(agent_answer, '') || ' ' || coalesce(topics, '')) @@ plainto_tsquery('english', ${analysis.keywords.join(" ")})
              ORDER BY created_at DESC
              LIMIT 10
            `
          );

          historicalRecords = (plainResult.rows as unknown as Array<{
            id: number;
            date: string;
            created_at: Date | string;
            user_question: string;
            agent_answer: string;
            topics: string;
          }>).map((r) => ({
            id: Number(r.id),
            date: String(r.date),
            createdAt: new Date(r.created_at),
            userQuestion: String(r.user_question),
            agentAnswer: String(r.agent_answer),
            topics: String(r.topics ?? ""),
          }));
        } catch (plainErr) {
          console.error("[getMemoryContext] FTS fallback failed:", plainErr);
        }
      }
    }
  }

  // 4. Deduplicate recent + historical records
  const recordMap = new Map<number, Message>();
  for (const m of recentTurns) {
    recordMap.set(m.id, m);
  }
  for (const m of historicalRecords) {
    recordMap.set(m.id, m);
  }

  const allRecords = Array.from(recordMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // 5. Construct memory prompt injection clearly labeled with [Date: YYYY-MM-DD]
  let memoryPrompt = "";
  if (allRecords.length > 0) {
    const formattedRecords = allRecords
      .map(
        (m) =>
          `[Date: ${m.date}] (Recorded at ${new Date(m.createdAt).toISOString()})
User: ${m.userQuestion}
Assistant: ${m.agentAnswer}${m.topics ? `\nTopics: ${m.topics}` : ""}`
      )
      .join("\n\n---\n\n");

    memoryPrompt = `=== HISTORICAL MEMORY SNAPSHOTS (FROM DATABASE) ===
The following are historical conversation records retrieved from the database memory timeline:

${formattedRecords}

CRITICAL RULES FOR HISTORICAL MEMORY & CHANGE-DETECTION:
1. The records above labeled with [Date: YYYY-MM-DD] represent historical snapshots of what was previously asked, answered, or shortlisted.
2. Whenever the user asks whether anything has changed, if pricing has updated, if new features have launched, or whether a past answer is still valid today, DO NOT rely on your pre-trained knowledge or the snapshot alone.
3. You MUST ALWAYS use the 'web_search' tool to check the live, current web for up-to-date pricing, features, and announcements.
4. Compare your live web findings directly against the historical snapshot and clearly state what changed and what remained the same.`;
  }

  return {
    needsMemory: analysis.needs_memory,
    targetDate: analysis.target_date,
    keywords: analysis.keywords,
    records: allRecords,
    memoryPrompt,
  };
}

/**
 * Non-blocking write path:
 * 1. Immediately inserts { date, userQuestion, agentAnswer } into Postgres.
 * 2. Asynchronously fires background gpt-4o-mini task to extract topics and update the record.
 */
export async function saveTurn(
  userQuestion: string,
  agentAnswer: string,
  dateStr?: string
): Promise<number | null> {
  const { db } = getDb();
  const date = dateStr ?? new Date().toISOString().slice(0, 10);

  try {
    const inserted = await db
      .insert(messages)
      .values({
        date,
        userQuestion,
        agentAnswer,
        topics: "",
      })
      .returning({ id: messages.id });

    const recordId = inserted[0]?.id;
    if (recordId) {
      // Fire asynchronous background task without awaiting it before sending HTTP response
      setImmediate(() => {
        extractAndSaveTopics(recordId, userQuestion, agentAnswer).catch((err) => {
          console.error(
            `[saveTurn] Background topic extraction failed for record ${recordId}:`,
            err
          );
        });
      });
      return recordId;
    }
  } catch (err) {
    console.error("[saveTurn] Failed to save turn to database:", err);
  }

  return null;
}

/**
 * Background topic extraction:
 * Uses gpt-4o-mini to extract key entities, tool names, and topics
 * and updates the topics column as lowercase comma-separated text.
 */
export async function extractAndSaveTopics(
  recordId: number,
  userQuestion: string,
  agentAnswer: string
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return;

  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Extract key entities, tools/product names, companies, and core topics from this conversation turn. Return ONLY a concise, lowercase, comma-separated list of keywords (e.g. 'crm, hubspot, salesforce, pipedrive, pricing, 20-person sales team'). No other text or markdown.",
      },
      {
        role: "user",
        content: `User Question: ${userQuestion}\nAgent Answer: ${agentAnswer.slice(0, 800)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  const cleanedTopics = raw
    .toLowerCase()
    .replace(/^topics?:\s*/i, "")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (cleanedTopics) {
    const { db } = getDb();
    await db
      .update(messages)
      .set({ topics: cleanedTopics })
      .where(eq(messages.id, recordId));
  }
}

