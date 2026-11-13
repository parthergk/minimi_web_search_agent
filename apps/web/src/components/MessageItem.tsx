import type { SourceItem } from "../lib/api";
import { SourceList } from "./SourceList";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  timestamp?: string;
}

export function MessageItem({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  return (
    <div className={`msg ${isUser ? "msg-user" : "msg-assistant"}`}>
      <span className="msg-meta">
        {isUser ? "You" : "Minimi"}
        {message.timestamp ? ` · ${message.timestamp}` : ""}
      </span>
      <div className="msg-bubble">{message.content}</div>
      <SourceList sources={sources} />
    </div>
  );
}
