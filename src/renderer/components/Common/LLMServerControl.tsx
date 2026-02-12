import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import Button from './Button';
import StatusIndicator from './StatusIndicator';

const IMAGE_MODEL_PATTERN = /(?:^|[_\-.\s])(sd|sdxl|flux|diffusion|stable.?diffusion|turbo|lora|z[_\-.]?image)(?=[_\-.\s]|$)/i;

interface LLMServerControlProps {
  onServerStopped?: () => void;
}

const LLMServerControl: React.FC<LLMServerControlProps> = ({ onServerStopped }) => {
  const { serverState, models, startServer, stopServer } = useApp();
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const llmModels = models.filter((m) => !IMAGE_MODEL_PATTERN.test(m.filename));
  const isStopped = serverState.status === 'stopped';
  const isRunningOrStarting = serverState.status === 'running' || serverState.status === 'starting';

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

  const handleStop = () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    setLoading(true);
    setError(null);
    try {
      await stopServer();
      onServerStopped?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  return (
    <>
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 10,
          border: '1px solid #2a2a2a',
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <StatusIndicator status={serverState.status} />
          {serverState.status === 'running' && serverState.modelName && (
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              Model: <strong style={{ color: '#ccc' }}>{serverState.modelName}</strong>
            </span>
          )}
        </div>

        {isStopped && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#252525',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#e0e0e0',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
              }}
            >
              <option value="">-- Select LLM Model --</option>
              {llmModels.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.filename} ({formatBytes(m.sizeBytes)})
                </option>
              ))}
            </select>
            <Button onClick={handleStart} disabled={!selectedModel || loading}>
              {loading ? 'Starting...' : 'Start'}
            </Button>
          </div>
        )}

        {isRunningOrStarting && (
          <Button variant="danger" onClick={handleStop} disabled={loading}>
            {loading ? 'Stopping...' : 'Stop Server'}
          </Button>
        )}

        {llmModels.length === 0 && isStopped && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 8 }}>
            No LLM models found. Download a GGUF model from the Models tab.
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
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

      {/* Stop Server confirmation dialog */}
      {showStopConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowStopConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 400,
              width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600, color: '#e0e0e0' }}>
              Stop Server?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#999', lineHeight: 1.5 }}>
              All active chat and terminal sessions will be ended. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowStopConfirm(false)}
                style={{
                  padding: '8px 16px',
                  background: '#333',
                  border: 'none',
                  borderRadius: 8,
                  color: '#ccc',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmStop}
                style={{
                  padding: '8px 16px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Stop Server
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default LLMServerControl;
