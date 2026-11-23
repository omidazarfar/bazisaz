import { useState } from 'react';
import type { GameProject } from '../format/types';
import { Check, Select, Slider } from './controls';
import { fa } from './labels';
import { DEFAULT_LEVEL_OPTIONS, generateLevels, layoutKind, type LevelOptions } from './levelgen';
import { Dialog } from './Pick';
import { getScene } from './state';

const LAYOUT_NAMES = { runner: 'بام‌ها و شکاف‌های تازه', hopper: 'ارتفاع تازه‌ی شکاف لوله‌ها', bricks: 'شکل تازه‌ی دیوار آجرها' };

/**
 * The choices for making a game's next levels, and the button that makes
 * them: how many, how fast they get harder, and what changes from one to the next.
 */
export function LevelMaker(props: { project: GameProject; sceneId: string; onMade: (project: GameProject, first: string, note: string) => void; onClose: () => void }) {
  const [options, setOptions] = useState<LevelOptions>({ ...DEFAULT_LEVEL_OPTIONS, seed: Math.floor(Math.random() * 100000) });
  const set = (patch: Partial<LevelOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const scene = getScene(props.project, props.sceneId);
  const layout = layoutKind(scene);
  const make = () => {
    const made = generateLevels(props.project, props.sceneId, options);
    const note = `${fa(made.ids.length)} مرحله‌ی تازه بعد از «${scene.name}» ساخته شد${made.chained ? '، و هر مرحله به مرحله‌ی بعد می‌رود' : '؛ این مرحله جایی برای رفتن بعد از برد نداشت، پس مرحله‌ها به هم وصل نشدند'}. هر مرحله یک صحنه‌ی معمولی است و می‌شود عوضش کرد.`;
    props.onMade(made.project, made.ids[0], note);
  };
  return (
    <Dialog title="ساختن مرحله‌های بعدی" about={`از روی «${scene.name}»، مرحله‌های تازه ساخته می‌شود، هر کدام کمی سخت‌تر از قبلی. با «🎲 دسته‌ی دیگر» مرحله‌های دیگری ساخته می‌شود. بعد از ساختن، هر مرحله را باز کن و امتحان کن.`} onClose={props.onClose}>
      <Slider label="چند مرحله" min={1} max={20} step={1} value={options.count} onChange={(count) => set({ count })} />
      <Select label="سخت شدن" value={options.curve} options={[
        { value: 'gentle', label: 'آرام' }, { value: 'normal', label: 'معمولی' }, { value: 'steep', label: 'تند' },
      ]} onChange={(curve) => set({ curve: curve as LevelOptions['curve'] })} />
      <h4 className="level-maker-title">چه چیزهایی عوض شود</h4>
      <Check label="دشمن‌ها تندتر، و زودتر بیایند" value={options.faster} onChange={(faster) => set({ faster })} />
      <Check label="دشمن‌های بیشتر" value={options.moreEnemies} onChange={(moreEnemies) => set({ moreEnemies })} />
      <Check label="سکه و جایزه‌ها جای تازه" value={options.movePrizes} onChange={(movePrizes) => set({ movePrizes })} />
      <Check label="حرکت، تیر یا زمان کمتر و هدف امتیاز بالاتر" value={options.fewerTries} onChange={(fewerTries) => set({ fewerTries })} />
      <Check label="منظره و آب و هوای تازه" value={options.newLook} onChange={(newLook) => set({ newLook })} />
      {layout
        ? <Check label={`چیدمان تازه: ${LAYOUT_NAMES[layout]}`} value={options.newLayout} onChange={(newLayout) => set({ newLayout })} />
        : <p className="hint">برای این بازی چیدمان تازه ساخته نمی‌شود؛ بقیه‌ی تغییرها انجام می‌شوند. چیدمان تازه برای بازی‌های دونده، پرنده و آجرشکن هست.</p>}
      <div className="adders">
        <button type="button" className="chip" data-levels-make onClick={make}>🪄 بساز</button>
        <button type="button" className="chip" data-levels-seed onClick={() => set({ seed: Math.floor(Math.random() * 100000) })}>🎲 دسته‌ی دیگر</button>
      </div>
    </Dialog>
  );
}
