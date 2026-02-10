import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import StatusIndicator from '../components/Common/StatusIndicator';

const BackendsScreen: React.FC = () => {
  const { backends, serverState, serverLogs, detectBackends } = useApp();

  useEffect(() => {
    detectBackends();
  }, [detectBackends]);

  const info = backends?.['llama.cpp'];

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Backend</h2>
        <Button variant="secondary" size="sm" onClick={() => detectBackends()}>
          Re-detect
        </Button>
      </div>

      {/* llama.cpp — single built-in backend */}
      <Card
        style={{
          borderColor: serverState.backend === 'llama.cpp' ? '#6366f1' : '#2a2a2a',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>llama.cpp</span>
              {serverState.backend === 'llama.cpp' && (
                <StatusIndicator status={serverState.status} />
              )}
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
              background: info?.installed ? '#16532e' : '#3b1a1a',
              color: info?.installed ? '#4ade80' : '#f87171',
              fontWeight: 500,
            }}
          >
            {info?.installed ? 'Built-in' : 'Missing'}
          </span>
        </div>

        {info?.version && (
          <div style={{ fontSize: '0.8rem', color: '#555' }}>
            Version: {info.version}
          </div>
        )}
      </Card>

      {/* Server Logs */}
      <Card title="Server Logs">
        <LogViewer logs={serverLogs} />
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
