import { JUMP_BUFFER, JUMP_CUT } from '../../runtime/constants';
import { fa, slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const jumper = behaviorBlock({
  type: 'jumper',
  editor: {
    title: 'پرش',
    about: 'می‌پرد و با جاذبه پایین می‌آید. جسم فیزیکی لازم دارد.',
    make: () => ({ type: 'jumper', jumpSpeed: 1100, maxJumps: 1, on: 'tap', buttonTag: '', variable: false }),
    fields: [
      slider('jumpSpeed', 'قدرت پرش', 300, 2000, 10, 'بیشتر یعنی پرش بلندتر'),
      slider('maxJumps', 'تعداد پرش پشت‌سرهم', 1, 3, 1, '۲ یعنی در هوا یک بار دیگر هم می‌پرد'),
      { key: 'on', label: 'چطور بپرد', kind: 'choice', options: [
        { value: 'tap', label: 'با لمس صفحه' },
        { value: 'button', label: 'با دکمه' },
        { value: 'none', label: 'فقط با قانون' },
      ] },
      { key: 'buttonTag', label: 'گروه دکمه‌ی پرش', kind: 'tag', showIf: (v) => v.on === 'button' },
      { key: 'variable', label: 'با نگه داشتن، بلندتر بپرد', hint: 'لمس کوتاه یعنی پرش کوتاه؛ نگه داشتن یعنی پرش کامل.', kind: 'bool', fallback: false, advanced: true, showIf: (v) => v.on !== 'none' },
    ],
  },
  sentence: (b) => {
    const how = b.on === 'tap' ? 'با لمس صفحه' : b.on === 'button' ? `با دکمه‌ی ${group(b.buttonTag)}` : 'وقتی قانونی بگوید';
    return `${how} می‌پرد${b.maxJumps > 1 ? `؛ تا ${fa(b.maxJumps)} بار پشت‌سرهم` : ''}`;
  },
  step: (game, e, b, frame) => {
    const { dt, screenTapped } = frame;
    const byTap = b.on === 'tap';
    const asked = byTap ? screenTapped : b.on === 'button' && (game.keyTap || game.taps.some((t) => game.hitsTag(t, b.buttonTag)));
    if (asked) e.jumpAsked = JUMP_BUFFER;
    const walls = e.def.behaviors.some((m) => m.type === 'moves' && m.wallJump);
    if (e.jumpAsked > 0 && walls && !e.grounded && e.wallSide) {
      // Off the wall: up, and pushed away from it for a moment whatever the player is holding.
      e.vy = -b.jumpSpeed;
      e.kick = { vx: -e.wallSide * Math.max(420, b.jumpSpeed * 0.55), left: 0.2 };
      e.facing = e.wallSide > 0 ? -1 : 1;
      e.jumpsLeft = Math.max(0, b.maxJumps - 1);
      e.jumpAsked = 0;
      e.rising = true;
      e.squash = { x: 0.82, y: 1.2, left: 0.22, span: 0.22 };
      game.sound('jump');
    } else if (e.jumpAsked > 0 && e.jumpsLeft > 0) {
      e.vy = -b.jumpSpeed;
      e.jumpsLeft -= 1;
      e.jumpAsked = 0;
      e.rising = true;
      // Stretched tall for a moment as it springs up.
      e.squash = { x: 0.82, y: 1.2, left: 0.22, span: 0.22 };
      game.sound('jump');
    } else if (e.jumpAsked > 0) e.jumpAsked -= dt;
    if (e.rising && e.vy >= 0) e.rising = false;
    if (e.rising && b.variable) {
      const key = game.keys.has('Space') || game.keys.has('ArrowUp');
      const held = key || (byTap ? [...game.pointers.values()].some((p) => !game.onControl(p)) : game.held(b.buttonTag));
      if (!held) {
        e.vy *= JUMP_CUT;
        e.rising = false;
      }
    }
  },
});
