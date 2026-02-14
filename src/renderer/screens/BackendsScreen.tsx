import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import StatusIndicator from '../components/Common/StatusIndicator';

type LogTab = 'llama.cpp' | 'stable-diffusion';

function formatUptime(startedAt: number | null): string {
  if (!startedAt) return '';
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const paramLabelStyle: React.CSSProperties = {
  color: '#777',
  fontSize: '0.78rem',
};

const paramValueStyle: React.CSSProperties = {
  color: '#ccc',
  fontSize: '0.78rem',
  fontWeight: 500,
};

const BackendsScreen: React.FC = () => {
  const { backends, serverState, serverLogs, imageServerState, imageServerLogs, detectBackends } = useApp();
  const [logTab, setLogTab] = useState<LogTab>('llama.cpp');
  const [, setTick] = useState(0);

  useEffect(() => {
    detectBackends();
  }, [detectBackends]);

  // Tick every 10s to update uptime display
  const anyRunning = serverState.status === 'running' || imageServerState.status === 'running';
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const llamaInfo = backends?.['llama.cpp'];
  const sdInfo = backends?.['stable-diffusion'];

  const isLlamaActive = serverState.status !== 'stopped';
  const isImageActive = imageServerState.status !== 'stopped';

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Backends</h2>
        <Button variant="secondary" size="sm" onClick={() => detectBackends()}>
          Re-detect
        </Button>
      </div>

      {/* llama.cpp */}
      <Card
        style={{
          borderColor: isLlamaActive ? '#fbbf24' : '#2a2a2a',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>llama.cpp</span>
              {isLlamaActive && <StatusIndicator status={serverState.status} />}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>
              High-performance C/C++ LLM inference engine
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '3px 10px',
              borderRadius: 6,
              background: llamaInfo?.installed ? '#16532e' : '#3b1a1a',
              color: llamaInfo?.installed ? '#4ade80' : '#f87171',
              fontWeight: 500,
            }}
          >
            {llamaInfo?.installed ? 'Built-in' : 'Missing'}
          </span>
        </div>

        {llamaInfo?.version && (
          <div style={{ fontSize: '0.8rem', color: '#555' }}>
            Version: {llamaInfo.version}
          </div>
        )}

        {serverState.status === 'running' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10, padding: '8px 10px', background: '#1a1a1a', borderRadius: 6 }}>
            {serverState.modelName && (
              <div><span style={paramLabelStyle}>Model: </span><span style={paramValueStyle}>{serverState.modelName}</span></div>
            )}
            {serverState.contextSize != null && (
              <div><span style={paramLabelStyle}>Context: </span><span style={paramValueStyle}>{serverState.contextSize.toLocaleString()}</span></div>
            )}
            {serverState.gpuLayers != null && (
              <div><span style={paramLabelStyle}>GPU Layers: </span><span style={paramValueStyle}>{serverState.gpuLayers}</span></div>
            )}
            <div><span style={paramLabelStyle}>Port: </span><span style={paramValueStyle}>{serverState.port}</span></div>
            {serverState.startedAt && (
              <div><span style={paramLabelStyle}>Uptime: </span><span style={paramValueStyle}>{formatUptime(serverState.startedAt)}</span></div>
            )}
          </div>
        )}
      </Card>

      {/* stable-diffusion */}
      <Card
        style={{
          borderColor: isImageActive ? '#fbbf24' : '#2a2a2a',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>stable-diffusion</span>
              {isImageActive && <StatusIndicator status={imageServerState.status} />}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>
              Image generation engine (sd.cpp)
            </div>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '3px 10px',
              borderRadius: 6,
              background: sdInfo?.installed ? '#16532e' : '#3b1a1a',
              color: sdInfo?.installed ? '#4ade80' : '#f87171',
              fontWeight: 500,
            }}
          >
            {sdInfo?.installed ? 'Built-in' : 'Missing'}
          </span>
        </div>

        {sdInfo?.version && (
          <div style={{ fontSize: '0.8rem', color: '#555' }}>
            Version: {sdInfo.version}
          </div>
        )}

        {imageServerState.status === 'running' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10, padding: '8px 10px', background: '#1a1a1a', borderRadius: 6 }}>
            {imageServerState.modelName && (
              <div><span style={paramLabelStyle}>Model: </span><span style={paramValueStyle}>{imageServerState.modelName}</span></div>
            )}
            <div><span style={paramLabelStyle}>Port: </span><span style={paramValueStyle}>{imageServerState.port}</span></div>
            {imageServerState.startedAt && (
              <div><span style={paramLabelStyle}>Uptime: </span><span style={paramValueStyle}>{formatUptime(imageServerState.startedAt)}</span></div>
            )}
          </div>
        )}
      </Card>

      {/* Server Logs */}
      <Card title="Server Logs">
        <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
          {(['llama.cpp', 'stable-diffusion'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setLogTab(tab)}
              style={{
                padding: '6px 16px',
                fontSize: '0.8rem',
                fontWeight: logTab === tab ? 600 : 400,
                background: logTab === tab ? '#252525' : 'transparent',
                color: logTab === tab ? '#e0e0e0' : '#666',
                border: '1px solid #333',
                borderBottom: logTab === tab ? '1px solid #252525' : '1px solid #333',
                borderRadius: tab === 'llama.cpp' ? '6px 0 0 0' : '0 6px 0 0',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <LogViewer logs={logTab === 'llama.cpp' ? serverLogs : imageServerLogs} />
      </Card>
    </div>
  );
};

// ── Log Viewer ──

const LogViewer: React.FC<{ logs: string[] }> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 30);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: 300,
        overflow: 'auto',
        background: '#0f0f0f',
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        lineHeight: 1.5,
        color: '#888',
      }}
    >
      {logs.length === 0 ? (
        <div style={{ color: '#444' }}>No logs yet. Start a server to see output here.</div>
      ) : (
        logs.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line}
          </div>
        ))
      )}
    </div>
  );
};

export default BackendsScreen;
