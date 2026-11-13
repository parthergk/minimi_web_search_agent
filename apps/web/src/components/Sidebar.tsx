"use client";

import type { Conversation, User } from "../lib/api";

interface SidebarProps {
  user: User;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSwitchUser: () => void;
}

export function Sidebar({
  user,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onSwitchUser,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="brand">Minimi</span>
        <button type="button" className="btn" onClick={onNewChat}>
          + New
        </button>
      </div>

      <div className="conv-list">
        {conversations.length === 0 ? (
          <div className="sidebar-empty">No conversations yet.</div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className={`conv-item ${conv.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(conv.id)}
            >
              {conv.title || "Untitled chat"}
            </button>
          ))
        )}
      </div>

      <div className="sidebar-foot">
        <span className="user-email" title={user.email}>
          {user.email}
        </span>
        <button type="button" className="btn" onClick={onSwitchUser}>
          Switch
        </button>
      </div>
    </aside>
  );
}

