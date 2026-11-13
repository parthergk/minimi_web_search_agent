import { tavily, type TavilyClient } from "@tavily/core";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export interface WebSearchArgs {
  query: string;
  maxResults?: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface WebSearchExecutionResult {
  query: string;
  rawResponse: Record<string, unknown>;
  sources: WebSearchResult[];
}

export const webSearchToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the live web for current, changing, or externally verifiable information (such as recent prices, releases, news, or live facts). Do not use for common general knowledge.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "Concise search query to look up on the web.",
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          default: 5,
          description: "Maximum number of search results to return (1-10).",
        },
      },
    },
  },
};

let cachedTavily: TavilyClient | null = null;

function getTavilyClient(): TavilyClient {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }
  if (!cachedTavily) {
    cachedTavily = tavily({ apiKey });
  }
  return cachedTavily;
}

export type TavilySearchFn = (
  args: WebSearchArgs
) => Promise<{
  query: string;
  rawResponse: Record<string, unknown>;
  sources: WebSearchResult[];
}>;

export interface ExecuteWebSearchOptions {
  tavilyClient?: TavilyClient;
  customSearchFn?: TavilySearchFn;
}

export async function executeWebSearch(
  args: WebSearchArgs,
  options?: ExecuteWebSearchOptions
): Promise<WebSearchExecutionResult> {
  const query = args.query.trim();
  if (!query) {
    throw new Error("web_search query must not be empty");
  }

  const maxResults = Math.min(Math.max(args.maxResults ?? 5, 1), 10);

  if (options?.customSearchFn) {
    return options.customSearchFn({ query, maxResults });
  }

  const tavilyClient = options?.tavilyClient ?? getTavilyClient();
  const raw = (await tavilyClient.search(query, {
    maxResults,
    searchDepth: "basic",
  })) as Record<string, unknown>;

  const results = (raw.results ?? []) as Array<{
    title?: string;
    url?: string;
    content?: string;
    publishedDate?: string;
  }>;

  const sources: WebSearchResult[] = results
    .filter((item): item is { title?: string; url: string; content?: string; publishedDate?: string } =>
      Boolean(item.url)
    )
    .map((item) => ({
      title: item.title ?? item.url,
      url: item.url,
      snippet: item.content ?? "",
      ...(item.publishedDate ? { publishedAt: item.publishedDate } : {}),
    }));

  return {
    query,
    rawResponse: raw,
    sources,
  };
}
