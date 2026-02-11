import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';

const ApiScreen: React.FC = () => {
  const { serverState, settings } = useApp();
  const [copied, setCopied] = useState(false);

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

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto', maxWidth: 700 }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>API</h2>

      {/* Connect to Claude Code */}
      <Card title="Connect to Claude Code" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#aaa', lineHeight: 1.6 }}>
          <p style={{ marginBottom: 8 }}>
            Once the server is running, you can use it as an OpenAI-compatible API provider:
          </p>
          <code
            style={{
              display: 'block',
              background: '#252525',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: '0.8rem',
              color: '#e0e0e0',
              fontFamily: 'monospace',
              marginBottom: 8,
            }}
          >
            http://localhost:{serverState.port || settings?.llamaCpp.port || 8080}/v1
          </code>
          <p>
            Or use the MCP server configuration below for direct Claude Code connectivity.
          </p>
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
    </div>
  );
};

function getMcpServerPath(): string {
  if (process.env.NODE_ENV === 'development') {
    return '/path/to/tasmania/dist-mcp/server.js';
  }
  return '/Applications/Tasmania.app/Contents/Resources/dist-mcp/server.js';
}

export default ApiScreen;
