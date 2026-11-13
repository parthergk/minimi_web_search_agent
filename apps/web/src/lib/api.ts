const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceItem {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: {
    sources?: SourceItem[];
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface ChatTurnResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  sources: SourceItem[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      // ignore non-JSON errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function signInOrCreateUser(
  email: string,
  name?: string
): Promise<User> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.trim(),
      ...(name?.trim() ? { name: name.trim() } : {}),
    }),
  });

  if (res.status === 409) {
    return request<User>(`/users?email=${encodeURIComponent(email.trim())}`);
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(data.error ?? data.message ?? `Failed (${res.status})`);
  }

  return res.json() as Promise<User>;
}

export function listConversations(userId: string): Promise<Conversation[]> {
  return request<Conversation[]>(
    `/conversations?userId=${encodeURIComponent(userId)}`
  );
}

export function createConversation(
  userId: string,
  title?: string
): Promise<Conversation> {
  return request<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      userId,
      ...(title?.trim() ? { title: title.trim() } : {}),
    }),
  });
}

export function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(
    `/conversations/${encodeURIComponent(conversationId)}/chat?userId=${encodeURIComponent(userId)}`
  );
}

export function sendChatMessage(
  conversationId: string,
  userId: string,
  content: string
): Promise<ChatTurnResponse> {
  return request<ChatTurnResponse>(
    `/conversations/${encodeURIComponent(conversationId)}/chat`,
    {
      method: "POST",
      body: JSON.stringify({ userId, content }),
    }
  );
}

