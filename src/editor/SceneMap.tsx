import { ruleActions, type GameProject } from '../format/types';

/**
 * Every scene of the game as a card, with an arrow for each way a rule leads
 * from one to another ("go to scene", or "next scene" to the one after it).
 * The start scene has a star; the one being edited is outlined. Tapping a card opens it.
 */
export function SceneMap(props: { project: GameProject; current: string; onOpen: (id: string) => void }) {
  const { project } = props;
  const scenes = project.scenes;
  const cols = Math.min(3, Math.max(1, scenes.length));
  const [w, h, gx, gy] = [150, 64, 40, 46];
  const place = (i: number) => ({ x: 10 + (i % cols) * (w + gx), y: 10 + Math.floor(i / cols) * (h + gy) });
  const index = new Map(scenes.map((s, i) => [s.id, i]));
  const links = new Set<string>();
  scenes.forEach((s, i) => {
    for (const rule of s.rules) {
      for (const a of ruleActions(rule)) {
        const to = a.type === 'goToScene' ? index.get(a.scene) : a.type === 'nextScene' ? (i + 1 < scenes.length ? i + 1 : undefined) : undefined;
        if (to !== undefined && to !== i) links.add(i + '>' + to);
      }
    }
  });
  const width = 20 + cols * w + (cols - 1) * gx;
  const height = 20 + Math.ceil(scenes.length / cols) * (h + gy) - gy;
  return (
    <svg className="scene-map" viewBox={'0 0 ' + width + ' ' + height} width="100%" role="img" aria-label="نقشه‌ی صحنه‌ها">
      <defs>
        <marker id="scene-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="#7a8aa6" />
        </marker>
      </defs>
      {[...links].map((key) => {
        const [a, b] = key.split('>').map(Number);
        const [p, q] = [place(a), place(b)];
        const [x1, y1, x2, y2] = [p.x + w / 2, p.y + h / 2, q.x + w / 2, q.y + h / 2];
        // From edge to edge of the cards, not middle to middle; two-way links bend apart.
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const pad = Math.min(w, h) / 2 + 6;
        const bend = links.has(b + '>' + a) ? 14 : 0;
        const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len];
        const sx = x1 + ((x2 - x1) / len) * pad;
        const sy = y1 + ((y2 - y1) / len) * pad;
        const ex = x2 - ((x2 - x1) / len) * pad;
        const ey = y2 - ((y2 - y1) / len) * pad;
        const mx = (sx + ex) / 2 + nx * bend;
        const my = (sy + ey) / 2 + ny * bend;
        return <path key={key} d={`M${sx} ${sy}Q${mx} ${my} ${ex} ${ey}`} fill="none" stroke="#7a8aa6" strokeWidth="2.5" markerEnd="url(#scene-arrow)" data-link={key} />;
      })}
      {scenes.map((s, i) => {
        const { x, y } = place(i);
        const here = s.id === props.current;
        return (
          <g key={s.id} data-scene-card={s.id} style={{ cursor: 'pointer' }} onClick={() => props.onOpen(s.id)}>
            <rect x={x} y={y} width={w} height={h} rx="12" fill={here ? '#2f7cf6' : '#24314a'} stroke={here ? '#9cc3ff' : '#3c4c6b'} strokeWidth="2.5" />
            <text x={x + w / 2} y={y + 28} textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">{s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name}</text>
            <text x={x + w / 2} y={y + 50} textAnchor="middle" fill="#b8c4d8" fontSize="12">{s.objects.length.toLocaleString('fa-IR')} شیء</text>
            {project.startScene === s.id && <text x={x + 12} y={y + 22} fontSize="16">⭐</text>}
          </g>
        );
      })}
    </svg>
  );
}
