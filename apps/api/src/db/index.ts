import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const connectionString =
      process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not configured. Please set DATABASE_URL in your .env file."
      );
    }

    const isSsl =
      connectionString.includes("neon.tech") ||
      connectionString.includes("sslmode=require");

    pool = new Pool({
      connectionString,
      ssl: isSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });

    db = drizzle(pool, { schema });
  }

  return { db, pool: pool! };
}

/**
 * Ensures the messages table and required B-tree & GIN indexes exist on startup.
 * Automatically handles migration if an older legacy table structure was present.
 */
export async function initDb(): Promise<void> {
  const { pool } = getDb();

  const client = await pool.connect();
  try {
    // Check if messages table exists
    const checkTable = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages'`
    );

    if (checkTable.rows.length > 0) {
      const hasUserQuestion = checkTable.rows.some(
        (r) => r.column_name === "user_question"
      );
      if (!hasUserQuestion) {
        // Table exists with old schema, rename it safely
        const backupName = `messages_backup_${Date.now()}`;
        console.warn(
          `[initDb] Legacy 'messages' table detected without 'user_question'. Renaming to ${backupName}...`
        );
        await client.query(`ALTER TABLE messages RENAME TO ${backupName}`);
      }
    }

    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        date TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        user_question TEXT NOT NULL,
        agent_answer TEXT NOT NULL,
        topics TEXT DEFAULT '' NOT NULL
      );
    `);

    // Create date index for instant exact-date lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS messages_date_idx ON messages (date);
    `);

    // Create created_at index for fast ordering of recent turns
    await client.query(`
      CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);
    `);

    // Create GIN index for full-text search across question, answer, and topics
    await client.query(`
      CREATE INDEX IF NOT EXISTS messages_fts_idx ON messages USING gin (
        to_tsvector('english', coalesce(user_question, '') || ' ' || coalesce(agent_answer, '') || ' ' || coalesce(topics, ''))
      );
    `);

    console.log("[initDb] Memory layer database initialized with GIN and B-Tree indexes.");
  } finally {
    client.release();
  }
}

export { schema };

