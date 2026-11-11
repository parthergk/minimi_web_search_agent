import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { conversations } from "./conversations.js";

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "tool",
]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, {
        onDelete: "cascade",
      }),

    role: messageRoleEnum("role").notNull(),

    content: text("content").notNull(),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx")
      .on(table.conversationId),

    index("messages_created_at_idx")
      .on(table.createdAt),
  ]
);
