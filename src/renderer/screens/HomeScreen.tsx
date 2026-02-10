import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import StatusIndicator from '../components/Common/StatusIndicator';

const HomeScreen: React.FC = () => {
  const { backends, serverState, models, startServer, stopServer, settings } = useApp();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const info = backends?.['llama.cpp'];

  return (
    <div style={{ padding: '2rem', maxWidth: 900, overflow: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h2>

      {/* Backend Status */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>llama.cpp</span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: 4,
              background: info?.installed ? '#16532e' : '#3b1a1a',
              color: info?.installed ? '#4ade80' : '#f87171',
            }}
          >
            {info?.installed ? 'Built-in' : 'Missing'}
          </span>
        </div>
        {info?.installed && info.version && (
          <div style={{ fontSize: '0.8rem', color: '#666' }}>{info.version}</div>
        )}
      </Card>

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

      {/* Quick Info */}
      <Card title="Connect to Claude Code">
        <div style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 8 }}>
            Once the server is running, you can use it as an OpenAI-compatible API provider:
          </p>
          <code
            style={{
              display: 'block',
              background: '#252525',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#e0e0e0',
              fontFamily: 'monospace',
              marginBottom: 8,
            }}
          >
            http://localhost:{serverState.port || settings?.llamaCpp.port || 8080}/v1
          </code>
          <p>
            Or use the MCP server integration from the Settings tab for direct Claude Code connectivity.
          </p>
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
