import React, { useState, useRef, useEffect } from 'react';
import { useChatSessions } from '../../contexts/ChatSessionContext';

const SessionSidebar: React.FC = () => {
  const { sessions, activeSessionId, createSession, switchSession, deleteSession, renameSession } =
    useChatSessions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEditing = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const commitEdit = () => {
    if (editingId) {
      renameSession(editingId, editValue);
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div
      style={{
        width: 200,
        minWidth: 200,
        display: 'flex',
        flexDirection: 'column',
        background: '#141414',
        borderRight: '1px solid #252525',
        borderRadius: '12px 0 0 12px',
      }}
    >
      {/* New Chat button */}
      <button
        onClick={createSession}
        style={{
          margin: 8,
          padding: '8px 12px',
          background: '#fbbf24',
          border: 'none',
          borderRadius: 8,
          color: '#1a1a1a',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        + New Chat
      </button>

      {/* Session list — fixed height for ~5 items, scrolls if more */}
      <div style={{ height: 180, overflowY: 'auto', padding: '0 4px' }}>
        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingId === session.id;
          return (
            <div
              key={session.id}
              onClick={() => switchSession(session.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '8px 8px',
                margin: '2px 0',
                borderRadius: 6,
                background: isActive ? '#252525' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    color: '#e0e0e0',
                    background: '#1a1a1a',
                    border: '1px solid #444',
                    borderRadius: 4,
                    padding: '1px 4px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    minWidth: 0,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEditing(session.id, session.title);
                  }}
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    color: isActive ? '#e0e0e0' : '#888',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.title}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(session.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#555',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '2px 4px',
                  borderRadius: 4,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SessionSidebar;
