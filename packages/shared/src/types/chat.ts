export interface ConversationItem {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
    publishedAt?: string;
  }>;
  createdAt: string;
}

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

