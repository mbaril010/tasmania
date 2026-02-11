import React, { useState } from 'react';
import { AppProvider } from './contexts/AppContext';
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

const screens: Record<string, React.FC> = {
  home: HomeScreen,
  models: ModelsScreen,
  backends: BackendsScreen,
  api: ApiScreen,
  settings: SettingsScreen,
};

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState('home');
  const Screen = screens[activeScreen] ?? HomeScreen;

  return (
    <AppProvider>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
        <main style={{ flex: 1, overflow: 'hidden' }}>
          <Screen />
        </main>
      </div>
    </AppProvider>
  );
};

export default App;
