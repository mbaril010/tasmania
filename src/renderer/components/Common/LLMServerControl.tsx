import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import type { ExoModel, MemoryPreflightResult } from '../../../shared/types';
import Button from './Button';
import StatusIndicator from './StatusIndicator';

type BackendChoice = 'llama.cpp' | 'exo';

interface LLMServerControlProps {
  onServerStopped?: () => void;
}

const LLMServerControl: React.FC<LLMServerControlProps> = ({ onServerStopped }) => {
  const { serverState, models, startServer, stopServer, exoServerState } = useApp();
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [memoryWarning, setMemoryWarning] = useState<MemoryPreflightResult | null>(null);
  const [backendChoice, setBackendChoice] = useState<BackendChoice>('llama.cpp');
  const [exoModels, setExoModels] = useState<ExoModel[]>([]);

  const isExoConnected = exoServerState.backend === 'exo';

  // Fetch Exo models when switching to Exo backend
  useEffect(() => {
    if (backendChoice === 'exo' && isExoConnected) {
      window.tasmania.exo.listModels().then(setExoModels).catch(() => setExoModels([]));
    }
  }, [backendChoice, isExoConnected]);

  const llmModels = models.filter((m) => m.category === 'chat');
  const isStopped = serverState.status === 'stopped';
  const isRunningOrStarting = serverState.status === 'running' || serverState.status === 'starting';
  const isError = serverState.status === 'error';

  const doStart = async () => {
    setLoading(true);
    setError(null);
    try {
      await startServer(backendChoice, selectedModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  const handleStart = async () => {
    if (!selectedModel) return;
    setError(null);

    // Skip preflight for Exo (it manages its own resources)
    if (backendChoice === 'llama.cpp') {
      try {
        const preflight = await window.tasmania.preflightCheck(selectedModel);
        if (!preflight.ok) {
          setMemoryWarning(preflight);
          return;
        }
      } catch {
        // If preflight fails (e.g. file not found), fall through to normal start
      }
    }
    await doStart();
  };

  const handleForceStart = async () => {
    setMemoryWarning(null);
    await doStart();
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
          flexShrink: 0,
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
          <>
            {/* Backend toggle — only show when Exo is connected */}
            {isExoConnected && (
              <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
                {(['llama.cpp', 'exo'] as const).map((b, i, arr) => (
                  <button
                    key={b}
                    onClick={() => { setBackendChoice(b); setSelectedModel(''); }}
                    style={{
                      padding: '5px 14px',
                      fontSize: '0.78rem',
                      fontWeight: backendChoice === b ? 600 : 400,
                      background: backendChoice === b ? '#252525' : 'transparent',
                      color: backendChoice === b ? '#e0e0e0' : '#666',
                      border: '1px solid #333',
                      borderRadius: i === 0 ? '6px 0 0 6px' : i === arr.length - 1 ? '0 6px 6px 0' : '0',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {backendChoice === 'llama.cpp' ? (
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
              ) : (
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
                  <option value="">-- Select Exo Model --</option>
                  {exoModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                    </option>
                  ))}
                </select>
              )}
              <Button onClick={handleStart} disabled={!selectedModel || loading}>
                {loading ? 'Starting...' : 'Start'}
              </Button>
            </div>
          </>
        )}

        {(isRunningOrStarting || isError) && (
          <Button variant="danger" onClick={handleStop} disabled={loading}>
            {loading ? 'Stopping...' : 'Stop Server'}
          </Button>
        )}

        {llmModels.length === 0 && isStopped && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 8 }}>
            No LLM models found. Download a GGUF model from the Models tab.
          </div>
        )}

        {(error || serverState.error) && (
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
            {error || serverState.error}
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

      {/* Memory warning dialog */}
      {memoryWarning && (
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
          onClick={() => setMemoryWarning(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1e1e1e',
              border: '1px solid #333',
              borderRadius: 12,
              padding: '24px 28px',
              maxWidth: 440,
              width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 600, color: '#f59e0b' }}>
              Memory Warning
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: '#999', lineHeight: 1.5 }}>
              {memoryWarning.message}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setMemoryWarning(null)}
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
                onClick={handleForceStart}
                style={{
                  padding: '8px 16px',
                  background: '#b45309',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Start Anyway
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
