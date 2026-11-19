import { useEffect, useRef, useState } from 'react';
import { fa, PALETTE } from './labels';

/** A small picture drawn cell by cell: `size` cells a side, each a colour or empty (null). */
export interface PixelArt {
  size: number;
  cells: (string | null)[];
}

/** Each cell becomes a square this many pixels across in the saved picture, so it stays crisp when scaled. */
const SCALE = 8;
const SIZES = [16, 24, 32];
const VIEW = 384;
const COLORS = ['#000000', '#ffffff', '#5d4037', '#9e9e9e', ...PALETTE];

export const emptyArt = (size: number): PixelArt => ({ size, cells: Array<string | null>(size * size).fill(null) });

/** The picture as a PNG data: URL, each cell a solid square. */
export function artToPng(art: PixelArt): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = art.size * SCALE;
  const g = canvas.getContext('2d')!;
  art.cells.forEach((color, i) => {
    if (!color) return;
    g.fillStyle = color;
    g.fillRect((i % art.size) * SCALE, Math.floor(i / art.size) * SCALE, SCALE, SCALE);
  });
  return canvas.toDataURL('image/png');
}

/** Reads back a picture saved by `artToPng`, by looking at the middle of each cell. */
export async function pngToArt(src: string, size: number): Promise<PixelArt> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, img.width, img.height).data;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const cells = Array.from({ length: size * size }, (_, i) => {
    const x = Math.floor(((i % size) + 0.5) * (img.width / size));
    const y = Math.floor((Math.floor(i / size) + 0.5) * (img.height / size));
    const at = (y * img.width + x) * 4;
    return data[at + 3] < 128 ? null : `#${hex(data[at])}${hex(data[at + 1])}${hex(data[at + 2])}`;
  });
  return { size, cells };
}

/** Grows or shrinks a picture to another number of cells, keeping it in the top-left corner. */
function resized(art: PixelArt, size: number): PixelArt {
  const next = emptyArt(size);
  for (let y = 0; y < Math.min(size, art.size); y++) {
    for (let x = 0; x < Math.min(size, art.size); x++) next.cells[y * size + x] = art.cells[y * art.size + x];
  }
  return next;
}

/**
 * A small painting program for pixel pictures: a pencil, an eraser, a bucket
 * that fills an area, a dropper that picks a colour up, and a mirror that
 * paints both halves at once (handy for faces and ships).
 */
export function PixelEditor({ initial, onDone, onCancel }: { initial?: PixelArt; onDone: (art: PixelArt, png: string) => void; onCancel: () => void }) {
  const [art, setArt] = useState<PixelArt>(initial ?? emptyArt(16));
  const [history, setHistory] = useState<PixelArt[]>([]);
  const [color, setColor] = useState('#ff5a5f');
  const [tool, setTool] = useState<'pen' | 'eraser' | 'fill' | 'picker'>('pen');
  const [mirror, setMirror] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  /** The picture as it was when the current stroke began, for "undo". */
  const strokeStart = useRef<PixelArt | null>(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    const cell = VIEW / art.size;
    g.clearRect(0, 0, VIEW, VIEW);
    // A checkerboard shows where the picture is see-through.
    for (let y = 0; y < art.size; y++) {
      for (let x = 0; x < art.size; x++) {
        const color = art.cells[y * art.size + x];
        g.fillStyle = color ?? ((x + y) % 2 === 0 ? '#ffffff' : '#e3eef4');
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    g.strokeStyle = 'rgba(27, 58, 75, 0.15)';
    g.lineWidth = 1;
    for (let i = 0; i <= art.size; i++) {
      g.beginPath();
      g.moveTo(i * cell + 0.5, 0);
      g.lineTo(i * cell + 0.5, VIEW);
      g.moveTo(0, i * cell + 0.5);
      g.lineTo(VIEW, i * cell + 0.5);
      g.stroke();
    }
    if (mirror) {
      g.strokeStyle = '#ff6d00';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(VIEW / 2, 0);
      g.lineTo(VIEW / 2, VIEW);
      g.stroke();
    }
    const p = preview.current;
    if (p) {
      const pg = p.getContext('2d')!;
      pg.clearRect(0, 0, p.width, p.height);
      const s = p.width / art.size;
      art.cells.forEach((color, i) => {
        if (!color) return;
        pg.fillStyle = color;
        pg.fillRect((i % art.size) * s, Math.floor(i / art.size) * s, Math.ceil(s), Math.ceil(s));
      });
    }
  }, [art, mirror]);

  const cellAt = (ev: React.PointerEvent): number | null => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * art.size);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * art.size);
    return x >= 0 && y >= 0 && x < art.size && y < art.size ? y * art.size + x : null;
  };

  /** Paints one cell (and its mirror image), or fills, or picks a colour up. */
  const apply = (at: number) => {
    if (tool === 'picker') {
      const picked = art.cells[at];
      if (picked) {
        setColor(picked);
        setTool('pen');
      }
      return;
    }
    setArt((now) => {
      const cells = [...now.cells];
      const x = at % now.size;
      const y = Math.floor(at / now.size);
      if (tool === 'fill') {
        const from = now.cells[at];
        const to = color;
        if (from === to) return now;
        const stack = [at];
        while (stack.length > 0) {
          const i = stack.pop()!;
          if (cells[i] !== from) continue;
          cells[i] = to;
          const cx = i % now.size;
          if (cx > 0) stack.push(i - 1);
          if (cx < now.size - 1) stack.push(i + 1);
          if (i >= now.size) stack.push(i - now.size);
          if (i < now.size * (now.size - 1)) stack.push(i + now.size);
        }
        return { ...now, cells };
      }
      const paint = tool === 'eraser' ? null : color;
      cells[at] = paint;
      if (mirror) cells[y * now.size + (now.size - 1 - x)] = paint;
      return { ...now, cells };
    });
  };

  const down = (ev: React.PointerEvent) => {
    const at = cellAt(ev);
    if (at === null) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    strokeStart.current = art;
    apply(at);
  };
  const move = (ev: React.PointerEvent) => {
    if (!strokeStart.current || tool === 'fill' || tool === 'picker') return;
    const at = cellAt(ev);
    if (at !== null) apply(at);
  };
  const up = () => {
    if (strokeStart.current) setHistory((h) => [...h.slice(-30), strokeStart.current!]);
    strokeStart.current = null;
  };
  const change = (next: PixelArt) => {
    setHistory((h) => [...h.slice(-30), art]);
    setArt(next);
  };

  const TOOLS = [
    { id: 'pen', label: 'مداد' },
    { id: 'eraser', label: 'پاک‌کن' },
    { id: 'fill', label: 'سطل رنگ' },
    { id: 'picker', label: 'برداشتن رنگ' },
  ] as const;

  return (
    <div className="pixel-editor">
      <div className="pixel-main">
        <canvas
          ref={canvas}
          className="pixel-canvas"
          width={VIEW}
          height={VIEW}
          aria-label="صفحه‌ی نقاشی"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <div className="pixel-side">
          <div className="segmented pixel-tools" role="group" aria-label="ابزار نقاشی">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="pixel-colors" role="group" aria-label="رنگ">
            {COLORS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={c} aria-pressed={color === c} onClick={() => { setColor(c); if (tool !== 'fill') setTool('pen'); }} />
            ))}
            <label className="swatch swatch-custom" title="رنگ دلخواه">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="رنگ دلخواه" />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            <span>آینه‌ای: دو طرف با هم کشیده شوند</span>
          </label>
          <label className="grid-pick">
            اندازه‌ی شبکه
            <select aria-label="اندازه‌ی شبکه" value={art.size} onChange={(e) => change(resized(art, Number(e.target.value)))}>
              {SIZES.map((s) => <option key={s} value={s}>{fa(s)} در {fa(s)}</option>)}
            </select>
          </label>
          <div className="adders">
            <button type="button" className="chip" disabled={history.length === 0} onClick={() => { setArt(history.at(-1)!); setHistory((h) => h.slice(0, -1)); }}>یک قدم به عقب</button>
            <button type="button" className="chip" onClick={() => change(emptyArt(art.size))}>پاک کردن همه</button>
          </div>
          <div className="pixel-preview">
            <canvas ref={preview} width={96} height={96} aria-label="پیش‌نمایش" />
            <span>این‌طور در بازی دیده می‌شود</span>
          </div>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="block block-small" disabled={art.cells.every((c) => c === null)} onClick={() => onDone(art, artToPng(art))}>ذخیره‌ی نقاشی</button>
        <button type="button" className="btn" onClick={onCancel}>انصراف</button>
      </div>
    </div>
  );
}
