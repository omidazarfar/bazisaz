import { useEffect, useState, type ReactNode } from 'react';

/** A window over the editor. Escape, the close button, or a click outside it closes it. */
export function Dialog(props: { title: string; about?: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      onClose();
    };
    // Capturing, so the editor's own shortcuts never see a key meant for the window.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={props.title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={props.wide ? 'modal-box modal-wide' : 'modal-box'}>
        <header className="modal-head">
          <div>
            <h2>{props.title}</h2>
            {props.about && <p>{props.about}</p>}
          </div>
          <button type="button" className="btn" onClick={onClose}>بستن</button>
        </header>
        {props.children}
      </div>
    </div>
  );
}

export interface PickItem {
  value: string;
  title: string;
  about?: string;
  /** Why it cannot be chosen right now; the item is shown but cannot be pressed. */
  why?: string | null;
}

export interface PickGroup {
  title: string;
  items: PickItem[];
}

/**
 * A list to choose one thing from, grouped under headings, with a box to search it.
 * With `common`, it first shows only those few, most used choices, and the
 * rest one press away, so a newcomer is not faced with forty at once.
 */
export function PickDialog(props: { title: string; about?: string; groups: PickGroup[]; common?: string[]; onPick: (value: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const wanted = query.trim();
  const total = props.groups.reduce((n, g) => n + g.items.length, 0);
  const short = Boolean(props.common) && !all && !wanted;
  const everything = props.groups.flatMap((g) => g.items);
  const shown: PickGroup[] = short
    ? [{ title: 'پرکاربردها', items: props.common!.flatMap((value) => everything.filter((i) => i.value === value)) }]
    : props.groups;
  const groups = shown
    .map((g) => ({ ...g, items: g.items.filter((i) => !wanted || i.title.includes(wanted) || (i.about ?? '').includes(wanted)) }))
    .filter((g) => g.items.length > 0);
  return (
    <Dialog title={props.title} about={props.about} onClose={props.onClose}>
      {total > 8 && (
        <input type="search" className="pick-search" dir="rtl" autoFocus aria-label="جست‌وجو" placeholder="جست‌وجو…" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      <div className="pick-list">
        {groups.length === 0 && <p className="empty">چیزی با این نام پیدا نشد.</p>}
        {groups.map((group) => (
          <section key={group.title}>
            {group.title && <h3 className="pick-group">{group.title}</h3>}
            <div className="pick-items">
              {group.items.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="card"
                  data-block={item.value}
                  disabled={Boolean(item.why)}
                  onClick={() => {
                    props.onPick(item.value);
                    props.onClose();
                  }}
                >
                  <strong>{item.title}</strong>
                  {(item.why || item.about) && <span>{item.why || item.about}</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
        {short && (
          <button type="button" className="btn btn-wide pick-more" onClick={() => setAll(true)}>
            همه‌ی گزینه‌ها ({faCount(total)} تا)
          </button>
        )}
      </div>
    </Dialog>
  );
}

function faCount(n: number): string {
  return new Intl.NumberFormat('fa-IR').format(n);
}

/** A button that opens a pick list. `label` names the button for screen readers and tests. */
export function PickButton(props: {
  label: string;
  className?: string;
  title: string;
  about?: string;
  groups: PickGroup[];
  /** The most used choices, shown alone at first. */
  common?: string[];
  onPick: (value: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={props.className ?? 'btn btn-wide'} aria-label={props.label} onClick={() => setOpen(true)}>
        {props.children}
      </button>
      {open && <PickDialog title={props.title} about={props.about} groups={props.groups} common={props.common} onPick={props.onPick} onClose={() => setOpen(false)} />}
    </>
  );
}
