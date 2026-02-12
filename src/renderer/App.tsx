import React, { useState } from 'react';
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
    <AppProvider>
      <ChatSessionProvider>
        <TerminalSessionProvider>
          <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
            <main style={{ flex: 1, overflow: 'hidden' }}>
              {/* HomeScreen always rendered, hidden when inactive to preserve state */}
              <div style={{ height: '100%', display: activeScreen === 'home' ? 'block' : 'none' }}>
                <HomeScreen />
              </div>
              {Screen && <Screen />}
            </main>
          </div>
        </TerminalSessionProvider>
      </ChatSessionProvider>
    </AppProvider>
  );
};

export default App;
