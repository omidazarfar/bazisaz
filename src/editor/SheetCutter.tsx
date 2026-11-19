import { useEffect, useRef, useState } from 'react';
import { NumberField, Slider } from './controls';
import { fa } from './labels';

/** A guess at how a sheet is cut: a strip of square pictures side by side (or one above another) is the usual case. */
function guess(width: number, height: number): { cols: number; rows: number } {
  if (width >= height * 2 && width % height === 0) return { cols: width / height, rows: 1 };
  if (height >= width * 2 && height % width === 0) return { cols: 1, rows: height / width };
  return { cols: Math.max(1, Math.min(16, Math.round(width / height))), rows: 1 };
}

/** Cuts the pictures out of the sheet, left to right and top to bottom, as PNG data: URLs. */
async function cut(src: string, cols: number, rows: number, count: number): Promise<{ frames: string[]; width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const width = Math.floor(img.width / cols);
  const height = Math.floor(img.height / rows);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    g.clearRect(0, 0, width, height);
    g.drawImage(img, (i % cols) * width, Math.floor(i / cols) * height, width, height, 0, 0, width, height);
    frames.push(canvas.toDataURL('image/png'));
  }
  return { frames, width, height };
}

/**
 * Turns one picture holding every step of an animation (a "sprite sheet",
 * as artists and asset sites usually give them) into an animated object: the
 * user says how many columns and rows it has, sees the grid and the animation
 * playing, and the pieces become the object's pictures.
 */
export function SheetCutter({ src, width, height, onDone, onCancel }: {
  src: string;
  width: number;
  height: number;
  onDone: (frames: string[], fps: number, size: { width: number; height: number }) => void;
  onCancel: () => void;
}) {
  const first = guess(width, height);
  const [cols, setCols] = useState(first.cols);
  const [rows, setRows] = useState(first.rows);
  const [count, setCount] = useState(first.cols * first.rows);
  const [fps, setFps] = useState(10);
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const total = Math.max(1, Math.min(count, cols * rows));

  useEffect(() => {
    const img = new Image();
    img.src = src;
    image.current = img;
  }, [src]);

  // The animation plays in a corner, so the cut can be judged before it is made.
  useEffect(() => {
    let frame = 0;
    const timer = setInterval(() => {
      const c = preview.current;
      const img = image.current;
      if (!c || !img?.complete) return;
      const g = c.getContext('2d')!;
      const [fw, fh] = [img.width / cols, img.height / rows];
      const scale = Math.min(c.width / fw, c.height / fh);
      g.clearRect(0, 0, c.width, c.height);
      g.imageSmoothingEnabled = false;
      const i = frame % total;
      g.drawImage(img, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, (c.width - fw * scale) / 2, (c.height - fh * scale) / 2, fw * scale, fh * scale);
      frame += 1;
    }, 1000 / Math.max(1, fps));
    return () => clearInterval(timer);
  }, [cols, rows, total, fps]);

  const shown = Math.min(1, 420 / width, 300 / height);
  return (
    <div className="sheet-cutter">
      <div className="sheet-main">
        <div className="sheet-image" style={{ width: width * shown, height: height * shown }}>
          <img src={src} alt="عکس چندتکه" width={width * shown} height={height * shown} />
          <svg className="sheet-grid" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: cols - 1 }, (_, i) => <line key={`c${i}`} x1={((i + 1) * width) / cols} x2={((i + 1) * width) / cols} y1={0} y2={height} />)}
            {Array.from({ length: rows - 1 }, (_, i) => <line key={`r${i}`} y1={((i + 1) * height) / rows} y2={((i + 1) * height) / rows} x1={0} x2={width} />)}
          </svg>
        </div>
        <div className="sheet-side">
          <canvas ref={preview} width={140} height={140} className="sheet-preview" aria-label="پیش‌نمایش انیمیشن" />
          <p className="control-hint">عکس <bdi dir="ltr">{width}×{height}</bdi> است؛ هر تکه <bdi dir="ltr">{Math.floor(width / cols)}×{Math.floor(height / rows)}</bdi>.</p>
        </div>
      </div>
      <div className="pair">
        <NumberField label="چند ستون" value={cols} onChange={(n) => { const c = Math.max(1, Math.min(64, Math.round(n))); setCols(c); setCount(c * rows); }} />
        <NumberField label="چند ردیف" value={rows} onChange={(n) => { const r = Math.max(1, Math.min(64, Math.round(n))); setRows(r); setCount(cols * r); }} />
      </div>
      <NumberField label="چند تکه استفاده شود" hint="اگر خانه‌های آخر عکس خالی‌اند، این عدد را کمتر کن." value={total} onChange={(n) => setCount(Math.max(1, Math.round(n)))} />
      <Slider label="سرعت انیمیشن" unit="عکس در ثانیه" min={1} max={30} step={1} value={fps} onChange={setFps} />
      <div className="dialog-actions">
        <button
          type="button"
          className="block block-small"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void cut(src, cols, rows, total).then(({ frames, width: w, height: h }) => onDone(frames, fps, { width: w, height: h }));
          }}
        >
          ساختن شیء با {fa(total)} عکس
        </button>
        <button type="button" className="btn" onClick={onCancel}>انصراف</button>
      </div>
    </div>
  );
}
