const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface SourceItem {
  title: string;
  url: string;
  snippet?: string;
  publishedAt?: string;
}

export interface ChatHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface SendChatResponse {
  reply: string;
  sources: SourceItem[];
}

export async function sendChatMessage(
  message: string,
  history: ChatHistoryEntry[] = []
): Promise<SendChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      errorMessage = data.error ?? data.message ?? errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<SendChatResponse>;
}
