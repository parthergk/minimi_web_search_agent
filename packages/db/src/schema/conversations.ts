import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    title: varchar("title", { length: 500 }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.userId),
  ]
);
