import { useEffect, useRef } from 'react';
import type { GameProject } from '../format/types';
import { fa } from './labels';

/**
 * A guided first game. Each step says what to do in a sentence and makes the
 * button to press glow; it moves on by itself once the game shows the step is
 * done. Nothing is made for the user: they build the game themselves, so what
 * they end with is their own and they have seen where everything is.
 */

/** What the tutor can see of the editor, besides the game itself. */
export interface TutorView {
  tab: 'object' | 'rules' | 'game';
  playing: boolean;
  /** How many times "try it" has been pressed since the editor opened. */
  plays: number;
}

interface Step {
  title: string;
  how: string;
  /** Done; `plays` is the number of try-outs when this step began. */
  done?: (project: GameProject, view: TutorView, plays: number) => boolean;
  /** Where to look, most specific first: the first of these on the page glows. */
  targets: string[];
}

const objects = (p: GameProject) => p.scenes.flatMap((s) => [...s.objects, ...s.prefabs]);
const hasTag = (p: GameProject, tag: string) => objects(p).some((o) => o.tags.includes(tag));
const libraryRole = (role: string) => [`.modal button[data-block="${role}"]`, '.modal [data-library-tab="roles"]', 'button[data-library="objects"]'];
const triedSince = (_: GameProject, v: TutorView, plays: number) => v.plays > plays && !v.playing;

export const STEPS: Step[] = [
  {
    title: 'یک بازیکن اضافه کن',
    how: 'دکمه‌ی زرد «+ اضافه کردن از کتابخانه…» را بزن، برگه‌ی «با نقش آماده» را باز کن و «بازیکنی که با لمس صفحه می‌پرد» را انتخاب کن.',
    done: (p) => objects(p).some((o) => o.behaviors.some((b) => b.type === 'jumper')),
    targets: libraryRole('jump-player'),
  },
  {
    title: 'یک زمین زیرش بگذار',
    how: 'باز از کتابخانه، «با نقش آماده»، این بار «زمین یا دیوار». بازیکن روی هر چیزی که در گروه «زمین» باشد می‌ایستد؛ بدون زمین از صفحه پایین می‌افتد.',
    done: (p) => hasTag(p, 'زمین'),
    targets: libraryRole('ground'),
  },
  {
    title: 'امتحانش کن',
    how: 'دکمه‌ی سبز «امتحان کن» را بزن و روی صفحه‌ی گوشی کلیک کن تا بازیکن بپرد. موس جای انگشت است. بعد «توقف و برگشت به ویرایش» را بزن.',
    done: triedSince,
    targets: ['.stage-controls .block'],
  },
  {
    title: 'یک سکه اضافه کن',
    how: 'از کتابخانه، «با نقش آماده»، «جایزه‌ای که امتیاز می‌دهد». یک قانون هم خودش ساخته می‌شود: وقتی بازیکن به سکه بخورد، یک امتیاز بگیرد. سکه را با موس جایی بکش که بازیکن با پرش به آن برسد.',
    done: (p) => hasTag(p, 'جایزه'),
    targets: libraryRole('prize'),
  },
  {
    title: 'امتیاز را نشان بده',
    how: 'از کتابخانه، برگه‌ی «قطعه‌های آماده»، «امتیاز بالای صفحه». متنی بالای صفحه می‌آید که امتیاز را می‌شمارد.',
    done: (p) => objects(p).some((o) => o.visual.kind === 'text' && o.visual.text.includes('{score}')),
    targets: ['.modal button[data-block="score"]', '.modal [data-library-tab="parts"]', 'button[data-library="objects"]'],
  },
  {
    title: 'قانون‌ها را ببین',
    how: 'برگه‌ی «قانون‌ها» را در ستون چپ باز کن. هر قانون یک جمله است: «وقتی این اتفاق بیفتد، این کارها را بکن». قانون سکه آن‌جاست؛ رویش بزن تا ببینی از چه تکه‌هایی ساخته شده.',
    done: (_, v) => v.tab === 'rules',
    targets: ['[data-panel-tab="rules"]'],
  },
  {
    title: 'یک خطر اضافه کن',
    how: 'از کتابخانه، «با نقش آماده»، «خطر: برخورد با آن یعنی باخت». آن را با موس روی زمین بکش، دور از بازیکن. اگر بازیکن به آن بخورد، بازی از اول شروع می‌شود.',
    done: (p) => hasTag(p, 'خطر'),
    targets: libraryRole('danger'),
  },
  {
    title: 'دوباره امتحان کن',
    how: '«امتحان کن» را بزن: سکه را بگیر و از روی خطر بپر. بعد برگرد به ویرایش.',
    done: triedSince,
    targets: ['.stage-controls .block'],
  },
  {
    title: 'آفرین، اولین بازی‌ات را ساختی!',
    how: 'چند کار برای ادامه: روی خطر بزن و در برگه‌ی «شیء» رفتار «رفت و برگشت» را به آن بده تا حرکت کند. عکس‌ها را با «انتخاب از عکس‌های آماده» عوض کن. با «کپی این صحنه» مرحله‌ی دوم بساز. هر وقت گیر کردی، «راهنما» در بالای صفحه هست.',
    targets: [],
  },
];

const GLOW = 'tutor-target';

export function Tutor(props: { step: number; project: GameProject; view: TutorView; setStep: (step: number | null) => void }) {
  const { step, project, view, setStep } = props;
  const current = STEPS[step];
  // How many try-outs there had been when this step began, so "try it" means a new one.
  const playsAtStart = useRef({ step, plays: view.plays });
  if (playsAtStart.current.step !== step) playsAtStart.current = { step, plays: view.plays };

  // A finished step gives way to the next by itself, and one already done is passed over;
  // but not a step the user went back to on purpose, to read it again.
  const done = current.done?.(project, view, playsAtStart.current.plays) ?? false;
  const wentBackTo = useRef<number | null>(null);
  useEffect(() => {
    if (done && step < STEPS.length - 1 && wentBackTo.current !== step) setStep(step + 1);
  }, [done, step, setStep]);

  // The button to press glows. The page changes under it (windows open and close), so it is looked for again and again.
  useEffect(() => {
    let lit: Element | null = null;
    const light = () => {
      const found = current.targets.map((t) => document.querySelector(t)).find((el) => el !== null) ?? null;
      if (found === lit) return;
      lit?.classList.remove(GLOW);
      found?.classList.add(GLOW);
      lit = found;
    };
    light();
    const timer = setInterval(light, 250);
    return () => {
      clearInterval(timer);
      lit?.classList.remove(GLOW);
    };
  }, [current]);

  const last = step === STEPS.length - 1;
  return (
    <section className="tutor" role="status" aria-label="آموزش قدم‌به‌قدم">
      <div className="tutor-head">
        <span className="tutor-count">قدم {fa(step + 1)} از {fa(STEPS.length)}</span>
        <button type="button" className="link" onClick={() => setStep(null)}>بستن آموزش</button>
      </div>
      <strong className="tutor-title">{current.title}</strong>
      <p>{current.how}</p>
      <div className="tutor-foot">
        {step > 0 && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              wentBackTo.current = step - 1;
              setStep(step - 1);
            }}
          >
            قدم قبلی
          </button>
        )}
        {last ? (
          <button type="button" className="chip chip-warn" onClick={() => setStep(null)}>تمام</button>
        ) : (
          <button type="button" className="chip" title="اگر این قدم را به روش خودت انجام دادی" onClick={() => setStep(step + 1)}>رد شدن از این قدم</button>
        )}
      </div>
    </section>
  );
}

/** Shown over an empty game: a way in for someone who has never made one. */
export function Welcome(props: { onTutor: () => void; onAlone: () => void }) {
  return (
    <div className="welcome" role="dialog" aria-label="خوش آمدی">
      <h2>بیا اولین بازی‌ات را بسازیم</h2>
      <p>در ۹ قدم کوتاه، یک بازی کوچک می‌سازی: آدمکی که می‌پرد، سکه جمع می‌کند و از خطر دوری می‌کند. هر قدم می‌گوید کدام دکمه را بزنی، و آن دکمه چشمک می‌زند. حدود ده دقیقه طول می‌کشد.</p>
      <div className="welcome-actions">
        <button type="button" className="block" onClick={props.onTutor}>شروع آموزش قدم‌به‌قدم</button>
        <button type="button" className="btn" onClick={props.onAlone}>خودم شروع می‌کنم</button>
      </div>
    </div>
  );
}
