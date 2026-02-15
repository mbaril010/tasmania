import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import LLMServerControl from '../components/Common/LLMServerControl';
import ChatPanel from '../components/Chat/ChatPanel';
import SessionSidebar from '../components/Chat/SessionSidebar';
import TerminalPanel from '../components/Terminal/TerminalPanel';
import TerminalSessionSidebar from '../components/Terminal/TerminalSessionSidebar';
import ImagePanel from '../components/Image/ImagePanel';
import Img2ImgPanel from '../components/Image/Img2ImgPanel';
import VideoPanel from '../components/Video/VideoPanel';

type DashboardTab = 'chat' | 'code' | 'image' | 'img2img' | 'video';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'chat', label: '💬 Chat' },
  { id: 'code', label: '🖥 Code' },
  { id: 'image', label: '🎨 Txt2Img' },
  { id: 'img2img', label: '🖼 Img2Img' },
  { id: 'video', label: '🎬 Video' },
];

const HomeScreen: React.FC = () => {
  const { serverState } = useApp();
  const [activeTab, setActiveTab] = useState<DashboardTab>('chat');
  const [terminalCreated, setTerminalCreated] = useState(false);

  // Gate terminal creation: once created, keep it alive even if server stops
  useEffect(() => {
    if (serverState.status === 'running' && !terminalCreated) {
      setTerminalCreated(true);
    }
  }, [serverState.status, terminalCreated]);

  return (
    <div style={{ padding: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1rem', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Dashboard</h2>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: '#141414',
            borderRadius: 10,
            padding: 4,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab.id ? '#333' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* Image tab */}
        <div style={{ display: activeTab === 'image' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
          <ImagePanel />
        </div>

        {/* Video tab */}
        <div style={{ display: activeTab === 'video' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
          <VideoPanel />
        </div>

        {/* Img2Img tab */}
        <div style={{ display: activeTab === 'img2img' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
          <Img2ImgPanel />
        </div>

        {/* Chat tab */}
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
          <SessionSidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, paddingLeft: 12 }}>
            <ChatPanel mode="chat" />
          </div>
        </div>

        {/* Code tab */}
        <div style={{ display: activeTab === 'code' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
          <TerminalSessionSidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, paddingLeft: 12 }}>
            <LLMServerControl onServerStopped={() => setTerminalCreated(false)} />
            {terminalCreated ? (
              <TerminalPanel />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <p style={{ fontSize: '0.9rem' }}>
                  Start the server to use the terminal.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
