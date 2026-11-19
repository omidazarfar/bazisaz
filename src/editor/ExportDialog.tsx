import { useEffect, useRef, useState } from 'react';
import type { GameProject } from '../format/types';
import { paddedImage, squareImage } from './images';

/** Launcher icon sizes in pixels per Android screen density; must match server/index.mjs. */
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 } as const;

type Health = 'checking' | 'offline' | { problems: string[]; keys: string };
interface Job {
  id: string;
  status: 'queued' | 'building' | 'done' | 'failed';
  step: string;
  error: string | null;
  files: { apk: string; aab: string } | null;
  log: string[];
}

async function iconsFor(project: GameProject) {
  const icon = project.app.icon;
  if (!icon) return null;
  const legacy: Record<string, string> = {};
  const foreground: Record<string, string> = {};
  for (const [density, size] of Object.entries(DENSITIES)) {
    legacy[density] = await squareImage(icon, size);
    // The adaptive-icon layer is 108 units where the visible icon is 48.
    foreground[density] = await paddedImage(icon, Math.round((size * 108) / 48));
  }
  return { legacy, foreground };
}

/** Builds the Android files for the game through the local server, and offers them for download. */
export function ExportDialog({ project, onClose }: { project: GameProject; onClose: () => void }) {
  const [health, setHealth] = useState<Health>('checking');
  const [job, setJob] = useState<Job | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const closed = useRef(false);

  useEffect(() => {
    closed.current = false;
    // Opened as a plain file there is no server to ask, and trying only logs an error.
    if (location.protocol === 'file:') return setHealth('offline');
    fetch('/api/health')
      .then((r) => r.json() as Promise<{ problems: string[]; keys: string }>)
      .then((h) => setHealth({ problems: h.problems, keys: h.keys }), () => setHealth('offline'));
    return () => {
      closed.current = true;
    };
  }, []);

  const start = async () => {
    setFailure(null);
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project, icons: await iconsFor(project) }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) return setFailure(body.error ?? 'شروع ساخت ممکن نشد.');

      // Ask how it is going until it finishes, unless the dialog has been closed.
      for (;;) {
        const status = (await (await fetch(`/api/export/${body.id}`)).json()) as Omit<Job, 'id'>;
        if (closed.current) return;
        setJob({ id: body.id, ...status });
        if (status.status === 'done' || status.status === 'failed') return;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch {
      setFailure('ارتباط با برنامه قطع شد. پنجره‌ای که npm start در آن اجرا شده باز است؟');
    }
  };

  const building = job?.status === 'queued' || job?.status === 'building';
  const ready = typeof health === 'object' && health.problems.length === 0;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="modal-box">
        <h2 id="export-title">خروجی اندروید</h2>
        <dl className="facts">
          <dt>نام بازی</dt>
          <dd><bdi>{project.meta.name}</bdi></dd>
          <dt>شناسه‌ی اپ</dt>
          <dd><bdi dir="ltr">{project.app.appId}</bdi></dd>
          <dt>نسخه</dt>
          <dd><bdi dir="ltr">{project.app.versionName} ({project.app.versionCode})</bdi></dd>
        </dl>

        {project.app.appId.startsWith('com.example.') && (
          <p className="field-warning">با این شناسه می‌توانی روی گوشی خودت آزمایش کنی، ولی Google Play آن را قبول نمی‌کند. در بخش «بازی» عوضش کن.</p>
        )}

        {health === 'checking' && <p>در حال بررسی…</p>}
        {health === 'offline' && (
          <p className="field-error">
            ساختن خروجی فقط وقتی کار می‌کند که برنامه را با دستور <bdi dir="ltr">npm start</bdi> اجرا کرده باشی و ویرایشگر را از آدرس{' '}
            <bdi dir="ltr">http://localhost:5180</bdi> باز کرده باشی. الان ویرایشگر به شکل یک فایل تنها باز شده است.
          </p>
        )}
        {typeof health === 'object' && health.problems.map((p) => <p key={p} className="field-error">{p}</p>)}
        {failure && <p className="field-error">{failure}</p>}

        {job && (
          <div className="export-status" aria-live="polite">
            <p className="export-step">{job.status === 'failed' ? job.error : job.step}</p>
            {job.status !== 'done' && <pre dir="ltr">{job.log.join('\n')}</pre>}
          </div>
        )}

        {job?.status === 'done' && job.files && typeof health === 'object' && (
          <div className="export-done">
            <a className="block" href={`/api/export/${job.id}/apk`} download={job.files.apk}>دانلود APK</a>
            <a className="block" href={`/api/export/${job.id}/aab`} download={job.files.aab}>دانلود AAB</a>
            <p>APK را برای آزمایش روی گوشی نصب کن. AAB فایلی است که در Google Play بارگذاری می‌شود.</p>
            <p>
              اگر گوشی گفت «نصب نشد»، نسخه‌ی قبلی همین بازی را از گوشی پاک کن و دوباره نصب کن.
            </p>
            <p className="field-warning">
              از این پوشه نسخه‌ی پشتیبان نگه دار: <bdi dir="ltr">{health.keys}</bdi>. کلید امضای بازی آن‌جاست و بدون آن نمی‌توانی نسخه‌ی بعدی همین بازی را منتشر کنی.
            </p>
          </div>
        )}

        <div className="modal-actions">
          {job?.status !== 'done' && (
            <button type="button" className="block" disabled={!ready || building} onClick={() => void start()}>
              {building ? 'در حال ساخت…' : job?.status === 'failed' ? 'دوباره بساز' : 'بساز'}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>بستن</button>
        </div>
      </div>
    </div>
  );
}
