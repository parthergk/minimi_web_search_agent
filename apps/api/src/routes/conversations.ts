import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { conversations, users } from "@minimi/db";

interface CreateConversationBody {
  userId: string;
  title?: string | null;
}

interface GetConversationsQuery {
  userId: string;
}

interface GetConversationParams {
  id: string;
}

const createConversationSchema = {
  body: {
    type: "object",
    required: ["userId"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", format: "uuid" },
      title: { type: ["string", "null"], maxLength: 500 },
    },
  },
} as const;

const listConversationsSchema = {
  querystring: {
    type: "object",
    required: ["userId"],
    additionalProperties: false,
    properties: {
      userId: { type: "string", format: "uuid" },
    },
  },
} as const;

const getConversationByIdSchema = {
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
    },
  },
} as const;

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateConversationBody }>(
    "/conversations",
    { schema: createConversationSchema },
    async (request, reply) => {
      const { userId } = request.body;
      const title =
        request.body.title === undefined
          ? undefined
          : request.body.title === null
            ? null
            : request.body.title.trim() || null;

      const [existingUser] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existingUser) {
        return reply.code(404).send({
          error: "User not found",
        });
      }

      const [created] = await app.db
        .insert(conversations)
        .values({
          userId,
          ...(title !== undefined ? { title } : {}),
        })
        .returning();

      return reply.code(201).send(created);
    }
  );

  app.get<{ Querystring: GetConversationsQuery }>(
    "/conversations",
    { schema: listConversationsSchema },
    async (request, reply) => {
      const { userId } = request.query;

      const rows = await app.db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt));

      return reply.send(rows);
    }
  );

  app.get<{
    Params: GetConversationParams;
    Querystring: GetConversationsQuery;
  }>(
    "/conversations/:id",
    { schema: getConversationByIdSchema },
    async (request, reply) => {
      const { id } = request.params;
      const { userId } = request.query;

      const [conversation] = await app.db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
        .limit(1);

      if (!conversation) {
        return reply.code(404).send({
          error: "Conversation not found",
        });
      }

      return reply.send(conversation);
    }
  );
}
