import { useEffect, useState } from 'react';
import type { PlaytestMark } from '../runtime/Game';
import { Section } from './controls';
import type { Editor } from './editor';

/**
 * Playtests (flagship Phase G): where players lost a life, got stuck or left, shown as marks on the level being
 * edited. Marks come from the editor's own try-outs and from testers' phones (sent with "امتحان روی گوشی",
 * through the local server). A Persian checklist for watching people play is in GUIDE-fa.md.
 */

type Game = { playtest: PlaytestMark[]; showMarks: (marks: PlaytestMark[]) => void };
const game = () => (window as unknown as { __game?: Game }).__game;

export function PlaytestPanel({ editor }: { editor: Editor }) {
  const { scene } = editor;
  const [marks, setMarks] = useState<PlaytestMark[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The marks follow the scene being edited.
  useEffect(() => {
    if (marks) game()?.showMarks(marks);
  }, [marks, scene.id]);

  const load = async () => {
    const own = [...(game()?.playtest ?? [])];
    let phones: PlaytestMark[] = [];
    try {
      const r = await fetch('/api/phone/playtest', { cache: 'no-store' });
      if (r.ok) phones = ((await r.json()) as { marks: PlaytestMark[] }).marks;
    } catch {
      // Opened as a file, with no server: only the try-outs here.
    }
    const all = [...own, ...phones];
    setMarks(all);
    setNote(all.length ? null : 'هنوز نشانه‌ای نیست: بازی را امتحان کن، یا بگذار کسی روی گوشی بازی کند.');
  };
  const clear = async () => {
    const g = game();
    if (g) g.playtest.length = 0;
    try {
      await fetch('/api/phone/playtest/clear', { method: 'POST' });
    } catch {
      // No server: nothing to clear there.
    }
    setMarks([]);
    g?.showMarks([]);
  };

  const here = (marks ?? []).filter((m) => m.scene === scene.id);
  const count = (kind: PlaytestMark['kind']) => here.filter((m) => m.kind === kind).length.toLocaleString('fa-IR');
  return (
    <Section title="امتحان با دیگران" about="جاهایی که بازیکن‌ها جان از دست دادند (قرمز)، گیر کردند (نارنجی) یا بازی را بستند (خاکستری)، روی همین صحنه. از امتحان‌های خودت و از گوشی‌هایی که با «امتحان روی گوشی» بازی کرده‌اند جمع می‌شود. چک‌لیست تماشای بازی دیگران در راهنما است.">
      <div className="adders">
        <button type="button" className="chip" data-playtest-show onClick={() => void load()}>نشان دادن روی مرحله</button>
        <button type="button" className="chip" data-playtest-clear onClick={() => void clear()}>پاک کردن، برای دور تازه</button>
      </div>
      {marks && (
        <p className="hint" data-playtest-counts>
          در این صحنه: {count('hurt')} جان از دست رفته · {count('stuck')} گیر کردن · {count('quit')} بستن بازی
        </p>
      )}
      {note && <p className="hint">{note}</p>}
    </Section>
  );
}
