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

type SortKey = 'name' | 'size' | 'quant' | 'params';
type SortDir = 'asc' | 'desc';

/** Parse parameter strings like "3B", "70B", "0.5B" into a comparable number */
function parseParams(p: string | null): number {
  if (!p) return 0;
  const m = p.match(/([\d.]+)\s*[Bb]/);
  return m ? parseFloat(m[1]) : 0;
}

const LocalModelsTab: React.FC = () => {
  const { models, deleteModel } = useApp();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedModels = [...models].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'name':
        cmp = a.filename.localeCompare(b.filename);
        break;
      case 'size':
        cmp = a.sizeBytes - b.sizeBytes;
        break;
      case 'quant':
        cmp = (a.quantization ?? '').localeCompare(b.quantization ?? '');
        break;
      case 'params':
        cmp = parseParams(a.parameters) - parseParams(b.parameters);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

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
    <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
            <th style={thClickStyle} onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
            <th style={{ ...thClickStyle, width: 110 }} onClick={() => toggleSort('size')}>Size{arrow('size')}</th>
            <th style={{ ...thClickStyle, width: 100 }} onClick={() => toggleSort('quant')}>Quant{arrow('quant')}</th>
            <th style={{ ...thClickStyle, width: 100 }} onClick={() => toggleSort('params')}>Params{arrow('params')}</th>
            <th style={{ ...thStyle, width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedModels.map((model) => (
            <tr key={model.path} style={{ borderBottom: '1px solid #222' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {model.filename}
                </div>
                {model.repo && (
                  <div style={{ fontSize: '0.75rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {model.repo}
                  </div>
                )}
              </td>
              <td style={{ ...tdStyle, color: '#aaa', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {formatBytes(model.sizeBytes)}
              </td>
              <td style={tdStyle}>
                {model.quantization && <Tag color="#fbbf24">{model.quantization}</Tag>}
              </td>
              <td style={tdStyle}>
                {model.parameters && <Tag color="#f59e0b">{model.parameters}</Tag>}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(model.path)}
                  disabled={deleting === model.path}
                >
                  {deleting === model.path ? '...' : 'Delete'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── HuggingFace Browser Tab ──

const HuggingFaceBrowserTab: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HuggingFaceModel[]>([]);
  const [searching, setSearching] = useState(false);
  const [openRepo, setOpenRepo] = useState<HuggingFaceModel | null>(null);
  const [repoFiles, setRepoFiles] = useState<HuggingFaceFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

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

  const handleOpenRepo = async (model: HuggingFaceModel) => {
    setOpenRepo(model);
    setSelectedFiles(new Set());
    setLoadingFiles(true);
    try {
      const files = await window.tasmania.listModelFiles(model.id);
      setRepoFiles(files);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleBack = () => {
    setOpenRepo(null);
    setRepoFiles([]);
    setSelectedFiles(new Set());
  };

  const toggleFileSelection = (filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) {
        next.delete(filename);
      } else {
        next.add(filename);
      }
      return next;
    });
  };

  const handleDownloadSelected = (repo: string) => {
    for (const filename of selectedFiles) {
      handleDownload(repo, filename);
    }
    setSelectedFiles(new Set());
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

  // ── Detail view: files for a selected repo ──
  if (openRepo) {
    const sortedFiles = [...repoFiles].sort((a, b) => a.filename.localeCompare(b.filename));
    return (
      <div>
        {/* Header with back button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem' }}>
          <button
            onClick={handleBack}
            style={{
              background: '#252525',
              border: '1px solid #333',
              borderRadius: 8,
              color: '#ccc',
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
            }}
          >
            ← Back
          </button>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#e0e0e0' }}>{openRepo.id}</div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#666' }}>
              <span>↓ {openRepo.downloads.toLocaleString()}</span>
              <span>♥ {openRepo.likes}</span>
            </div>
          </div>
        </div>

        {/* Batch action bar */}
        {selectedFiles.size > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            marginBottom: '0.75rem',
            background: '#1a2744',
            borderRadius: 8,
            fontSize: '0.8rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#60a5fa' }}>
                {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected ({formatBytes(
                  repoFiles.filter(f => selectedFiles.has(f.filename)).reduce((sum, f) => sum + f.sizeBytes, 0)
                )})
              </span>
              <button
                onClick={() => setSelectedFiles(new Set(repoFiles.map(f => f.filename)))}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedFiles(new Set())}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}
              >
                Clear
              </button>
            </div>
            <Button size="sm" onClick={() => handleDownloadSelected(openRepo.id)}>
              Download Selected
            </Button>
          </div>
        )}

        {/* File list */}
        {loadingFiles ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading files...</div>
        ) : sortedFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>No files found in this repo.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedFiles.map((file) => {
              const key = `${openRepo.id}/${file.filename}`;
              const isDownloading = downloading.has(key);
              const isSelected = selectedFiles.has(file.filename);
              return (
                <div
                  key={file.filename}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: isSelected ? '#1a2744' : '#1a1a1a',
                    border: `1px solid ${isSelected ? '#2a4a7a' : '#2a2a2a'}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFileSelection(file.filename)}
                      style={{ accentColor: '#fbbf24', cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#e0e0e0' }}>{file.filename}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatBytes(file.sizeBytes)}</div>
                    </div>
                  </div>
                  {isDownloading ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => window.tasmania.cancelDownload(key)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(openRepo.id, file.filename)}
                    >
                      Download
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Search results list ──
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {results.map((model) => (
          <div
            key={model.id}
            onClick={() => handleOpenRepo(model)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#444')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#e0e0e0', marginBottom: 2 }}>{model.id}</div>
              <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem', color: '#666' }}>
                <span>↓ {model.downloads.toLocaleString()}</span>
                <span>♥ {model.likes}</span>
              </div>
            </div>
            <span style={{ color: '#555', fontSize: '1rem' }}>▸</span>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{dl.filename}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{dl.repo}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {dl.status === 'downloading' && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => window.tasmania.cancelDownload(dl.id)}
                >
                  Cancel
                </Button>
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background:
                    dl.status === 'completed' ? '#16532e' :
                    dl.status === 'error' ? '#3b1a1a' :
                    dl.status === 'cancelled' ? '#252525' :
                    dl.status === 'downloading' ? '#1a2744' :
                    '#252525',
                  color:
                    dl.status === 'completed' ? '#4ade80' :
                    dl.status === 'error' ? '#f87171' :
                    dl.status === 'cancelled' ? '#f59e0b' :
                    dl.status === 'downloading' ? '#60a5fa' :
                    '#888',
                }}
              >
                {dl.status}
              </span>
            </div>
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

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: '0.75rem',
  color: '#666',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const thClickStyle: React.CSSProperties = {
  ...thStyle,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#aaa',
};

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
