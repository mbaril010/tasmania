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
  { id: 'api', label: 'API', icon: '⬡' },
];

interface Props {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const Sidebar: React.FC<Props> = ({ activeScreen, onNavigate }) => {
  const { serverState, imageServerState, videoServerState, exoServerState } = useApp();

  return (
    <nav
      style={{
        width: 220,
        background: '#141414',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Drag region above traffic lights */}
      <div style={{ height: 52, flexShrink: 0, WebkitAppRegion: 'drag' } as React.CSSProperties} />
      {/* App title */}
      <div style={{ padding: '0 20px 20px' }}>
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
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties}
            >
              <span style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Settings — pinned above server status */}
      <div style={{ padding: '0 8px 4px' }}>
        <button
          onClick={() => onNavigate('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            width: '100%',
            background: activeScreen === 'settings' ? '#252525' : 'transparent',
            color: activeScreen === 'settings' ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            fontWeight: activeScreen === 'settings' ? 600 : 400,
            transition: 'all 0.15s ease',
            textAlign: 'left',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <span style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}>⚙</span>
          Settings
        </button>
      </div>

      {/* Server status footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #222',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {/* LLM server */}
        <div>
          <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            LLM
          </div>
          <StatusIndicator
            status={serverState.status}
            label={
              serverState.status === 'running'
                ? `Port ${serverState.port}`
                : serverState.status === 'error'
                ? 'Error'
                : 'Off'
            }
          />
          {serverState.modelName && (
            <div style={{ fontSize: '0.7rem', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {serverState.modelName}
            </div>
          )}
        </div>

        {/* Image server */}
        <div>
          <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Image
          </div>
          <StatusIndicator
            status={imageServerState.status}
            label={
              imageServerState.status === 'running'
                ? `Port ${imageServerState.port}`
                : imageServerState.status === 'error'
                ? 'Error'
                : 'Off'
            }
          />
          {imageServerState.modelName && (
            <div style={{ fontSize: '0.7rem', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {imageServerState.modelName}
            </div>
          )}
        </div>

        {/* Video (ComfyUI) server */}
        <div>
          <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Video
          </div>
          <StatusIndicator
            status={videoServerState.status}
            label={
              videoServerState.status === 'running'
                ? `Port ${videoServerState.port}`
                : videoServerState.status === 'error'
                ? 'Error'
                : 'Off'
            }
          />
        </div>

        {/* Exo cluster */}
        <div>
          <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Exo
          </div>
          <StatusIndicator
            status={exoServerState.backend === 'exo' ? 'running' : 'stopped'}
            label={
              exoServerState.backend === 'exo'
                ? `Port ${exoServerState.port}`
                : 'Off'
            }
          />
          {exoServerState.modelName && (
            <div style={{ fontSize: '0.7rem', color: '#555', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {exoServerState.modelName}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;
