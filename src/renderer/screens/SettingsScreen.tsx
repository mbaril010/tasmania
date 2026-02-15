import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, systemInfo, updateInfo, checkForUpdates } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // Local draft state for Server Defaults
  const [draftLlama, setDraftLlama] = useState({ port: 8080, contextSize: 8192, gpuLayers: 99 });
  const [llamaDirty, setLlamaDirty] = useState(false);
  const [llamaSaved, setLlamaSaved] = useState(false);
  const [llamaError, setLlamaError] = useState<string | null>(null);

  // Local draft state for Image Generation
  const [draftSD, setDraftSD] = useState({ port: 1234, defaultSteps: 20, defaultCfgScale: 7.0, defaultWidth: 512, defaultHeight: 512 });
  const [sdDirty, setSDDirty] = useState(false);
  const [sdSaved, setSDSaved] = useState(false);
  const [sdError, setSDError] = useState<string | null>(null);

  // Local draft state for ComfyUI
  const [draftComfyui, setDraftComfyui] = useState({ path: '', port: 8188, pythonPath: 'python3' });
  const [comfyuiDirty, setComfyuiDirty] = useState(false);
  const [comfyuiSaved, setComfyuiSaved] = useState(false);
  const [comfyuiError, setComfyuiError] = useState<string | null>(null);

  // Sync drafts when settings load or change externally
  useEffect(() => {
    if (settings) {
      setDraftLlama({
        port: settings.llamaCpp.port,
        contextSize: settings.llamaCpp.contextSize,
        gpuLayers: settings.llamaCpp.gpuLayers,
      });
      setDraftSD({
        port: settings.stableDiffusion?.port ?? 1234,
        defaultSteps: settings.stableDiffusion?.defaultSteps ?? 20,
        defaultCfgScale: settings.stableDiffusion?.defaultCfgScale ?? 7.0,
        defaultWidth: settings.stableDiffusion?.defaultWidth ?? 512,
        defaultHeight: settings.stableDiffusion?.defaultHeight ?? 512,
      });
      setDraftComfyui({
        path: settings.comfyui?.path ?? '',
        port: settings.comfyui?.port ?? 8188,
        pythonPath: settings.comfyui?.pythonPath ?? 'python3',
      });
      setLlamaDirty(false);
      setSDDirty(false);
      setComfyuiDirty(false);
    }
  }, [settings]);

  if (!settings) {
    return <div style={{ padding: '2rem', color: '#666' }}>Loading settings...</div>;
  }

  const handleSelectDir = async () => {
    const dir = await window.tasmania.selectDirectory();
    if (dir) {
      await updateSettings({ modelsDir: dir });
    }
  };

  const handleOpenModelsDir = () => {
    window.tasmania.openPath(settings.modelsDir);
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const result = await checkForUpdates();
      if (result.error) {
        setUpdateMessage(`Error: ${result.error}`);
      } else if (result.updateAvailable && result.updateInfo) {
        setUpdateMessage(`Update available: v${result.updateInfo.latestVersion}`);
      } else {
        setUpdateMessage('You are running the latest version');
      }
    } catch {
      setUpdateMessage('Failed to check for updates');
    } finally {
      setCheckingUpdate(false);
    }
    setTimeout(() => setUpdateMessage(null), 5000);
  };

  const saveLlamaSettings = async () => {
    setLlamaError(null);
    try {
      await updateSettings({ llamaCpp: draftLlama });
      setLlamaDirty(false);
      setLlamaSaved(true);
      setTimeout(() => setLlamaSaved(false), 2000);
    } catch (err) {
      setLlamaError(err instanceof Error ? err.message : String(err));
    }
  };

  const saveComfyuiSettings = async () => {
    setComfyuiError(null);
    try {
      await updateSettings({ comfyui: draftComfyui });
      setComfyuiDirty(false);
      setComfyuiSaved(true);
      setTimeout(() => setComfyuiSaved(false), 2000);
    } catch (err) {
      setComfyuiError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectComfyuiDir = async () => {
    const dir = await window.tasmania.selectDirectory();
    if (dir) {
      setDraftComfyui((d) => ({ ...d, path: dir }));
      setComfyuiDirty(true);
    }
  };

  const saveSDSettings = async () => {
    setSDError(null);
    try {
      await updateSettings({ stableDiffusion: draftSD });
      setSDDirty(false);
      setSDSaved(true);
      setTimeout(() => setSDSaved(false), 2000);
    } catch (err) {
      setSDError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', flexShrink: 0 }}>Settings</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1, minHeight: 0, overflowY: 'auto', alignContent: 'start' }}>

        {/* Storage — full width */}
        <Card title="Storage" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={settings.modelsDir}
              readOnly
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#252525',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#e0e0e0',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
              }}
            />
            <Button variant="secondary" size="sm" onClick={handleSelectDir}>
              Browse
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenModelsDir}>
              Open
            </Button>
          </div>
        </Card>

        {/* Server Defaults — left column */}
        <Card title="Server Defaults">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Port:</label>
                <input
                  type="number"
                  value={draftLlama.port}
                  onChange={(e) => {
                    setDraftLlama((d) => ({ ...d, port: parseInt(e.target.value) || 0 }));
                    setLlamaDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>GPU layers (-ngl):</label>
                <input
                  type="number"
                  value={draftLlama.gpuLayers}
                  onChange={(e) => {
                    setDraftLlama((d) => ({ ...d, gpuLayers: parseInt(e.target.value) || 0 }));
                    setLlamaDirty(true);
                  }}
                  style={inputStyle}
                />
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 4 }}>
                  99 = all layers on GPU. 0 = CPU-only.
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Context size:</label>
              <input
                type="number"
                value={draftLlama.contextSize}
                onChange={(e) => {
                  setDraftLlama((d) => ({ ...d, contextSize: parseInt(e.target.value) || 0 }));
                  setLlamaDirty(true);
                }}
                style={inputStyle}
              />
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 4 }}>
                Tokens the model can process at once. Higher = more memory.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="autoStart"
                checked={settings.autoStart}
                onChange={(e) => updateSettings({ autoStart: e.target.checked })}
              />
              <label htmlFor="autoStart" style={{ fontSize: '0.85rem', color: '#aaa' }}>
                Auto-start server on app launch
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={saveLlamaSettings} disabled={!llamaDirty}>
                Save
              </Button>
              {llamaSaved && (
                <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>Saved! Applies on next start.</span>
              )}
              {llamaError && (
                <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{llamaError}</span>
              )}
            </div>
          </div>
        </Card>

        {/* Image Generation — right column */}
        <Card title="Image Generation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Port:</label>
                <input
                  type="number"
                  value={draftSD.port}
                  onChange={(e) => {
                    setDraftSD((d) => ({ ...d, port: parseInt(e.target.value) || 0 }));
                    setSDDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default steps:</label>
                <input
                  type="number"
                  value={draftSD.defaultSteps}
                  onChange={(e) => {
                    setDraftSD((d) => ({ ...d, defaultSteps: parseInt(e.target.value) || 0 }));
                    setSDDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Default CFG scale:</label>
              <input
                type="number"
                step="0.5"
                value={draftSD.defaultCfgScale}
                onChange={(e) => {
                  setDraftSD((d) => ({ ...d, defaultCfgScale: parseFloat(e.target.value) || 0 }));
                  setSDDirty(true);
                }}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default width:</label>
                <input
                  type="number"
                  step="64"
                  value={draftSD.defaultWidth}
                  onChange={(e) => {
                    setDraftSD((d) => ({ ...d, defaultWidth: parseInt(e.target.value) || 0 }));
                    setSDDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Default height:</label>
                <input
                  type="number"
                  step="64"
                  value={draftSD.defaultHeight}
                  onChange={(e) => {
                    setDraftSD((d) => ({ ...d, defaultHeight: parseInt(e.target.value) || 0 }));
                    setSDDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={saveSDSettings} disabled={!sdDirty}>
                Save
              </Button>
              {sdSaved && (
                <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>Saved!</span>
              )}
              {sdError && (
                <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{sdError}</span>
              )}
            </div>
          </div>
        </Card>

        {/* Video (ComfyUI) — full width */}
        <Card title="Video (ComfyUI)" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>ComfyUI path:</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={draftComfyui.path}
                  onChange={(e) => {
                    setDraftComfyui((d) => ({ ...d, path: e.target.value }));
                    setComfyuiDirty(true);
                  }}
                  placeholder="/path/to/ComfyUI"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
                <Button variant="secondary" size="sm" onClick={handleSelectComfyuiDir}>
                  Browse
                </Button>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 4 }}>
                Directory containing ComfyUI's main.py
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Port:</label>
                <input
                  type="number"
                  value={draftComfyui.port}
                  onChange={(e) => {
                    setDraftComfyui((d) => ({ ...d, port: parseInt(e.target.value) || 0 }));
                    setComfyuiDirty(true);
                  }}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Python path:</label>
                <input
                  type="text"
                  value={draftComfyui.pythonPath}
                  onChange={(e) => {
                    setDraftComfyui((d) => ({ ...d, pythonPath: e.target.value }));
                    setComfyuiDirty(true);
                  }}
                  placeholder="python3"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button onClick={saveComfyuiSettings} disabled={!comfyuiDirty}>
                Save
              </Button>
              {comfyuiSaved && (
                <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>Saved!</span>
              )}
              {comfyuiError && (
                <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{comfyuiError}</span>
              )}
            </div>
          </div>
        </Card>

        {/* Updates — bottom left */}
        <Card title="Updates">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="autoCheckUpdates"
                checked={settings.autoCheckUpdates ?? true}
                onChange={(e) => updateSettings({ autoCheckUpdates: e.target.checked })}
              />
              <label htmlFor="autoCheckUpdates" style={{ fontSize: '0.85rem', color: '#aaa' }}>
                Auto-check for updates on launch
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button variant="secondary" size="sm" onClick={handleCheckForUpdates} disabled={checkingUpdate}>
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </Button>
              {updateMessage && (
                <span style={{ fontSize: '0.85rem', color: '#888' }}>{updateMessage}</span>
              )}
            </div>

            {updateInfo?.isUpdateAvailable && (
              <div
                style={{
                  background: '#1a3a1a',
                  border: '1px solid #2d5a2d',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: '0.85rem', color: '#7dd87d', marginBottom: 8, fontWeight: 600 }}>
                  Update Available: v{updateInfo.latestVersion}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: 8 }}>
                  Current version: v{updateInfo.currentVersion}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => window.tasmania.openExternal(updateInfo.downloadUrl)}
                >
                  Download Update
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* System Info — bottom right */}
        {systemInfo && (
          <Card title="System Information">
            <div style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Platform: {systemInfo.platform}</div>
              <div>Architecture: {systemInfo.arch}</div>
              <div>Memory: {(systemInfo.memory / 1024 / 1024 / 1024).toFixed(1)} GB</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#888',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  background: '#252525',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#e0e0e0',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
};

export default SettingsScreen;
