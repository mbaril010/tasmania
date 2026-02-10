import React from 'react';
import type { ServerStatus } from '../../../shared/types';

const statusColors: Record<ServerStatus, string> = {
  running: '#4ade80',
  stopped: '#666',
  starting: '#fbbf24',
  error: '#f87171',
};

const statusLabels: Record<ServerStatus, string> = {
  running: 'Running',
  stopped: 'Stopped',
  starting: 'Starting...',
  error: 'Error',
};

interface Props {
  status: ServerStatus;
  label?: string;
  size?: number;
}

const StatusIndicator: React.FC<Props> = ({ status, label, size = 8 }) => {
  const color = statusColors[status];
  const isAnimated = status === 'starting';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          animation: isAnimated ? 'pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
        {label ?? statusLabels[status]}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </span>
  );
};

export default StatusIndicator;
