import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import StatusIndicator from '../components/Common/StatusIndicator';
import ChatPanel from '../components/Chat/ChatPanel';
import SessionSidebar from '../components/Chat/SessionSidebar';
import TerminalPanel from '../components/Terminal/TerminalPanel';
import TerminalSessionSidebar from '../components/Terminal/TerminalSessionSidebar';

type ChatTab = 'chat' | 'code';

const HomeScreen: React.FC = () => {
  const { serverState, models, startServer, stopServer } = useApp();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>('chat');
  const [terminalCreated, setTerminalCreated] = useState(false);

  const handleStart = async () => {
    if (!selectedModel) return;
    setLoading(true);
    setError(null);
    try {
      await startServer('llama.cpp', selectedModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await stopServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  const copyEndpoint = () => {
    if (serverState.status === 'running') {
      const port = serverState.port;
      navigator.clipboard.writeText(`http://localhost:${port}/v1`);
    }
  };

  // Gate terminal creation: once created, keep it alive even if server stops
  useEffect(() => {
    if (serverState.status === 'running' && !terminalCreated) {
      setTerminalCreated(true);
    }
  }, [serverState.status, terminalCreated]);

  return (
    <div style={{ padding: '2rem', maxWidth: 900, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h2>

      {/* Server Control */}
      <Card title="Server Control" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <StatusIndicator status={serverState.status} />
          {serverState.status === 'running' && (
            <button
              onClick={copyEndpoint}
              style={{
                background: '#252525',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
              }}
              title="Click to copy"
            >
              http://localhost:{serverState.port}/v1
            </button>
          )}
        </div>

        {serverState.status === 'stopped' && (
          <>
            {/* Model selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: 6 }}>
                Select a model to load:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#252525',
                  border: '1px solid #333',
                  borderRadius: 8,
                  color: '#e0e0e0',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">-- Select Model --</option>
                {models.map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.filename} ({formatBytes(m.sizeBytes)})
                  </option>
                ))}
              </select>
              {models.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 6 }}>
                  No models downloaded yet. Go to the Models tab to download one.
                </div>
              )}
            </div>
            <Button onClick={handleStart} disabled={!selectedModel || loading}>
              {loading ? 'Starting...' : 'Start Server'}
            </Button>
          </>
        )}

        {(serverState.status === 'running' || serverState.status === 'starting') && (
          <div>
            {serverState.modelName && (
              <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: 12 }}>
                Model: <strong>{serverState.modelName}</strong>
              </div>
            )}
            <Button variant="danger" onClick={handleStop} disabled={loading}>
              {loading ? 'Stopping...' : 'Stop Server'}
            </Button>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#3b1a1a', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </Card>

      {/* Chat / Code tabs */}
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

        {/* Chat tab: sidebar + chat panel, always rendered, toggled via display */}
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1 }}>
          <SessionSidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: 12 }}>
            <ChatPanel mode="chat" />
          </div>
        </div>

        {/* Code tab: sidebar + terminal panel, always rendered once created, toggled via display */}
        <div style={{ display: activeTab === 'code' ? 'flex' : 'none', flex: 1 }}>
          {terminalCreated
            ? (
              <>
                <TerminalSessionSidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: 12 }}>
                  <TerminalPanel />
                </div>
              </>
            )
            : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666', width: '100%' }}>
                <p style={{ fontSize: '0.9rem' }}>
                  Start the server above to use Claude Code.
                </p>
              </div>
            )
          }
        </div>
      </Card>
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default HomeScreen;
