"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../context/UserContext";
import {
  createConversation,
  getConversationMessages,
  listConversations,
  sendChatMessage,
  type ChatMessage,
  type Conversation,
} from "../../lib/api";
import { Sidebar } from "../../components/Sidebar";
import { MessageList } from "../../components/MessageList";
import { Composer } from "../../components/Composer";

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: userLoading, clearUser } = useUser();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoading && !user) {
      router.replace("/register");
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user) return;
    listConversations(user.id)
      .then((rows) => {
        setConversations(rows);
        if (rows.length > 0 && !activeId) {
          setActiveId(rows[0]!.id);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load chats");
      });
  }, [user]);

  useEffect(() => {
    if (!user || !activeId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    setError(null);
    getConversationMessages(activeId, user.id)
      .then((rows) => setMessages(rows))
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Failed to load messages"
        );
      })
      .finally(() => setLoadingMessages(false));
  }, [activeId, user]);

  async function handleNewChat() {
    if (!user) return;
    setError(null);
    try {
      const created = await createConversation(user.id, "New chat");
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      setMessages([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create conversation"
      );
    }
  }

  function handleSwitchUser() {
    clearUser();
    router.replace("/register");
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !user || sending) return;

    setSending(true);
    setError(null);

    try {
      let targetConversationId = activeId;
      if (!targetConversationId) {
        const title =
          trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
        const created = await createConversation(user.id, title);
        setConversations((prev) => [created, ...prev]);
        setActiveId(created.id);
        targetConversationId = created.id;
      }

      const optimisticUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        conversationId: targetConversationId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUserMsg]);
      setInput("");

      const res = await sendChatMessage(
        targetConversationId,
        user.id,
        trimmed
      );

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUserMsg.id),
        res.userMessage,
        res.assistantMessage,
      ]);

      const updatedConvs = await listConversations(user.id);
      setConversations(updatedConvs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  }

  if (userLoading || !user) {
    return null;
  }

  return (
    <div className="shell">
      <Sidebar
        user={user}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => setActiveId(id)}
        onNewChat={handleNewChat}
        onSwitchUser={handleSwitchUser}
      />

      <main className="main">
        <MessageList
          messages={messages}
          loading={loadingMessages}
          sending={sending}
        />
        <Composer
          input={input}
          sending={sending}
          error={error}
          onChange={setInput}
          onSend={handleSend}
        />
      </main>
    </div>
  );
}

