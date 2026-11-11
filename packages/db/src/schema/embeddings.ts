import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

import { customType } from "drizzle-orm/pg-core";

import { messages } from "./messages.js";

const vector = customType<{
  data: number[];
  driverData: string;
}>({
  dataType() {
    return "vector(1536)";
  },

  toDriver(value) {
    return `[${value.join(",")}]`;
  },

  fromDriver(value) {
    return value
      .slice(1, -1)
      .split(",")
      .map(Number);
  },
});

export const messageEmbeddings = pgTable(
  "message_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    messageId: uuid("message_id")
      .notNull()
      .unique()
      .references(() => messages.id, {
        onDelete: "cascade",
      }),

    embedding: vector("embedding").notNull(),

    model: varchar("model", { length: 100 })
      .notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  }
);
