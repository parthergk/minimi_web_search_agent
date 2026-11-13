"use client";

import type { KeyboardEvent, FormEvent } from "react";

interface ComposerProps {
  input: string;
  sending: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function Composer({
  input,
  sending,
  error,
  onChange,
  onSend,
}: ComposerProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSend();
  }

  return (
    <div className="composer-wrap">
      {error && <div className="error-banner">{error}</div>}
      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          rows={1}
          className="chat-textarea"
          placeholder="Ask anything..."
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !input.trim()}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

