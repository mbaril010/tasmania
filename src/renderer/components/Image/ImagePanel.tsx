import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import Button from '../Common/Button';
import StatusIndicator from '../Common/StatusIndicator';
import type { ImageGenerationResult, ModelResolution } from '../../../shared/types';

const IMAGE_MODEL_PATTERN = /(?:^|[_\-.\s])(sd|sdxl|flux|diffusion|stable.?diffusion|turbo|lora|z[_\-.]?image)(?=[_\-.\s]|$)/i;

interface GeneratedImage extends ImageGenerationResult {
  prompt: string;
  width: number;
  height: number;
}

const ImagePanel: React.FC = () => {
  const { models, settings, imageServerState: serverState } = useApp();

  const [selectedModel, setSelectedModel] = useState('');
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Generation params
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(settings?.stableDiffusion?.defaultSteps ?? 20);
  const [cfgScale, setCfgScale] = useState(settings?.stableDiffusion?.defaultCfgScale ?? 7.0);
  const [width, setWidth] = useState(settings?.stableDiffusion?.defaultWidth ?? 512);
  const [height, setHeight] = useState(settings?.stableDiffusion?.defaultHeight ?? 512);
  const [seed, setSeed] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Model resolution
  const [resolution, setResolution] = useState<ModelResolution | null>(null);

  // Results
  const [images, setImages] = useState<GeneratedImage[]>([]);

  // Filter models to image-relevant ones
  const imageModels = models.filter((m) => IMAGE_MODEL_PATTERN.test(m.filename));

  // Resolve model when selection changes
  useEffect(() => {
    if (!selectedModel) {
      setResolution(null);
      return;
    }
    window.tasmania.image.resolveModel(selectedModel).then(setResolution).catch(() => setResolution(null));
  }, [selectedModel]);

  // Clear loading state when server state changes
  useEffect(() => {
    if (serverState.status !== 'starting') {
      setServerLoading(false);
    }
  }, [serverState.status]);

  const handleStart = async () => {
    if (!selectedModel) return;
    setServerLoading(true);
    setServerError(null);
    try {
      await window.tasmania.image.start(selectedModel);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setServerLoading(false);
    }
  };

  const handleStop = async () => {
    setServerLoading(true);
    setServerError(null);
    try {
      await window.tasmania.image.stop();
      setImages([]);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
      setServerLoading(false);
    }
  };

  const handleDownload = (img: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${img.b64}`;
    const slug = img.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, '_').replace(/_+$/, '');
    link.download = `${slug}_${img.seed}.png`;
    link.click();
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenError(null);
    try {
      const result = await window.tasmania.image.generate({
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        width,
        height,
        steps,
        cfgScale,
        seed: seed ? parseInt(seed) : undefined,
      });
      setImages((prev) => [
        { ...result, prompt: prompt.trim(), width, height },
        ...prev,
      ]);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    }
    setGenerating(false);
  };

  const isRunning = serverState.status === 'running';
  const isStopped = serverState.status === 'stopped';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Server Control */}
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 10,
          border: '1px solid #2a2a2a',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <StatusIndicator status={serverState.status} />
          {isRunning && serverState.modelName && (
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              Model: <strong style={{ color: '#ccc' }}>{serverState.modelName}</strong>
            </span>
          )}
        </div>

        {isStopped && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#252525',
                border: '1px solid #333',
                borderRadius: 8,
                color: '#e0e0e0',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
              }}
            >
              <option value="">-- Select Image Model --</option>
              {imageModels.map((m) => (
                <option key={m.path} value={m.path}>
                  {m.filename} ({formatBytes(m.sizeBytes)})
                </option>
              ))}
            </select>
            <Button onClick={handleStart} disabled={!selectedModel || serverLoading || (resolution !== null && !resolution.ready)}>
              {serverLoading ? 'Starting...' : 'Start'}
            </Button>
          </div>
        )}

        {/* Companion file status for multi-file models */}
        {isStopped && resolution && resolution.companions.length > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: '10px 12px',
              background: '#222',
              borderRadius: 8,
              border: '1px solid #333',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {resolution.arch} model — companion files
            </div>
            {resolution.companions.map((c) => (
              <div
                key={c.role}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '3px 0',
                  fontSize: '0.83rem',
                }}
              >
                <span style={{ color: c.found ? '#4ade80' : c.required ? '#f87171' : '#666' }}>
                  {c.found ? '\u2713' : c.required ? '\u2717' : '\u2014'}
                </span>
                <span style={{ color: c.found ? '#ccc' : '#888' }}>
                  {c.role}
                </span>
                {c.found && c.path && (
                  <span style={{ color: '#555', fontSize: '0.75rem', marginLeft: 'auto' }}>
                    {c.path.split('/').pop()}
                  </span>
                )}
                {!c.found && c.required && (
                  <span style={{ color: '#f87171', fontSize: '0.75rem', fontStyle: 'italic', marginLeft: 'auto' }}>
                    missing
                  </span>
                )}
              </div>
            ))}
            {!resolution.ready && (
              <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: 6 }}>
                Download the missing files to the same directory as the model.
              </div>
            )}
          </div>
        )}

        {!isStopped && (
          <Button variant="danger" onClick={handleStop} disabled={serverLoading}>
            {serverLoading ? 'Stopping...' : 'Stop Server'}
          </Button>
        )}

        {imageModels.length === 0 && isStopped && (
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: 8 }}>
            No image models found. Download a Stable Diffusion GGUF model from the Models tab.
          </div>
        )}

        {serverError && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 12px',
              background: '#3b1a1a',
              borderRadius: 6,
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {serverError}
          </div>
        )}
      </div>

      {/* Generation Form */}
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 10,
          border: '1px solid #2a2a2a',
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Prompt:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A beautiful sunset over mountains, high quality, detailed..."
            rows={3}
            style={{
              ...inputStyle,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
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
            placeholder="blurry, low quality, deformed..."
            style={{ ...inputStyle, width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Steps:</label>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value) || 20)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div>
            <label style={labelStyle}>CFG Scale:</label>
            <input
              type="number"
              step="0.5"
              value={cfgScale}
              onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7.0)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Width:</label>
            <input
              type="number"
              step="64"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 512)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Height:</label>
            <input
              type="number"
              step="64"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 512)}
              style={{ ...inputStyle, width: 80 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Seed:</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Random"
              style={{ ...inputStyle, width: 100 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            onClick={handleGenerate}
            disabled={!isRunning || !prompt.trim() || generating}
          >
            {generating ? 'Generating...' : 'Generate'}
          </Button>
          {!isRunning && (
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              Start the image server to generate
            </span>
          )}
        </div>

        {genError && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 12px',
              background: '#3b1a1a',
              borderRadius: 6,
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            {genError}
          </div>
        )}
      </div>

      {/* Results */}
      {images.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {images.map((img, i) => (
            <div
              key={i}
              style={{
                background: '#1a1a1a',
                borderRadius: 10,
                border: '1px solid #2a2a2a',
                padding: 12,
              }}
            >
              <img
                src={`data:image/png;base64,${img.b64}`}
                alt={img.prompt}
                style={{
                  width: '100%',
                  maxWidth: img.width,
                  borderRadius: 8,
                  display: 'block',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#ccc', marginBottom: 4 }}>
                    {img.prompt.length > 100 ? img.prompt.slice(0, 100) + '...' : img.prompt}
                  </div>
                  <span>{img.width}x{img.height}</span>
                  <span style={{ marginLeft: 12 }}>{(img.timingMs / 1000).toFixed(1)}s</span>
                  {img.seed >= 0 && <span style={{ marginLeft: 12 }}>seed: {img.seed}</span>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleDownload(img)}>
                  Save
                </Button>
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default ImagePanel;
