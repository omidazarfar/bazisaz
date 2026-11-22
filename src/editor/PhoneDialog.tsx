import qrcode from 'qrcode-generator';
import { useEffect, useState } from 'react';
import type { GameProject } from '../format/types';
import { Dialog } from './Pick';

export type PhoneLink = 'checking' | 'offline' | { urls: string[] } | { error: string };

/** What a phone showing the game says about it, every two seconds. */
export interface PhoneReport {
  id: string;
  name: string;
  fps: number;
  scene: string;
  light: boolean;
  errors: string[];
  current: boolean;
}

/** The phones playing the game now; empty when none is or the server cannot be reached. */
export async function phoneStatus(): Promise<PhoneReport[]> {
  try {
    const body = (await (await fetch('/api/phone/status', { cache: 'no-store' })).json()) as { devices?: PhoneReport[] };
    return body.devices ?? [];
  } catch {
    return [];
  }
}

/** Sends the game to the local server, which shows it to phones on the same Wi-Fi. */
export async function sendToPhone(project: GameProject, startOn: string | null = null): Promise<PhoneLink> {
  if (location.protocol === 'file:') return 'offline';
  // Starting on the scene being worked on: the change is seen at once, not after the menus.
  if (startOn && project.scenes.some((s) => s.id === startOn)) project = { ...project, startScene: startOn };
  try {
    const response = await fetch('/api/phone', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project }) });
    const body = (await response.json()) as { urls?: string[]; error?: string };
    if (!response.ok) return { error: body.error ?? 'ارسال به گوشی نشد.' };
    return { urls: body.urls ?? [] };
  } catch {
    return 'offline';
  }
}

export async function stopPhone(): Promise<void> {
  await fetch('/api/phone/stop', { method: 'POST' }).catch(() => undefined);
}

/** A QR code as an SVG picture, for the phone's camera. */
function Qr({ text }: { text: string }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return <div className="qr" role="img" aria-label="کد QR نشانی بازی" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) }} />;
}

/**
 * Trying the game on a real phone: the computer shows it to phones on the
 * same Wi-Fi, and the phone's camera opens it from a QR code. While this is
 * on, every change in the editor reaches the phone a moment later.
 */
export function PhoneDialog({ link, onClose, onStop, phones, fromScene, setFromScene, sceneNames }: {
  link: PhoneLink; onClose: () => void; onStop: () => void;
  phones: PhoneReport[]; fromScene: boolean; setFromScene: (on: boolean) => void; sceneNames: Record<string, string>;
}) {
  const [which, setWhich] = useState(0);
  const urls = typeof link === 'object' && 'urls' in link ? link.urls : [];
  useEffect(() => setWhich(0), [urls.length]);

  return (
    <Dialog title="امتحان روی گوشی" about="بازی را روی گوشی خودت بازی کن، بدون ساختن فایل نصب." wide onClose={onClose}>
      <div className="phone-dialog">
        {link === 'checking' && <p>در حال آماده کردن…</p>}
        {link === 'offline' && (
          <p className="field-warning">
            این کار فقط وقتی ممکن است که برنامه را با دستور <bdi dir="ltr">npm start</bdi> اجرا کرده باشی و ویرایشگر را از آدرس{' '}
            <bdi dir="ltr">http://localhost:5180</bdi> باز کرده باشی.
          </p>
        )}
        {typeof link === 'object' && 'error' in link && <p className="field-error">{link.error}</p>}
        {typeof link === 'object' && 'urls' in link && urls.length === 0 && (
          <p className="field-warning">این کامپیوتر به هیچ شبکه‌ای وصل نیست. به همان وای‌فای گوشی وصلش کن و دوباره امتحان کن.</p>
        )}
        {urls.length > 0 && (
          <>
            {phones.length > 0 && (
            <div className="phone-devices" data-phone-devices>
              {phones.map((p) => (
                <div key={p.id} className="phone-device" data-phone={p.id}>
                  <strong>📱 {p.name}</strong>
                  <span className={p.fps >= 50 ? 'fps good' : p.fps >= 30 ? 'fps ok' : 'fps slow'} data-fps={p.fps}>{p.fps.toLocaleString('fa-IR')} تصویر در ثانیه</span>
                  <span>{sceneNames[p.scene] ?? 'در حال باز شدن'}{p.current ? '' : ' · نسخه‌ی قبلی'}</span>
                  {p.light && <span className="field-warning">بازی روی این گوشی کند بود و جلوه‌های سنگین را خاموش کرد.</span>}
                  {p.fps > 0 && p.fps < 30 && <span className="field-warning">کند است: سایه‌ی دیوار، آب و هوا، درخشش نورها و ظاهر قدیمی را کمتر کن.</span>}
                  {p.errors.map((e, i) => <span key={i} className="field-error"><bdi dir="ltr">{e}</bdi></span>)}
                </div>
              ))}
            </div>
            )}
            <Qr text={urls[which]} />
            <p className="phone-url"><bdi dir="ltr">{urls[which]}</bdi></p>
            <ol className="phone-steps">
              <li>گوشی و این کامپیوتر باید به <strong>یک وای‌فای</strong> وصل باشند.</li>
              <li>دوربین گوشی را روی این مربع بگیر و لینکی را که نشان می‌دهد باز کن. (یا همین نشانی را در مرورگر گوشی بنویس.)</li>
              <li>اگر ویندوز پرسید که Node.js به شبکه دسترسی داشته باشد، «Allow access» را بزن.</li>
              <li>هر تغییری که در ویرایشگر بدهی، کمتر از یک ثانیه بعد روی گوشی هم می‌آید و بازی از صحنه‌ای که باز است شروع می‌شود.</li>
            </ol>
            {urls.length > 1 && (
              <p className="control-hint">
                گوشی باز نکرد؟ این کامپیوتر چند شبکه دارد.{' '}
                <button type="button" className="link" onClick={() => setWhich((which + 1) % urls.length)}>نشانی دیگر را امتحان کن</button>
              </p>
            )}
            {phones.length === 0 && <p className="hint" data-phone-devices>هنوز هیچ گوشی‌ای بازی را باز نکرده.</p>}
            <label className="phone-from-scene">
              <input type="checkbox" checked={fromScene} onChange={(ev) => setFromScene(ev.target.checked)} data-phone-from-scene />
              از صحنه‌ای که الان باز است شروع شود (نه از صفحه‌ی شروع)
            </label>
            <div className="adders">
              <button type="button" className="chip" onClick={onStop}>قطع فرستادن به گوشی</button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
