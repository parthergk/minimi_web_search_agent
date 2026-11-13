import type { ChatMessage } from "../lib/api";
import { SourceList } from "./SourceList";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const sources = message.metadata?.sources ?? [];

  return (
    <div className={`msg ${isUser ? "msg-user" : "msg-assistant"}`}>
      <span className="msg-meta">
        {isUser ? "You" : "Minimi"} · {formatTime(message.createdAt)}
      </span>
      <div className="msg-bubble">{message.content}</div>
      <SourceList sources={sources} />
    </div>
  );
}

