import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    userQuestion: text("user_question").notNull(),
    agentAnswer: text("agent_answer").notNull(),
    topics: text("topics").default("").notNull(),
  },
  (table) => [
    index("messages_date_idx").on(table.date),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_fts_idx").using(
      "gin",
      sql`to_tsvector('english', coalesce(${table.userQuestion}, '') || ' ' || coalesce(${table.agentAnswer}, '') || ' ' || coalesce(${table.topics}, ''))`
    ),
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

