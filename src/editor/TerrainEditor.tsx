import { useRef, useState, type PointerEvent } from 'react';

export function TerrainEditor({ heights, color, onChange }: { heights: number[]; color: string; onChange: (h: number[]) => void }) {
  const [draft, setDraft] = useState<number[] | null>(null);
  const stroke = useRef<{ heights: number[]; index: number; pointer: number } | null>(null);
  const visible = draft ?? heights;
  const paint = (ev: PointerEvent<SVGSVGElement>, start: boolean) => {
    if (!ev.isPrimary || (start && ev.button !== 0)) return;
    const bounds = ev.currentTarget.getBoundingClientRect();
    const index = Math.round(Math.max(0, Math.min(1, (ev.clientX - bounds.left) / bounds.width)) * 64);
    const y = Math.max(0, Math.min(0.95, (ev.clientY - bounds.top) / bounds.height));
    if (start) {
      const samples = Array.from({ length: 65 }, (_, i) => {
        const x = i / 64 * (heights.length - 1);
        return heights[Math.floor(x)] + (heights[Math.ceil(x)] - heights[Math.floor(x)]) * (x % 1);
      });
      stroke.current = { index, heights: samples, pointer: ev.pointerId };
      ev.currentTarget.setPointerCapture(ev.pointerId);
    }
    const line = stroke.current;
    if (!line || ev.pointerId !== line.pointer) return;
    const previous = line.heights[line.index];
    for (let i = Math.min(index, line.index); i <= Math.max(index, line.index); i++) {
      line.heights[i] = index === line.index ? y : previous + (y - previous) * (i - line.index) / (index - line.index);
    }
    line.index = index;
    setDraft([...line.heights]);
  };
  const reset = () => { stroke.current = null; setDraft(null); };
  return <svg aria-label="خط بالای زمین" viewBox="0 0 320 120" preserveAspectRatio="none"
    style={{ width: '100%', height: 120, background: '#17273d', touchAction: 'none', cursor: 'crosshair' }}
    onPointerDown={ev => paint(ev, true)} onPointerMove={ev => paint(ev, false)}
    onPointerUp={ev => { if (stroke.current?.pointer === ev.pointerId) { paint(ev, false); onChange(stroke.current.heights); reset(); } }}
    onLostPointerCapture={reset} onPointerCancel={reset}>
    <polygon points={visible.map((y,i) => `${i * 320 / (visible.length - 1)},${120 * y}`).join(' ') + ' 320,120 0,120'} fill={color} stroke="#acdfa0" strokeWidth="2" />
  </svg>;
}
