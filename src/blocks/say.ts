import type { Amount, Comparison, Place, Ref, Scene } from '../format/types';
import { fa } from './fields';

/**
 * Pieces of the Persian sentences that blocks and the editor's sentences share (moved here from
 * src/editor/sentences.ts as they were, so that a block's own file can say itself).
 */

export const OP_WORD: Record<Comparison, string> = { '>=': 'دست‌کم', '<=': 'حداکثر', '==': 'برابر', '!=': 'نابرابر با', '>': 'بیشتر از', '<': 'کمتر از' };

export function describeRef(scene: Scene, ref: Ref): string {
  if (ref.by === 'tag') {
    if (!ref.tag) return 'گروهی که هنوز انتخاب نشده';
    const narrowed = ref.where ? ` که ${ref.where.name} آن ${OP_WORD[ref.where.op]} ${fa(ref.where.value)} است` : '';
    const spots = { home: ' که سر جای اولش است', away: ' که از جای اولش رفته', on: ` که روی گروه «${ref.spot?.tag ?? ''}» است`, off: ` که روی گروه «${ref.spot?.tag ?? ''}» نیست` };
    return `${ref.pick === 'random' ? 'یکی تصادفی' : 'چیزی'} از گروه «${ref.tag}»${narrowed}${ref.spot ? spots[ref.spot.is] : ''}`;
  }
  if (ref.by === 'self') return 'همین شیء';
  const object = [...scene.objects, ...scene.prefabs].find((o) => o.id === ref.id);
  return `«${object?.name ?? '؟'}»`;
}

export function amountText(amount: Amount, who: (target: Place) => string = () => 'شیء'): string {
  if (typeof amount === 'number') return fa(amount);
  if ('value' in amount) return `${amount.value}ِ ${who(amount.of)}`;
  if ('count' in amount) return `تعداد اشیای گروه «${amount.count}»`;
  return 'random' in amount ? `عددی تصادفی از ${fa(amount.random[0])} تا ${fa(amount.random[1])}` : `مقدار ${amount.variable}`;
}

/** What "first" and "second" mean in a rule's actions, said in terms of its trigger. */
export interface Subjects {
  first?: string;
  second?: string;
}

/** A group's name in a sentence, in quotes («…»); a question mark when none is chosen yet. */
export const group = (tag: string) => `«${tag || '؟'}»`;

/** The materials of real physics, in words. */
export const MATERIAL_LABEL: Record<string, string> = { wood: 'چوب', stone: 'سنگ', metal: 'فلز', ice: 'یخ', rubber: 'لاستیک', glass: 'شیشه' };
