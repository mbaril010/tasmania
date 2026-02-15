import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import Button from '../Common/Button';
import StatusIndicator from '../Common/StatusIndicator';
import type { VideoGenerationResult } from '../../../shared/types';

type VideoMode = 'txt2vid' | 'img2vid';

interface GeneratedVideo extends VideoGenerationResult {
  prompt: string;
}

const VideoPanel: React.FC = () => {
  const { settings, videoServerState: serverState } = useApp();

  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Sub-mode
  const [mode, setMode] = useState<VideoMode>('txt2vid');

  // Source images (img2vid, multiple)
  const [initImages, setInitImages] = useState<string[]>([]);
  const [initImagePreviews, setInitImagePreviews] = useState<string[]>([]);
  const [denoisingStrength, setDenoisingStrength] = useState(0.75);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Generation params
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7.0);
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [frameCount, setFrameCount] = useState(16);
  const [fps, setFps] = useState(8);
  const [seed, setSeed] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Progress
  const [progress, setProgress] = useState<{ value: number; max: number } | null>(null);

  // Results
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);

  const comfyuiConfigured = !!settings?.comfyui?.path;

  useEffect(() => {
    if (serverState.status !== 'starting') {
      setServerLoading(false);
    }
  }, [serverState.status]);

  // Subscribe to progress events
  useEffect(() => {
    const unsub = window.tasmania.video.onProgress((data) => {
      setProgress(data);
    });
    return () => { unsub(); };
  }, []);

  const processFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        setInitImagePreviews((prev) => [...prev, dataUrl]);
        setInitImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFiles]);

  const handleRemoveImage = (index: number) => {
    setInitImages((prev) => prev.filter((_, i) => i !== index));
    setInitImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStart = async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      await window.tasmania.video.start();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setServerLoading(false);
    }
  };

  const handleStop = async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      await window.tasmania.video.stop();
      setVideos([]);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setServerLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await window.tasmania.video.cancel();
    } catch {
      // Ignore cancel errors
    }
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    if (mode === 'img2vid' && initImages.length === 0) { setGenError('At least one source image is required'); return; }
    setGenerating(true);
    setGenError(null);
    setProgress(null);
    try {
      let result: VideoGenerationResult;
      if (mode === 'txt2vid') {
        result = await window.tasmania.video.generateTxt2Vid({
          prompt: trimmedPrompt,
          negativePrompt: negativePrompt.trim() || undefined,
          width, height, frameCount, fps, steps, cfgScale,
          seed: seed ? parseInt(seed) : undefined,
        });
      } else {
        result = await window.tasmania.video.generateImg2Vid({
          prompt: trimmedPrompt,
          negativePrompt: negativePrompt.trim() || undefined,
          width, height, frameCount, fps, steps, cfgScale,
          seed: seed ? parseInt(seed) : undefined,
          initImages,
          denoisingStrength,
        });
      }
      setVideos((prev) => [{ ...result, prompt: trimmedPrompt }, ...prev]);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
    setGenerating(false);
    setProgress(null);
  };

  const isRunning = serverState.status === 'running';
  const isStopped = serverState.status === 'stopped';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Server Control */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <StatusIndicator status={serverState.status} />
          <span style={{ fontSize: '0.8rem', color: '#888' }}>ComfyUI</span>
        </div>

        {!comfyuiConfigured && isStopped && (
          <div style={{ padding: '12px', background: '#1a1a2e', borderRadius: 8, border: '1px solid #2a2a4a', fontSize: '0.85rem', color: '#8888cc' }}>
            ComfyUI path not configured. Set it in <strong>Settings</strong> under "Video (ComfyUI)".
          </div>
        )}

        {comfyuiConfigured && isStopped && (
          <Button onClick={handleStart} disabled={serverLoading}>
            {serverLoading ? 'Starting...' : 'Start ComfyUI'}
          </Button>
        )}

        {!isStopped && (
          <Button variant="danger" onClick={handleStop} disabled={serverLoading}>
            {serverLoading ? 'Stopping...' : 'Stop ComfyUI'}
          </Button>
        )}

        {serverError && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#3b1a1a', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>
            {serverError}
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#141414', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {(['txt2vid', 'img2vid'] as VideoMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: mode === m ? '#333' : 'transparent',
              color: mode === m ? '#fff' : '#888',
              cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: mode === m ? 600 : 400, fontFamily: 'inherit',
              transition: 'all 0.15s ease',
            }}
          >
            {m === 'txt2vid' ? 'Text to Video' : 'Image to Video'}
          </button>
        ))}
      </div>

      {/* Source Images (img2vid only) */}
      {mode === 'img2vid' && (
        <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
          <label style={labelStyle}>Source Images:</label>
          {initImagePreviews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {initImagePreviews.map((preview, i) => (
                <div key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={preview}
                    alt={`Source ${i + 1}`}
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                  <button
                    onClick={() => handleRemoveImage(i)}
                    title="Remove image"
                    style={{
                      position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)',
                      color: '#f87171', fontSize: '0.75rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#4ade80' : '#444'}`,
              borderRadius: 10, padding: initImagePreviews.length > 0 ? '12px 16px' : '24px 16px',
              textAlign: 'center', cursor: 'pointer', color: '#666', fontSize: '0.85rem',
              transition: 'border-color 0.15s',
            }}
          >
            {initImagePreviews.length > 0 ? 'Drop or click to add more images' : 'Drop images here or click to browse'}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Denoising Strength: {denoisingStrength.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.05" value={denoisingStrength} onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555' }}>
              <span>0 (keep original)</span>
              <span>1 (full reimagine)</span>
            </div>
          </div>
        </div>
      )}

      {/* Generation Form */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Prompt:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={mode === 'txt2vid' ? 'A cat walking in a garden, smooth motion...' : 'Animate this image with gentle motion...'}
            rows={3}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isRunning && prompt.trim()) {
                handleGenerate();
              }
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Negative prompt:</label>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="blurry, low quality, jitter..."
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Frames:</label>
            <input type="number" value={frameCount} onChange={(e) => setFrameCount(parseInt(e.target.value) || 16)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>FPS:</label>
            <input type="number" value={fps} onChange={(e) => setFps(parseInt(e.target.value) || 8)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Steps:</label>
            <input type="number" value={steps} onChange={(e) => setSteps(parseInt(e.target.value) || 20)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>CFG Scale:</label>
            <input type="number" step="0.5" value={cfgScale} onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7.0)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Width:</label>
            <input type="number" step="64" value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 512)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Height:</label>
            <input type="number" step="64" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 512)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>Seed:</label>
            <input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" style={{ ...inputStyle, width: 100 }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button onClick={handleGenerate} disabled={!isRunning || !prompt.trim() || generating || (mode === 'img2vid' && initImages.length === 0)}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
          {generating && (
            <Button variant="danger" size="sm" onClick={handleCancel}>Cancel</Button>
          )}
          {!isRunning && (
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Start ComfyUI to generate</span>
          )}
        </div>

        {/* Progress bar */}
        {generating && progress && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>
              <span>Progress</span>
              <span>{progress.value}/{progress.max}</span>
            </div>
            <div style={{ background: '#252525', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                background: '#4ade80', height: '100%', borderRadius: 4,
                width: `${(progress.value / progress.max) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {genError && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#3b1a1a', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>
            {genError}
          </div>
        )}
      </div>

      {/* Results */}
      {videos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {videos.map((vid, i) => (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 12, position: 'relative' }}>
              <button
                onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
                title="Remove"
                style={{
                  position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                  borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                  color: '#f87171', fontSize: '1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}
              >
                x
              </button>
              {vid.filePath ? (
                <video
                  src={`file://${vid.filePath}`}
                  controls
                  loop
                  style={{ width: '100%', maxWidth: vid.fps * vid.frameCount > 0 ? undefined : 512, borderRadius: 8, display: 'block', marginBottom: 8 }}
                />
              ) : (
                <div style={{ padding: 16, color: '#666', fontSize: '0.85rem' }}>Video file not available</div>
              )}
              <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#ccc', marginBottom: 4 }}>
                    {vid.prompt.length > 100 ? vid.prompt.slice(0, 100) + '...' : vid.prompt}
                  </div>
                  <span>{vid.frameCount} frames</span>
                  <span style={{ marginLeft: 12 }}>{vid.fps} fps</span>
                  <span style={{ marginLeft: 12 }}>{vid.durationSeconds.toFixed(1)}s</span>
                  <span style={{ marginLeft: 12 }}>{(vid.timingMs / 1000).toFixed(1)}s gen time</span>
                </div>
                {vid.filePath && (
                  <Button size="sm" variant="secondary" onClick={() => window.tasmania.openPath(vid.filePath)}>
                    Open
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#888',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: '#252525',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#e0e0e0',
  fontSize: '0.85rem',
};

export default VideoPanel;
