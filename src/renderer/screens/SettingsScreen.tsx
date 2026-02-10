import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, systemInfo } = useApp();
  const [copied, setCopied] = useState(false);

  if (!settings) {
    return <div style={{ padding: '2rem', color: '#666' }}>Loading settings...</div>;
  }

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        tasmania: {
          command: 'node',
          args: [getMcpServerPath()],
        },
      },
    },
    null,
    2
  );

  const handleCopyMcp = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectDir = async () => {
    const dir = await window.tasmania.selectDirectory();
    if (dir) {
      await updateSettings({ modelsDir: dir });
    }
  };

  const handleOpenModelsDir = () => {
    window.tasmania.openPath(settings.modelsDir);
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

      {/* MCP Integration */}
      <Card title="Claude Code MCP Integration" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: 12, lineHeight: 1.5 }}>
          Add the following to your Claude Code MCP configuration to connect to Tasmania:
        </div>
        <pre
          style={{
            background: '#0f0f0f',
            padding: '14px',
            borderRadius: 8,
            fontSize: '0.8rem',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            overflow: 'auto',
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          {mcpConfig}
        </pre>
        <Button variant="secondary" size="sm" onClick={handleCopyMcp}>
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
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

function getMcpServerPath(): string {
  // In production, this will be inside the app bundle
  if (process.env.NODE_ENV === 'development') {
    return '/path/to/tasmania/dist-mcp/server.js';
  }
  return '/Applications/Tasmania.app/Contents/Resources/dist-mcp/server.js';
}

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
