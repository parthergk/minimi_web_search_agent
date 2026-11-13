import type { FastifyInstance } from "fastify";
import { runAgent, type ConversationTurnMessage } from "@minimi/agent";

interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  message: string;
  history?: ChatMessageInput[];
}

const chatSchema = {
  body: {
    type: "object",
    required: ["message"],
    additionalProperties: false,
    properties: {
      message: { type: "string", minLength: 1 },
      history: {
        type: "array",
        items: {
          type: "object",
          required: ["role", "content"],
          additionalProperties: false,
          properties: {
            role: { type: "string", enum: ["user", "assistant"] },
            content: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: ChatRequestBody }>(
    "/api/chat",
    { schema: chatSchema },
    async (request, reply) => {
      const { message, history = [] } = request.body;

      const trimmed = message.trim();
      if (!trimmed) {
        return reply.code(400).send({ error: "Message cannot be empty" });
      }

      const agentHistory: ConversationTurnMessage[] = history.map((h) => ({
        role: h.role,
        content: h.content,
      }));

      const result = await runAgent({
        query: trimmed,
        history: agentHistory,
      });

      return reply.send({
        reply: result.answer,
        sources: result.sources,
      });
    }
  );
}
