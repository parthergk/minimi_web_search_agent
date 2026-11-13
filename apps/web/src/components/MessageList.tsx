"use client";

import { useEffect, useRef } from "react";
import { MessageItem, type DisplayMessage } from "./MessageItem";

interface MessageListProps {
  messages: DisplayMessage[];
  sending: boolean;
}

export function MessageList({ messages, sending }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div className="messages-scroll">
      {messages.length === 0 ? (
        <div className="empty-state">
          <h2>Minimi</h2>
          <p>Conversational AI with real-time web search.</p>
        </div>
      ) : (
        <div className="messages-inner">
          {messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
          {sending && (
            <div className="msg msg-assistant">
              <span className="msg-meta">Minimi</span>
              <div className="msg-bubble" style={{ color: "var(--muted)" }}>
                Searching and thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
