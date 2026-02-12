import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import LLMServerControl from '../components/Common/LLMServerControl';
import ChatPanel from '../components/Chat/ChatPanel';
import SessionSidebar from '../components/Chat/SessionSidebar';
import TerminalPanel from '../components/Terminal/TerminalPanel';
import TerminalSessionSidebar from '../components/Terminal/TerminalSessionSidebar';
import ImagePanel from '../components/Image/ImagePanel';

type ChatTab = 'chat' | 'code' | 'image';

const HomeScreen: React.FC = () => {
  const { serverState } = useApp();
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');
  const [terminalCreated, setTerminalCreated] = useState(false);

  // Gate terminal creation: once created, keep it alive even if server stops
  useEffect(() => {
    if (serverState.status === 'running' && !terminalCreated) {
      setTerminalCreated(true);
    }
  }, [serverState.status, terminalCreated]);

  return (
    <div style={{ padding: '2rem', maxWidth: 900, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h2>

      {/* Chat / Code / Image tabs */}
      <Card style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 16,
            background: '#141414',
            borderRadius: 10,
            padding: 4,
            width: 'fit-content',
          }}
        >
          {([
            { id: 'chat' as ChatTab, label: '💬 Chat' },
            { id: 'code' as ChatTab, label: '🖥 Code' },
            { id: 'image' as ChatTab, label: '🎨 Image' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab.id ? '#333' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Image tab: always available — manages its own server */}
        <div style={{ display: activeTab === 'image' ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
          <ImagePanel />
        </div>

        {/* Chat tab: sidebar + chat panel (ChatPanel has its own LLMServerControl) */}
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1 }}>
          <SessionSidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: 12 }}>
            <ChatPanel mode="chat" />
          </div>
        </div>

        {/* Code tab: server control + terminal panel */}
        <div style={{ display: activeTab === 'code' ? 'flex' : 'none', flex: 1 }}>
          <TerminalSessionSidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: 12 }}>
            <LLMServerControl onServerStopped={() => setTerminalCreated(false)} />
            {terminalCreated ? (
              <TerminalPanel />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <p style={{ fontSize: '0.9rem' }}>
                  Start the server to use the terminal.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default HomeScreen;
