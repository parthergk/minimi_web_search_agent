import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { MINIMI_SYSTEM_PROMPT } from "./prompt.js";
import {
  webSearchToolDefinition,
  executeWebSearch,
  type WebSearchArgs,
  type WebSearchResult,
  type WebSearchExecutionResult,
  type TavilySearchFn,
} from "./tools/webSearch.js";

export { MINIMI_SYSTEM_PROMPT } from "./prompt.js";
export {
  webSearchToolDefinition,
  executeWebSearch,
  type WebSearchArgs,
  type WebSearchResult,
  type WebSearchExecutionResult,
  type TavilySearchFn,
} from "./tools/webSearch.js";

export interface ConversationTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentInput {
  query: string;
  history?: ConversationTurnMessage[];
  currentDate?: string;
  timezone?: string;
  openaiClient?: OpenAI;
  tavilySearchFn?: TavilySearchFn;
  maxToolRounds?: number;
}

export interface RunAgentResult {
  answer: string;
  sources: WebSearchResult[];
}

function buildSystemMessage(
  currentDate: string,
  timezone: string
): ChatCompletionMessageParam {
  return {
    role: "system",
    content: `${MINIMI_SYSTEM_PROMPT}

Current context:
- Current UTC timestamp: ${currentDate}
- User local timezone: ${timezone}
- User local calendar date: ${currentDate.slice(0, 10)}`,
  };
}

export async function runAgent({
  query,
  history = [],
  currentDate = new Date().toISOString(),
  timezone = "UTC",
  openaiClient,
  tavilySearchFn,
  maxToolRounds = 5,
}: RunAgentInput): Promise<RunAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!openaiClient && !apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const tools: ChatCompletionTool[] = [webSearchToolDefinition];

  const messages: ChatCompletionMessageParam[] = [
    buildSystemMessage(currentDate, timezone),
    ...history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user", content: query },
  ];

  const collectedSources: WebSearchResult[] = [];

  for (let round = 0; round < maxToolRounds; round++) {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
    });

    const assistantMsg = response.choices[0]?.message;
    if (!assistantMsg) {
      throw new Error("OpenAI returned an empty completion");
    }

    const toolCalls = assistantMsg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        answer: assistantMsg.content ?? "",
        sources: collectedSources,
      };
    }

    messages.push(assistantMsg);

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue;

      if (toolCall.function.name === "web_search") {
        try {
          const args = JSON.parse(
            toolCall.function.arguments
          ) as WebSearchArgs;

          const searchResult = await executeWebSearch(args, {
            customSearchFn: tavilySearchFn,
          });

          for (const s of searchResult.sources) {
            if (!collectedSources.some((existing) => existing.url === s.url)) {
              collectedSources.push(s);
            }
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              query: searchResult.query,
              results: searchResult.rawResponse.results ?? [],
            }),
          });
        } catch (err) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: err instanceof Error ? err.message : "web_search failed",
            }),
          });
        }
      } else {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            error: `Unknown tool: ${toolCall.function.name}`,
          }),
        });
      }
    }
  }

  const finalResponse = await openai.chat.completions.create({
    model,
    messages,
  });

  return {
    answer: finalResponse.choices[0]?.message?.content ?? "",
    sources: collectedSources,
  };
}
