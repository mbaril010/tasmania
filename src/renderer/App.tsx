import React, { Component, useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import { ChatSessionProvider } from './contexts/ChatSessionContext';
import { TerminalSessionProvider } from './contexts/TerminalSessionContext';
import Sidebar from './components/Layout/Sidebar';
import HomeScreen from './screens/HomeScreen';
import ModelsScreen from './screens/ModelsScreen';
import BackendsScreen from './screens/BackendsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ApiScreen from './screens/ApiScreen';
import type { TasmaniaAPI } from '../main/preload';

// Global type declaration for the preload bridge
declare global {
  interface Window {
    tasmania: TasmaniaAPI;
  }
}

// ── Error Boundary ──

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled renderer error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', color: '#e0e0e0', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>Something went wrong</h2>
          <p style={{ color: '#999', marginBottom: '1.5rem' }}>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              background: '#fbbf24',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Screens that are stateless and can remount freely
const screens: Record<string, React.FC> = {
  models: ModelsScreen,
  backends: BackendsScreen,
  api: ApiScreen,
  settings: SettingsScreen,
};

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState('home');
  const Screen = activeScreen !== 'home' ? screens[activeScreen] : null;

  return (
    <ErrorBoundary>
      <AppProvider>
        <ChatSessionProvider>
          <TerminalSessionProvider>
            <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
              <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
              <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Drag region for window movement */}
                <div style={{ height: 52, flexShrink: 0, WebkitAppRegion: 'drag' } as React.CSSProperties} />
                {/* HomeScreen always rendered, hidden when inactive to preserve state */}
                <div style={{ flex: 1, overflow: 'hidden', display: activeScreen === 'home' ? 'block' : 'none' }}>
                  <HomeScreen />
                </div>
                {Screen && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Screen />
                  </div>
                )}
              </main>
            </div>
          </TerminalSessionProvider>
        </ChatSessionProvider>
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
