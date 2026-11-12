import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { conversations, messages } from "@minimi/db";

type MessageRole = "user" | "assistant" | "tool";

interface MessageConversationParams {
  id: string;
}

interface AddMessageBody {
  userId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

interface GetMessagesQuery {
  userId: string;
  limit?: number;
  offset?: number;
}

const addMessageSchema = {
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
  body: {
    type: "object",
    required: ["userId", "role", "content"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", format: "uuid" },
      role: { type: "string", enum: ["user", "assistant", "tool"] },
      content: { type: "string", minLength: 1 },
      metadata: { type: "object", additionalProperties: true },
    },
  },
} as const;

const getMessagesSchema = {
  params: {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
  querystring: {
    type: "object",
    required: ["userId"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", format: "uuid" },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
      offset: { type: "integer", minimum: 0, default: 0 },
    },
  },
} as const;

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: MessageConversationParams;
    Body: AddMessageBody;
  }>(
    "/conversations/:id/messages",
    { schema: addMessageSchema },
    async (request, reply) => {
      const { id: conversationId } = request.params;
      const { userId, role, content, metadata } = request.body;

      if (!content.trim()) {
        return reply.code(400).send({
          error: "Message content cannot be empty",
        });
      }

      const created = await app.db.transaction(async (tx) => {
        const [existingConversation] = await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.userId, userId)
            )
          )
          .limit(1);

        if (!existingConversation) {
          return null;
        }

        const [inserted] = await tx
          .insert(messages)
          .values({
            conversationId,
            role,
            content,
            ...(metadata !== undefined ? { metadata } : {}),
          })
          .returning();

        await tx
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));

        return inserted;
      });

      if (!created) {
        return reply.code(404).send({
          error: "Conversation not found",
        });
      }

      return reply.code(201).send(created);
    }
  );

  app.get<{
    Params: MessageConversationParams;
    Querystring: GetMessagesQuery;
  }>(
    "/conversations/:id/messages",
    { schema: getMessagesSchema },
    async (request, reply) => {
      const { id: conversationId } = request.params;
      const { userId, limit = 100, offset = 0 } = request.query;

      const [existingConversation] = await app.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId)
          )
        )
        .limit(1);

      if (!existingConversation) {
        return reply.code(404).send({
          error: "Conversation not found",
        });
      }

      const rows = await app.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return reply.send(rows);
    }
  );
}

