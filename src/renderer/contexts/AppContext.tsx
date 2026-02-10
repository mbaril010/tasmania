import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppSettings,
  BackendInfo,
  BackendType,
  DownloadProgress,
  LocalModel,
  ServerState,
} from '../../shared/types';

interface AppContextValue {
  // Backend state
  backends: Record<BackendType, BackendInfo> | null;
  serverState: ServerState;
  serverLogs: string[];
  detectBackends: () => Promise<void>;
  startServer: (backend: BackendType, modelPath: string) => Promise<void>;
  stopServer: () => Promise<void>;

  // Model state
  models: LocalModel[];
  downloads: DownloadProgress[];
  refreshModels: () => Promise<void>;
  deleteModel: (path: string) => Promise<void>;

  // Settings
  settings: AppSettings | null;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  // System
  systemInfo: { platform: string; arch: string; memory: number } | null;
}

const defaultServerState: ServerState = {
  status: 'stopped',
  backend: null,
  port: 0,
  modelPath: null,
  modelName: null,
  pid: null,
  error: null,
  startedAt: null,
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backends, setBackends] = useState<Record<BackendType, BackendInfo> | null>(null);
  const [serverState, setServerState] = useState<ServerState>(defaultServerState);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [systemInfo, setSystemInfo] = useState<{ platform: string; arch: string; memory: number } | null>(null);

  // Track cleanup functions
  const cleanupRef = useRef<Array<() => void>>([]);

  // Initialize on mount
  useEffect(() => {
    const api = window.tasmania;

    // Load initial data
    api.detectBackends().then(setBackends);
    api.getServerStatus().then(setServerState);
    api.listLocalModels().then(setModels);
    api.getSettings().then(setSettingsState);
    api.getSystemInfo().then(setSystemInfo);
    api.getServerLogs().then(setServerLogs);

    // Subscribe to events
    const unsub1 = api.onServerStatusChanged((state) => {
      setServerState(state);
    });

    const unsub2 = api.onServerLogLine((line) => {
      setServerLogs((prev) => [...prev.slice(-499), line]);
    });

    const unsub3 = api.onDownloadProgress((progress) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((d) => d.id === progress.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = progress;
          return updated;
        }
        return [...prev, progress];
      });

      // Refresh models list when download completes
      if (progress.status === 'completed') {
        api.listLocalModels().then(setModels);
      }
    });

    cleanupRef.current = [unsub1, unsub2, unsub3];

    return () => {
      cleanupRef.current.forEach((fn) => fn());
    };
  }, []);

  const detectBackends = useCallback(async () => {
    const result = await window.tasmania.detectBackends();
    setBackends(result);
  }, []);

  const startServer = useCallback(async (backend: BackendType, modelPath: string) => {
    setServerState((prev) => ({ ...prev, status: 'starting', backend }));
    try {
      await window.tasmania.startServer(backend, modelPath);
      const state = await window.tasmania.getServerStatus();
      setServerState(state);
    } catch (err) {
      setServerState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
      throw err;
    }
  }, []);

  const stopServer = useCallback(async () => {
    await window.tasmania.stopServer();
    const state = await window.tasmania.getServerStatus();
    setServerState(state);
  }, []);

  const refreshModels = useCallback(async () => {
    const list = await window.tasmania.listLocalModels();
    setModels(list);
  }, []);

  const deleteModel = useCallback(async (modelPath: string) => {
    await window.tasmania.deleteModel(modelPath);
    await refreshModels();
  }, [refreshModels]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    await window.tasmania.setSettings(partial);
    const updated = await window.tasmania.getSettings();
    setSettingsState(updated);
  }, []);

  return (
    <AppContext.Provider
      value={{
        backends,
        serverState,
        serverLogs,
        detectBackends,
        startServer,
        stopServer,
        models,
        downloads,
        refreshModels,
        deleteModel,
        settings,
        updateSettings,
        systemInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
