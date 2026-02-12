import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, systemInfo, updateInfo, checkForUpdates } = useApp();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

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

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto', maxWidth: 700 }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Settings</h2>

      {/* Storage */}
      <Card title="Storage" style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: 6 }}>
          Model storage directory:
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
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

      {/* Server Defaults */}
      <Card title="Server Defaults" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Port:</label>
            <input
              type="number"
              value={settings.llamaCpp.port}
              onChange={(e) =>
                updateSettings({
                  llamaCpp: { ...settings.llamaCpp, port: parseInt(e.target.value) || 8080 },
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Context size:</label>
            <input
              type="number"
              value={settings.llamaCpp.contextSize}
              onChange={(e) =>
                updateSettings({
                  llamaCpp: { ...settings.llamaCpp, contextSize: parseInt(e.target.value) || 4096 },
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>GPU layers (-ngl):</label>
            <input
              type="number"
              value={settings.llamaCpp.gpuLayers}
              onChange={(e) =>
                updateSettings({
                  llamaCpp: { ...settings.llamaCpp, gpuLayers: parseInt(e.target.value) || 99 },
                })
              }
              style={inputStyle}
            />
            <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 4 }}>
              99 = offload all layers to GPU. Set to 0 for CPU-only.
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
        </div>
      </Card>

      {/* Image Generation */}
      <Card title="Image Generation" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Port:</label>
            <input
              type="number"
              value={settings.stableDiffusion?.port ?? 1234}
              onChange={(e) =>
                updateSettings({
                  stableDiffusion: { ...settings.stableDiffusion, port: parseInt(e.target.value) || 1234 },
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Default steps:</label>
            <input
              type="number"
              value={settings.stableDiffusion?.defaultSteps ?? 20}
              onChange={(e) =>
                updateSettings({
                  stableDiffusion: { ...settings.stableDiffusion, defaultSteps: parseInt(e.target.value) || 20 },
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Default CFG scale:</label>
            <input
              type="number"
              step="0.5"
              value={settings.stableDiffusion?.defaultCfgScale ?? 7.0}
              onChange={(e) =>
                updateSettings({
                  stableDiffusion: { ...settings.stableDiffusion, defaultCfgScale: parseFloat(e.target.value) || 7.0 },
                })
              }
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <label style={labelStyle}>Default width:</label>
              <input
                type="number"
                step="64"
                value={settings.stableDiffusion?.defaultWidth ?? 512}
                onChange={(e) =>
                  updateSettings({
                    stableDiffusion: { ...settings.stableDiffusion, defaultWidth: parseInt(e.target.value) || 512 },
                  })
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Default height:</label>
              <input
                type="number"
                step="64"
                value={settings.stableDiffusion?.defaultHeight ?? 512}
                onChange={(e) =>
                  updateSettings({
                    stableDiffusion: { ...settings.stableDiffusion, defaultHeight: parseInt(e.target.value) || 512 },
                  })
                }
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Updates */}
      <Card title="Updates" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="autoCheckUpdates"
              checked={settings.autoCheckUpdates ?? true}
              onChange={(e) => updateSettings({ autoCheckUpdates: e.target.checked })}
            />
            <label htmlFor="autoCheckUpdates" style={{ fontSize: '0.85rem', color: '#aaa' }}>
              Automatically check for updates on launch
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

      {/* System Info */}
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
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  color: '#888',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: 200,
  padding: '8px 12px',
  background: '#252525',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#e0e0e0',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
};

export default SettingsScreen;
