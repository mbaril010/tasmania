import React, { createContext, useContext, useState, useCallback } from 'react';
import type { TerminalSession } from '../../shared/types';

interface TerminalSessionContextValue {
  sessions: TerminalSession[];
  activeSessionId: string;
  activeSession: TerminalSession;
  createSession: () => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
}

function makeSession(): TerminalSession {
  return {
    id: crypto.randomUUID(),
    title: 'New Terminal',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const TerminalSessionContext = createContext<TerminalSessionContextValue | null>(null);

export const TerminalSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [makeSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0].id);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  const createSession = useCallback(() => {
    const session = makeSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    return session.id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    // Kill the PTY for this session
    window.tasmania.terminal.kill(id);

    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = makeSession();
        setActiveSessionId(fresh.id);
        return [fresh];
      }
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

  return (
    <TerminalSessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        activeSession,
        createSession,
        switchSession,
        deleteSession,
        renameSession,
      }}
    >
      {children}
    </TerminalSessionContext.Provider>
  );
};

export function useTerminalSessions(): TerminalSessionContextValue {
  const ctx = useContext(TerminalSessionContext);
  if (!ctx) throw new Error('useTerminalSessions must be used within TerminalSessionProvider');
  return ctx;
}
