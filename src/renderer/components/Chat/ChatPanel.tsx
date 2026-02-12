import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useChatSessions } from '../../contexts/ChatSessionContext';
import Button from '../Common/Button';
import type { ChatMessage } from '../../../shared/types';

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: 12,
        background: isUser ? '#6366f1' : '#252525',
        color: isUser ? '#fff' : '#e0e0e0',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {message.content}
    </div>
  );
};

const ThinkingIndicator: React.FC = () => (
  <div
    style={{
      alignSelf: 'flex-start',
      padding: '10px 14px',
      borderRadius: 12,
      background: '#252525',
      color: '#666',
      fontSize: '0.85rem',
    }}
  >
    Thinking...
  </div>
);

const SYSTEM_PROMPTS: Record<string, string> = {
  code: 'You are a helpful coding assistant. You help write, debug, explain, and refactor code. Always provide code examples when relevant. Use markdown code blocks with language identifiers for code snippets.',
};

interface ChatPanelProps {
  mode?: 'chat' | 'code';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ mode = 'chat' }) => {
  const { serverState } = useApp();
  const { activeSession, addMessage } = useChatSessions();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = activeSession.messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    addMessage(userMessage);
    const newMessages = [...messages, userMessage];
    setInput('');
    setError(null);
    setIsLoading(true);

    // Build the request messages, prepending system prompt for code mode
    const requestMessages: Array<{ role: string; content: string }> = [];
    if (mode === 'code' && SYSTEM_PROMPTS.code) {
      requestMessages.push({ role: 'system', content: SYSTEM_PROMPTS.code });
    }
    requestMessages.push(...newMessages);

    try {
      const response = await fetch(
        `http://localhost:${serverState.port}/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'local',
            messages: requestMessages,
            max_tokens: mode === 'code' ? 1024 : 500,
            temperature: mode === 'code' ? 0.3 : 0.7,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const assistantContent = data.choices?.[0]?.message?.content;

      if (!assistantContent) {
        throw new Error('No response content received from model');
      }

      addMessage({ role: 'assistant', content: assistantContent });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isRunning = serverState.status === 'running';
  const placeholder = mode === 'code' ? 'Ask a coding question...' : 'Type a message...';
  const emptyText = mode === 'code'
    ? 'Ask a coding question to get started.'
    : 'Send a message to start chatting.';

  if (!isRunning) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        <p style={{ fontSize: '0.9rem' }}>
          Start the server above to {mode === 'code' ? 'use the code assistant' : 'chat with your model'}.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666', fontSize: '0.85rem' }}>
            {emptyText}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: '#252525',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#3b1a1a',
            borderRadius: 6,
            color: '#f87171',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
