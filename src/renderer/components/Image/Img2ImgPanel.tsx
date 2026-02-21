import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../contexts/AppContext';
import Button from '../Common/Button';
import InfoTip from '../Common/InfoTip';
import StatusIndicator from '../Common/StatusIndicator';
import type { ImageGenerationResult, ModelResolution } from '../../../shared/types';

interface GeneratedImage extends ImageGenerationResult {
  prompt: string;
  width: number;
  height: number;
}

const Img2ImgPanel: React.FC = () => {
  const { models, settings, imageServerState: serverState } = useApp();

  const [selectedModel, setSelectedModel] = useState('');
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Source images (multiple)
  const [initImages, setInitImages] = useState<string[]>([]);
  const [initImagePreviews, setInitImagePreviews] = useState<string[]>([]);
  const [initImageNames, setInitImageNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Generation params
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(settings?.stableDiffusion?.defaultSteps ?? 8);
  const [cfgScale, setCfgScale] = useState(settings?.stableDiffusion?.defaultCfgScale ?? 1.0);
  const [width, setWidth] = useState(settings?.stableDiffusion?.defaultWidth ?? 1024);
  const [height, setHeight] = useState(settings?.stableDiffusion?.defaultHeight ?? 1024);
  const [seed, setSeed] = useState('');
  const [denoisingStrength, setDenoisingStrength] = useState(0.75);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Model resolution
  const [resolution, setResolution] = useState<ModelResolution | null>(null);

  // Results
  const [images, setImages] = useState<GeneratedImage[]>([]);

  const imageModels = models.filter((m) => m.category === 'image');

  useEffect(() => {
    if (!selectedModel) {
      setResolution(null);
      return;
    }
    window.tasmania.image.resolveModel(selectedModel).then(setResolution).catch(() => setResolution(null));
  }, [selectedModel]);

  useEffect(() => {
    if (serverState.status !== 'starting') {
      setServerLoading(false);
    }
  }, [serverState.status]);

  const processFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        setInitImagePreviews((prev) => [...prev, dataUrl]);
        setInitImages((prev) => [...prev, base64]);
        setInitImageNames((prev) => [...prev, file.name]);
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
    setInitImageNames((prev) => prev.filter((_, i) => i !== index));
  };

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
    link.download = `img2img_${slug}_${img.seed}.png`;
    link.click();
  };

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;
    if (initImages.length === 0) { setGenError('At least one source image is required'); return; }
    if (trimmedPrompt.length > 10_000) { setGenError('Prompt too long (max 10,000 chars)'); return; }
    if (width < 64 || width > 2048) { setGenError('Width must be 64-2048'); return; }
    if (height < 64 || height > 2048) { setGenError('Height must be 64-2048'); return; }
    if (steps < 1 || steps > 150) { setGenError('Steps must be 1-150'); return; }
    if (cfgScale < 0 || cfgScale > 30) { setGenError('CFG scale must be 0-30'); return; }
    setGenerating(true);
    setGenError(null);
    try {
      const result = await window.tasmania.image.generateImg2Img({
        prompt: trimmedPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        width,
        height,
        steps,
        cfgScale,
        seed: seed ? parseInt(seed) : undefined,
        initImages,
        denoisingStrength,
      });
      setImages((prev) => [
        { ...result, prompt: trimmedPrompt, width, height },
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
      <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
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
                flex: 1, padding: '8px 12px', background: '#252525',
                border: '1px solid #333', borderRadius: 8, color: '#e0e0e0',
                fontSize: '0.85rem', fontFamily: 'inherit',
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

        {isStopped && resolution && resolution.companions.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: '#222', borderRadius: 8, border: '1px solid #333' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {resolution.arch} model — companion files
            </div>
            {resolution.companions.map((c) => (
              <div key={c.role} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: '0.83rem' }}>
                <span style={{ color: c.found ? '#4ade80' : c.required ? '#f87171' : '#666' }}>
                  {c.found ? '\u2713' : c.required ? '\u2717' : '\u2014'}
                </span>
                <span style={{ color: c.found ? '#ccc' : '#888' }}>{c.role}</span>
                {c.found && c.path && (
                  <span style={{ color: '#555', fontSize: '0.75rem', marginLeft: 'auto' }}>{c.path.split('/').pop()}</span>
                )}
                {!c.found && c.required && (
                  <span style={{ color: '#f87171', fontSize: '0.75rem', fontStyle: 'italic', marginLeft: 'auto' }}>missing</span>
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
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#3b1a1a', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>
            {serverError}
          </div>
        )}
      </div>

      {/* Source Images */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
        <label style={labelStyle}>Source Images:</label>
        {initImagePreviews.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {initImagePreviews.map((preview, i) => (
              <div key={i} style={{ position: 'relative', display: 'inline-block', width: 96 }}>
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
                {initImageNames[i] && (
                  <div
                    title={initImageNames[i]}
                    style={{
                      fontSize: '0.65rem', color: '#777', marginTop: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {initImageNames[i]}
                  </div>
                )}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Generation Form */}
      <div style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Prompt:</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the changes you want to apply to the image..."
            rows={3}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isRunning && prompt.trim() && initImages.length > 0) {
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

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>
            Denoising Strength: {denoisingStrength.toFixed(2)}
            <InfoTip text="Controls how much the AI changes your source image. Low (0.2–0.4): subtle tweaks, keeps source recognizable. Medium (0.4–0.6): reshapes details, keeps composition. High (0.7+): almost full regeneration, source barely visible." />
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={denoisingStrength}
            onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#555' }}>
            <span>0 (keep original)</span>
            <span>1 (full reimagine)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Steps:<InfoTip text="Number of refinement passes. Use 4–8 for turbo/distilled models, 15–25 for standard models. More steps = more refined but slower." /></label>
            <input type="number" value={steps} onChange={(e) => setSteps(parseInt(e.target.value) || 20)} style={{ ...inputStyle, width: 80 }} />
          </div>
          <div>
            <label style={labelStyle}>CFG Scale:<InfoTip text="How strictly the AI follows your prompt. Low (1–3): creative/loose. Medium (3–5): balanced. High (7+): strict but can oversaturate." /></label>
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
          <Button onClick={handleGenerate} disabled={!isRunning || !prompt.trim() || initImages.length === 0 || generating}>
            {generating ? 'Generating...' : 'Generate'}
          </Button>
          {!isRunning && (
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Start the image server to generate</span>
          )}
          {isRunning && initImages.length === 0 && (
            <span style={{ fontSize: '0.8rem', color: '#666' }}>Add source image(s) above</span>
          )}
        </div>

        {genError && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#3b1a1a', borderRadius: 6, color: '#f87171', fontSize: '0.85rem' }}>
            {genError}
          </div>
        )}
      </div>

      {/* Results */}
      {images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {images.map((img, i) => (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', padding: 12, position: 'relative' }}>
              <button
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                title="Delete image"
                style={{
                  position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                  borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                  color: '#f87171', fontSize: '1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                }}
              >
                x
              </button>
              <img
                src={`data:image/png;base64,${img.b64}`}
                alt={img.prompt}
                style={{ width: '100%', maxWidth: img.width, borderRadius: 8, display: 'block', marginBottom: 8 }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {img.savedPath && (
                    <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>Saved</span>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => handleDownload(img)}>Save</Button>
                </div>
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

export default Img2ImgPanel;
