import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { runAgent } from "@minimi/agent";
import { conversations, messages } from "@minimi/db";

interface ChatConversationParams {
  id: string;
}

interface ChatBody {
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface GetChatQuery {
  userId: string;
  limit?: number;
  offset?: number;
}

const chatPostSchema = {
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
    required: ["userId", "content"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", format: "uuid" },
      content: { type: "string", minLength: 1 },
      metadata: { type: "object", additionalProperties: true },
    },
  },
} as const;

const chatGetSchema = {
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

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: ChatConversationParams;
    Body: ChatBody;
  }>(
    "/conversations/:id/chat",
    { schema: chatPostSchema },
    async (request, reply) => {
      const { id: conversationId } = request.params;
      const { userId, content, metadata } = request.body;

      if (!content.trim()) {
        return reply.code(400).send({
          error: "Message content cannot be empty",
        });
      }

      const userMessage = await app.db.transaction(async (tx) => {
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
            role: "user",
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

      if (!userMessage) {
        return reply.code(404).send({
          error: "Conversation not found",
        });
      }

      // Load the previous 20 messages and reverse into chronological order for LLM input
      const recentMessages = await app.db
        .select({
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            ne(messages.id, userMessage.id)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(20);

      const history = recentMessages.reverse();

      const agentResult = await runAgent({
        query: content,
        history,
      });

      const assistantMessage = await app.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(messages)
          .values({
            conversationId,
            role: "assistant",
            content: agentResult.answer,
            metadata:
              agentResult.sources.length > 0
                ? { sources: agentResult.sources }
                : {},
          })
          .returning();

        await tx
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));

        return inserted;
      });

      return reply.code(201).send({
        userMessage,
        assistantMessage,
        sources: agentResult.sources,
      });
    }
  );

  app.get<{
    Params: ChatConversationParams;
    Querystring: GetChatQuery;
  }>(
    "/conversations/:id/chat",
    { schema: chatGetSchema },
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

