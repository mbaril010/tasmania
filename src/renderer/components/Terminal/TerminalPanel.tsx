import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useApp } from '../../contexts/AppContext';
import { useTerminalSessions } from '../../contexts/TerminalSessionContext';

interface TerminalInstance {
  term: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement;
  resizeObserver: ResizeObserver;
  inputDisposable: { dispose(): void };
  resizeDisposable: { dispose(): void };
  ptyCreated: boolean;
  /** setTimeout ID for the claude launch command — cleared on teardown */
  launchTimer: ReturnType<typeof setTimeout> | null;
}

const TERM_THEME = {
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
};

const TerminalPanel: React.FC = () => {
  const { serverState } = useApp();
  const { sessions, activeSessionId } = useTerminalSessions();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const instancesRef = useRef<Map<string, TerminalInstance>>(new Map());
  // Keep latest serverState available in callbacks without re-running effects
  const serverStateRef = useRef(serverState);
  serverStateRef.current = serverState;

  // Build the Claude environment from current server state
  const getClaudeEnv = useCallback(() => {
    const st = serverStateRef.current;
    const modelName = st.modelName || 'local-model';
    return {
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${st.port}`,
      ANTHROPIC_MODEL: modelName,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    };
  }, []);

  // Create or get a terminal instance for a session
  const ensureInstance = useCallback((sessionId: string): TerminalInstance => {
    const existing = instancesRef.current.get(sessionId);
    if (existing) return existing;

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.display = 'none';

    wrapperRef.current?.appendChild(container);

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollback: 10000,
      theme: TERM_THEME,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    const inputDisposable = term.onData((data: string) => {
      window.tasmania.terminal.write(sessionId, data);
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.tasmania.terminal.resize(sessionId, cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit();
      }
    });
    resizeObserver.observe(container);

    const instance: TerminalInstance = {
      term,
      fitAddon,
      container,
      resizeObserver,
      inputDisposable,
      resizeDisposable,
      ptyCreated: false,
      launchTimer: null,
    };

    instancesRef.current.set(sessionId, instance);
    return instance;
  }, []);

  // Subscribe to PTY data — route to correct terminal instance
  useEffect(() => {
    const unsubData = window.tasmania.terminal.onData((sessionId: string, data: string) => {
      instancesRef.current.get(sessionId)?.term.write(data);
    });

    const unsubExit = window.tasmania.terminal.onExit((sessionId: string) => {
      const instance = instancesRef.current.get(sessionId);
      if (instance) {
        instance.ptyCreated = false;
      }
    });

    return () => {
      unsubData();
      unsubExit();
    };
  }, []);

  // Show/hide containers and lazy-init PTY when active session changes
  useEffect(() => {
    let cancelled = false;

    for (const [id, instance] of instancesRef.current) {
      instance.container.style.display = id === activeSessionId ? 'block' : 'none';
    }

    const instance = ensureInstance(activeSessionId);
    instance.container.style.display = 'block';

    // Delay init to next frame so DOM is fully laid out (matches original pattern)
    requestAnimationFrame(() => {
      if (cancelled) return;

      const { fitAddon, container, term } = instance;
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        fitAddon.fit();
      }
      term.focus();

      // Lazy init PTY
      if (!instance.ptyCreated) {
        instance.ptyCreated = true;

        const initPty = async () => {
          await window.tasmania.terminal.create(activeSessionId, term.cols, term.rows, getClaudeEnv());
          if (cancelled) return;

          term.focus();

          // Wait for shell to init, then launch claude
          instance.launchTimer = setTimeout(() => {
            if (!cancelled) {
              window.tasmania.terminal.write(activeSessionId, 'claude --dangerously-skip-permissions\n');
            }
          }, 1000);
        };

        initPty();
      }
    });

    return () => {
      cancelled = true;
      if (instance.launchTimer !== null) {
        clearTimeout(instance.launchTimer);
        instance.launchTimer = null;
      }
    };
  }, [activeSessionId, ensureInstance, getClaudeEnv]);

  // Clean up instances for deleted sessions
  useEffect(() => {
    const sessionIds = new Set(sessions.map((s) => s.id));
    for (const [id, instance] of instancesRef.current) {
      if (!sessionIds.has(id)) {
        if (instance.launchTimer !== null) clearTimeout(instance.launchTimer);
        instance.resizeObserver.disconnect();
        instance.inputDisposable.dispose();
        instance.resizeDisposable.dispose();
        instance.term.dispose();
        instance.container.remove();
        instancesRef.current.delete(id);
      }
    }
  }, [sessions]);

  // Kill all PTYs on unmount
  useEffect(() => {
    return () => {
      window.tasmania.terminal.killAll();
      for (const [, instance] of instancesRef.current) {
        if (instance.launchTimer !== null) clearTimeout(instance.launchTimer);
        // Reset ptyCreated so StrictMode remount re-inits the PTY
        instance.ptyCreated = false;
        instance.resizeObserver.disconnect();
        instance.inputDisposable.dispose();
        instance.resizeDisposable.dispose();
        instance.term.dispose();
        instance.container.remove();
      }
      instancesRef.current.clear();
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      onMouseDown={() => instancesRef.current.get(activeSessionId)?.term.focus()}
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
