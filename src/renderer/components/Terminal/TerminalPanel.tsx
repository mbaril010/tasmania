import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useApp } from '../../contexts/AppContext';

const TerminalPanel: React.FC = () => {
  const { serverState } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Guard: if xterm already mounted in this container, skip
    if (xtermRef.current) return;

    let cancelled = false;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 10000,
      theme: {
        background: '#0f0f0f',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#6366f155',
        black: '#0f0f0f',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#6366f1',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e0e0e0',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    xtermRef.current = term;

    // Pipe PTY output → xterm
    const unsubscribe = window.tasmania.terminal.onData((data: string) => {
      term.write(data);
    });

    // Pipe xterm input → PTY
    const inputDisposable = term.onData((data: string) => {
      window.tasmania.terminal.write(data);
    });

    // Handle resize
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.tasmania.terminal.resize(cols, rows);
    });

    // ResizeObserver for auto-fit (guard against zero dimensions when hidden)
    const resizeObserver = new ResizeObserver(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(container);

    // Init: fit → create PTY → focus → launch claude
    const init = async () => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit();
      }
      if (cancelled) return;

      // Redirect Claude Code API calls to local llama-server
      // llama-server natively supports the Anthropic Messages API (/v1/messages)
      const modelName = serverState.modelName || 'local-model';
      const claudeEnv = {
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${serverState.port}`,
        ANTHROPIC_MODEL: modelName,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      };
      await window.tasmania.terminal.create(term.cols, term.rows, claudeEnv);
      if (cancelled) return;

      term.focus();

      // Wait for shell to init, then launch claude
      setTimeout(() => {
        if (!cancelled) {
          window.tasmania.terminal.write('claude --dangerously-skip-permissions\n');
        }
      }, 1000);
    };

    // Delay init to next frame so DOM is fully laid out
    requestAnimationFrame(() => {
      if (!cancelled) init();
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      unsubscribe();
      window.tasmania.terminal.kill();
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseDown={() => xtermRef.current?.focus()}
      style={{
        height: 420,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#0f0f0f',
        cursor: 'text',
      }}
    />
  );
};

export default TerminalPanel;
