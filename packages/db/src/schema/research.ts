import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations.js";
import { messages } from "./messages.js";

export const researchStatusEnum = pgEnum(
  "research_status",
  ["queued", "running", "completed", "failed"]
);

export const claimTypeEnum = pgEnum(
  "claim_type",
  ["pricing", "feature", "release", "general"]
);

export const researchRuns = pgTable(
  "research_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, {
        onDelete: "cascade",
      }),

    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, {
        onDelete: "cascade",
      }),

    query: text("query").notNull(),

    status: researchStatusEnum("status")
      .notNull()
      .default("queued"),

    startedAt: timestamp("started_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("research_runs_conversation_idx")
      .on(table.conversationId),
  ]
);

export const researchSources = pgTable(
  "research_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    researchRunId: uuid("research_run_id")
      .notNull()
      .references(() => researchRuns.id, {
        onDelete: "cascade",
      }),

    url: text("url").notNull(),

    title: text("title"),

    publishedAt: timestamp("published_at", {
      withTimezone: true,
    }),

    retrievedAt: timestamp("retrieved_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("research_sources_run_url_idx")
      .on(table.researchRunId, table.url),
  ]
);

export const researchClaims = pgTable(
  "research_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    researchRunId: uuid("research_run_id")
      .notNull()
      .references(() => researchRuns.id, {
        onDelete: "cascade",
      }),

    sourceId: uuid("source_id")
      .references(() => researchSources.id, {
        onDelete: "set null",
      }),

    subject: varchar("subject", { length: 255 }),

    claim: text("claim").notNull(),

    claimType: claimTypeEnum("claim_type")
      .notNull()
      .default("general"),

    value: jsonb("value")
      .$type<Record<string, unknown>>(),

    confidence: real("confidence"),

    observedAt: timestamp("observed_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("research_claims_run_idx")
      .on(table.researchRunId),
  ]
);
