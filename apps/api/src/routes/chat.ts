import type { FastifyInstance } from "fastify";
import { runAgent, type ConversationTurnMessage } from "@minimi/agent";
import { getMemoryContext, saveTurn } from "../services/memory.js";

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

      // Pre-Flight Memory Router:
      // Fetches recent turns, analyzes intent/temporal reference, queries Postgres by date or FTS,
      // and injects deduplicated historical snapshots into the agent system prompt.
      let memoryPrompt: string | undefined;
      try {
        const memoryContext = await getMemoryContext(trimmed);
        if (memoryContext.memoryPrompt) {
          memoryPrompt = memoryContext.memoryPrompt;
        }
      } catch (err) {
        app.log.error(err, "Memory retrieval failed, proceeding with agent run");
      }

      // Run main LLM agent (Single Tool Constraint: only web_search tool is exposed)
      const result = await runAgent({
        query: trimmed,
        history: agentHistory,
        memoryContext: memoryPrompt,
      });

      // Non-Blocking Write Path:
      // Inserts the turn immediately into Postgres and launches async background topic extraction
      try {
        await saveTurn(trimmed, result.answer);
      } catch (err) {
        app.log.error(err, "Failed to save turn to memory");
      }

      return reply.send({
        reply: result.answer,
        sources: result.sources,
      });
    }
  );
}
