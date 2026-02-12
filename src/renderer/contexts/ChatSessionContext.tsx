import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ChatMessage, ChatSession } from '../../shared/types';

interface ChatSessionContextValue {
  sessions: ChatSession[];
  activeSessionId: string;
  activeSession: ChatSession;
  createSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessages: (messages: ChatMessage[]) => void;
}

function makeSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export const ChatSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [makeSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  const createSession = useCallback(() => {
    const session = makeSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = makeSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      // If we deleted the active session, switch to the first remaining
      setActiveSessionId((currentId) => {
        if (currentId === id) return next[0].id;
        return currentId;
      });
      return next;
    });
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed, updatedAt: Date.now() } : s))
    );
  }, []);

  const updateSession = useCallback((updater: (s: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
    );
  }, [activeSessionId]);

  const addMessage = useCallback((message: ChatMessage) => {
    updateSession((s) => {
      const messages = [...s.messages, message];
      const title = s.title === 'New Chat' && message.role === 'user'
        ? message.content.slice(0, 40).trim() || 'New Chat'
        : s.title;
      return { ...s, messages, title, updatedAt: Date.now() };
    });
  }, [updateSession]);

  const updateMessages = useCallback((messages: ChatMessage[]) => {
    updateSession((s) => ({ ...s, messages, updatedAt: Date.now() }));
  }, [updateSession]);

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        activeSession,
        createSession,
        switchSession,
        deleteSession,
        renameSession,
        addMessage,
        updateMessages,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
};

export function useChatSessions(): ChatSessionContextValue {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error('useChatSessions must be used within ChatSessionProvider');
  return ctx;
}
