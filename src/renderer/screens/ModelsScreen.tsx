import React, { useState, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import Card from '../components/Common/Card';
import Button from '../components/Common/Button';
import type { HuggingFaceModel, HuggingFaceFile } from '../../shared/types';

type Tab = 'local' | 'browse' | 'downloads';

const ModelsScreen: React.FC = () => {
  const { models, downloads, deleteModel, refreshModels } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('local');

  return (
    <div style={{ padding: '2rem', height: '100%', overflow: 'auto' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Models</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: '#1a1a1a', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['local', 'browse', 'downloads'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === tab ? '#333' : 'transparent',
              color: activeTab === tab ? '#fff' : '#888',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'local' ? `Local (${models.length})` : tab === 'browse' ? 'HuggingFace' : `Downloads (${downloads.filter(d => d.status === 'downloading').length})`}
          </button>
        ))}
      </div>

      {activeTab === 'local' && <LocalModelsTab />}
      {activeTab === 'browse' && <HuggingFaceBrowserTab />}
      {activeTab === 'downloads' && <DownloadsTab />}
    </div>
  );
};

// ── Local Models Tab ──

const LocalModelsTab: React.FC = () => {
  const { models, deleteModel } = useApp();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (path: string) => {
    if (!confirm('Delete this model? This cannot be undone.')) return;
    setDeleting(path);
    try {
      await deleteModel(path);
    } finally {
      setDeleting(null);
    }
  };

  if (models.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: 8 }}>No models downloaded yet</p>
          <p style={{ fontSize: '0.85rem' }}>Switch to the HuggingFace tab to browse and download models.</p>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
      {models.map((model) => (
        <Card key={model.path}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, wordBreak: 'break-word' }}>
              {model.filename}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Tag>{formatBytes(model.sizeBytes)}</Tag>
              {model.quantization && <Tag color="#fbbf24">{model.quantization}</Tag>}
              {model.parameters && <Tag color="#f59e0b">{model.parameters}</Tag>}
            </div>
          </div>
          {model.repo && (
            <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: 8 }}>
              {model.repo}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDelete(model.path)}
              disabled={deleting === model.path}
            >
              {deleting === model.path ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

// ── HuggingFace Browser Tab ──

const HuggingFaceBrowserTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HuggingFaceModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<HuggingFaceFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const models = await window.tasmania.searchHuggingFace(query);
      setResults(models);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleExpand = async (repoId: string) => {
    if (expandedRepo === repoId) {
      setExpandedRepo(null);
      return;
    }
    setExpandedRepo(repoId);
    setLoadingFiles(true);
    try {
      const files = await window.tasmania.listModelFiles(repoId);
      setRepoFiles(files);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDownload = async (repo: string, filename: string) => {
    const key = `${repo}/${filename}`;
    setDownloading((prev) => new Set(prev).add(key));
    try {
      await window.tasmania.downloadModel(repo, filename);
    } catch {
      // errors shown via download progress
    }
    setDownloading((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  return (
    <div>
      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search models (e.g., llama 3.2, phi, qwen...)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <Button onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Results */}
      {results.length === 0 && !searching && (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Search HuggingFace for models to download.
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {results.map((model) => (
          <Card key={model.id}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
              onClick={() => handleExpand(model.id)}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{model.id}</div>
                <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#666' }}>
                  <span>↓ {model.downloads.toLocaleString()}</span>
                  <span>♥ {model.likes}</span>
                </div>
              </div>
              <span style={{ color: '#666', fontSize: '1.2rem' }}>
                {expandedRepo === model.id ? '▾' : '▸'}
              </span>
            </div>

            {/* Expanded file list */}
            {expandedRepo === model.id && (
              <div style={{ marginTop: 12, borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                {loadingFiles ? (
                  <div style={{ color: '#666', fontSize: '0.85rem' }}>Loading files...</div>
                ) : repoFiles.length === 0 ? (
                  <div style={{ color: '#666', fontSize: '0.85rem' }}>No files found in this repo.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {repoFiles.map((file) => {
                      const key = `${model.id}/${file.filename}`;
                      const isDownloading = downloading.has(key);
                      return (
                        <div
                          key={file.filename}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            background: '#252525',
                            borderRadius: 6,
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{file.filename}</div>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatBytes(file.sizeBytes)}</div>
                          </div>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(model.id, file.filename);
                            }}
                            disabled={isDownloading}
                          >
                            {isDownloading ? 'Downloading...' : 'Download'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── Downloads Tab ──

const DownloadsTab: React.FC = () => {
  const { downloads } = useApp();

  if (downloads.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          No downloads yet. Search and download models from the HuggingFace tab.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {downloads.map((dl) => (
        <Card key={dl.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{dl.filename}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{dl.repo}</div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: 4,
                background:
                  dl.status === 'completed' ? '#16532e' :
                  dl.status === 'error' ? '#3b1a1a' :
                  dl.status === 'downloading' ? '#1a2744' :
                  '#252525',
                color:
                  dl.status === 'completed' ? '#4ade80' :
                  dl.status === 'error' ? '#f87171' :
                  dl.status === 'downloading' ? '#60a5fa' :
                  '#888',
              }}
            >
              {dl.status}
            </span>
          </div>

          {dl.status === 'downloading' && dl.totalBytes > 0 && (
            <>
              <div style={{ height: 4, background: '#252525', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(dl.downloadedBytes / dl.totalBytes) * 100}%`,
                    background: '#fbbf24',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666' }}>
                <span>{formatBytes(dl.downloadedBytes)} / {formatBytes(dl.totalBytes)}</span>
                <span>{formatBytes(dl.speedBps)}/s</span>
              </div>
            </>
          )}

          {dl.error && (
            <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: 4 }}>{dl.error}</div>
          )}
        </Card>
      ))}
    </div>
  );
};

// ── Helpers ──

const Tag: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = '#666' }) => (
  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: `${color}22`, color, fontFamily: 'monospace' }}>
    {children}
  </span>
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default ModelsScreen;
