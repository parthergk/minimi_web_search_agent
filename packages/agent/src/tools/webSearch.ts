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

export type WebSearchExecutor = (
  args: Required<WebSearchArgs>
) => Promise<WebSearchResult[]>;

export const webSearchToolDefinition: ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current, changing, or externally verifiable information (such as recent prices, releases, news, or live facts). Do not use for general knowledge.",
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

async function searchWithTavily(
  apiKey: string,
  query: string,
  maxResults: number
): Promise<WebSearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  };

  return (data.results ?? [])
    .filter((item): item is { title?: string; url: string; content?: string; published_date?: string } => Boolean(item.url))
    .map((item) => ({
      title: item.title ?? item.url,
      url: item.url,
      snippet: item.content ?? "",
      ...(item.published_date ? { publishedAt: item.published_date } : {}),
    }));
}

export async function executeWebSearch(
  args: WebSearchArgs,
  customExecutor?: WebSearchExecutor
): Promise<WebSearchResult[]> {
  const query = args.query.trim();
  if (!query) {
    throw new Error("web_search query must not be empty");
  }

  const maxResults = Math.min(Math.max(args.maxResults ?? 5, 1), 10);

  if (customExecutor) {
    return customExecutor({ query, maxResults });
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured"
    );
  }

  return searchWithTavily(tavilyKey, query, maxResults);
}

