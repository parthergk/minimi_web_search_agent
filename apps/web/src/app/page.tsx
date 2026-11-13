"use client";

import { useState } from "react";
import { MessageList } from "../components/MessageList";
import { Composer } from "../components/Composer";
import type { DisplayMessage } from "../components/MessageItem";
import { sendChatMessage } from "../lib/api";

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomePage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: formatTime(),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    const historyForAgent = messages.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await sendChatMessage(trimmed, historyForAgent);

      const assistantMessage: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        sources: res.sources,
        timestamp: formatTime(),
      };

      setMessages([...nextMessages, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleClearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Minimi</span>
        {messages.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={handleClearChat}
            disabled={sending}
          >
            Clear chat
          </button>
        )}
      </header>

      <main className="main">
        <MessageList messages={messages} sending={sending} />
        <Composer
          input={input}
          sending={sending}
          error={error}
          onChange={setInput}
          onSend={() => void handleSend()}
        />
      </main>
    </div>
  );
}
