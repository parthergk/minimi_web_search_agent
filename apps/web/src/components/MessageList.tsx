"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "../lib/api";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
}

export function MessageList({ messages, loading, sending }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div className="messages-scroll">
      {loading ? (
        <div className="empty-state">
          <p>Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <h2>Ask Minimi</h2>
          <p>Conversational AI with web search and cross-session memory.</p>
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
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

