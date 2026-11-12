import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { MINIMI_SYSTEM_PROMPT } from "./prompt.js";
import {
  executeWebSearch,
  webSearchToolDefinition,
  type WebSearchArgs,
  type WebSearchExecutor,
  type WebSearchResult,
} from "./tools/webSearch.js";

export { MINIMI_SYSTEM_PROMPT } from "./prompt.js";
export {
  executeWebSearch,
  webSearchToolDefinition,
  type WebSearchArgs,
  type WebSearchExecutor,
  type WebSearchResult,
} from "./tools/webSearch.js";

export interface AgentHistoryMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface RunAgentInput {
  query: string;
  history: AgentHistoryMessage[];
  openaiClient?: OpenAI;
  webSearch?: WebSearchExecutor;
}

export interface RunAgentResult {
  answer: string;
  sources: WebSearchResult[];
}

export async function runAgent({
  query,
  history,
  openaiClient,
  webSearch,
}: RunAgentInput): Promise<RunAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!openaiClient && !apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: MINIMI_SYSTEM_PROMPT },
    ...history
      .filter(
        (msg): msg is { role: "user" | "assistant"; content: string } =>
          msg.role === "user" || msg.role === "assistant"
      )
      .map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: query },
  ];

  const firstResponse = await openai.chat.completions.create({
    model,
    messages,
    tools: [webSearchToolDefinition],
    tool_choice: "auto",
  });

  const assistantMessage = firstResponse.choices[0]?.message;
  if (!assistantMessage) {
    throw new Error("OpenAI returned an empty response");
  }

  const toolCalls = assistantMessage.tool_calls ?? [];
  if (toolCalls.length === 0) {
    return {
      answer: assistantMessage.content ?? "",
      sources: [],
    };
  }

  messages.push(assistantMessage);
  const sources: WebSearchResult[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.type !== "function" || toolCall.function.name !== "web_search") {
      continue;
    }

    const args = JSON.parse(toolCall.function.arguments) as WebSearchArgs;
    const results = await executeWebSearch(args, webSearch);
    sources.push(...results);

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify({ results }),
    });
  }

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
  });

  return {
    answer: finalResponse.choices[0]?.message?.content ?? "",
    sources,
  };
}
