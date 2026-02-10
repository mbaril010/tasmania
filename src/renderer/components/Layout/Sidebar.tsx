import React from 'react';
import { useApp } from '../../contexts/AppContext';
import StatusIndicator from '../Common/StatusIndicator';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Dashboard', icon: '⌂' },
  { id: 'models', label: 'Models', icon: '◎' },
  { id: 'backends', label: 'Backends', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

interface Props {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const Sidebar: React.FC<Props> = ({ activeScreen, onNavigate }) => {
  const { serverState } = useApp();

  return (
    <nav
      style={{
        width: 220,
        background: '#141414',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 52, // space for traffic lights
        flexShrink: 0,
      }}
    >
      {/* App title */}
      <div style={{ padding: '0 20px 20px', WebkitAppRegion: 'drag' as unknown as string }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e0e0e0' }}>
          Tasmania
        </h1>
      </div>

      {/* Navigation items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
        {navItems.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? '#252525' : 'transparent',
                color: isActive ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s ease',
                textAlign: 'left',
                WebkitAppRegion: 'no-drag' as unknown as string,
              }}
            >
              <span style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Server status footer */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid #222',
          WebkitAppRegion: 'no-drag' as unknown as string,
        }}
      >
        <StatusIndicator
          status={serverState.status}
          label={
            serverState.status === 'running'
              ? `Port ${serverState.port}`
              : serverState.status === 'error'
              ? 'Error'
              : 'Server off'
          }
        />
        {serverState.modelName && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#555',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {serverState.modelName}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Sidebar;
