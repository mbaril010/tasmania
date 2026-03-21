import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppSettings,
  BackendInfo,
  BackendType,
  ComfyUIInstallInfo,
  ComfyUIInstallProgress,
  DownloadProgress,
  ExoClusterState,
  LocalModel,
  ServerState,
  UpdateCheckResult,
  UpdateInfo,
} from '../../shared/types';

interface AppContextValue {
  // Backend state
  backends: Record<BackendType, BackendInfo> | null;
  serverState: ServerState;
  serverLogs: string[];
  detectBackends: () => Promise<void>;
  startServer: (backend: BackendType, modelPath: string) => Promise<void>;
  stopServer: () => Promise<void>;

  // Image backend state
  imageServerState: ServerState;
  imageServerLogs: string[];

  // Video backend state (ComfyUI)
  videoServerState: ServerState;
  videoServerLogs: string[];

  // Exo cluster state
  exoServerState: ServerState;
  exoServerLogs: string[];
  exoClusterState: ExoClusterState | null;
  connectExo: () => Promise<void>;
  disconnectExo: () => Promise<void>;

  // Model state
  models: LocalModel[];
  downloads: DownloadProgress[];
  refreshModels: () => Promise<void>;
  deleteModel: (path: string) => Promise<void>;

  // Settings
  settings: AppSettings | null;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;

  // System
  systemInfo: { platform: string; arch: string; memory: number; freeMemory: number } | null;

  // Update
  updateInfo: UpdateInfo | null;
  checkForUpdates: () => Promise<UpdateCheckResult>;

  // ComfyUI Install
  comfyuiInstallInfo: ComfyUIInstallInfo | null;
  comfyuiInstallProgress: ComfyUIInstallProgress | null;
  refreshComfyUIInstallInfo: () => Promise<void>;
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
  contextSize: null,
  gpuLayers: null,
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
  const [imageServerState, setImageServerState] = useState<ServerState>(defaultServerState);
  const [imageServerLogs, setImageServerLogs] = useState<string[]>([]);
  const [videoServerState, setVideoServerState] = useState<ServerState>(defaultServerState);
  const [videoServerLogs, setVideoServerLogs] = useState<string[]>([]);
  const [exoServerState, setExoServerState] = useState<ServerState>(defaultServerState);
  const [exoServerLogs, setExoServerLogs] = useState<string[]>([]);
  const [exoClusterState, setExoClusterState] = useState<ExoClusterState | null>(null);
  const [models, setModels] = useState<LocalModel[]>([]);
  const [downloads, setDownloads] = useState<DownloadProgress[]>([]);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [systemInfo, setSystemInfo] = useState<{ platform: string; arch: string; memory: number; freeMemory: number } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [comfyuiInstallInfo, setComfyuiInstallInfo] = useState<ComfyUIInstallInfo | null>(null);
  const [comfyuiInstallProgress, setComfyuiInstallProgress] = useState<ComfyUIInstallProgress | null>(null);

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
    api.image.getStatus().then(setImageServerState);
    api.image.getLogs().then(setImageServerLogs);
    api.video.getStatus().then(setVideoServerState);
    api.video.getLogs().then(setVideoServerLogs);
    api.exo.getStatus().then(setExoServerState);
    api.exo.getLogs().then(setExoServerLogs);
    api.exo.getClusterState().then(setExoClusterState);
    api.comfyui.getInstallStatus().then(setComfyuiInstallInfo);

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

    const unsub4 = api.onUpdateAvailable((info) => {
      setUpdateInfo(info);
    });

    const unsub5 = api.image.onStatusChanged((state) => {
      setImageServerState(state);
    });

    const unsub6 = api.image.onLogLine((line) => {
      setImageServerLogs((prev) => [...prev.slice(-499), line]);
    });

    const unsub7 = api.video.onStatusChanged((state) => {
      setVideoServerState(state);
    });

    const unsub8 = api.video.onLogLine((line) => {
      setVideoServerLogs((prev) => [...prev.slice(-499), line]);
    });

    const unsub9 = api.exo.onStatusChanged((state) => {
      setExoServerState(state);
    });

    const unsub10 = api.exo.onLogLine((line) => {
      setExoServerLogs((prev) => [...prev.slice(-499), line]);
    });

    const unsub11 = api.exo.onClusterChanged((state) => {
      setExoClusterState(state);
    });

    const unsub12 = api.comfyui.onInstallProgress((progress) => {
      setComfyuiInstallProgress(progress);
      if (progress.status === 'installed' || progress.status === 'error') {
        api.comfyui.getInstallStatus().then(setComfyuiInstallInfo);
      }
    });

    cleanupRef.current = [unsub1, unsub2, unsub3, unsub4, unsub5, unsub6, unsub7, unsub8, unsub9, unsub10, unsub11, unsub12];

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

  const connectExo = useCallback(async () => {
    await window.tasmania.exo.connect();
    const state = await window.tasmania.exo.getStatus();
    setExoServerState(state);
    const cluster = await window.tasmania.exo.getClusterState();
    setExoClusterState(cluster);
  }, []);

  const disconnectExo = useCallback(async () => {
    await window.tasmania.exo.disconnect();
    const state = await window.tasmania.exo.getStatus();
    setExoServerState(state);
    setExoClusterState(null);
  }, []);

  const refreshComfyUIInstallInfo = useCallback(async () => {
    const info = await window.tasmania.comfyui.getInstallStatus();
    setComfyuiInstallInfo(info);
  }, []);

  const checkForUpdates = useCallback(async () => {
    const result = await window.tasmania.checkForUpdates();
    if (result.updateInfo) {
      setUpdateInfo(result.updateInfo);
    }
    return result;
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
        imageServerState,
        imageServerLogs,
        videoServerState,
        videoServerLogs,
        exoServerState,
        exoServerLogs,
        exoClusterState,
        connectExo,
        disconnectExo,
        models,
        downloads,
        refreshModels,
        deleteModel,
        settings,
        updateSettings,
        systemInfo,
        updateInfo,
        checkForUpdates,
        comfyuiInstallInfo,
        comfyuiInstallProgress,
        refreshComfyUIInstallInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
