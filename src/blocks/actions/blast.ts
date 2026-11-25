import { firstRef, slider } from '../fields';
import { actionBlock } from '../types';

export const blast = actionBlock({
  type: 'blast',
  editor: {
    title: 'انفجار',
    about: 'همه‌ی اشیای «فیزیک واقعی» دور و بر را به بیرون پرت می‌کند؛ هرچه نزدیک‌تر، محکم‌تر. خودش چیزی را از بین نمی‌برد؛ برای دیدنش «جرقه و تکه‌پرانی» و «لرزش صفحه» را هم اضافه کن.',
    make: (ctx) => ({ type: 'blast', at: firstRef(ctx), strength: 1500, radius: 300 }),
    fields: [{ key: 'at', label: 'از کجا', kind: 'target' }, slider('strength', 'قدرت', 100, 5000, 50), slider('radius', 'تا چه فاصله‌ای', 50, 1200, 10)],
  },
  sentence: (a, { who }) => `روی ${who(a.at)} انفجار کن و اشیای فیزیکی دور و برش را پرت کن`,
  check: (a, { checkRef }) => {
    checkRef(a.at);
  },
  run: (game, action, context) => {
    if (!game.physics) return;
    for (const at of game.targets(action.at, context)) {
      game.physics.blast({ x: at.x + at.width / 2, y: at.y + at.height / 2 }, action.strength, Math.max(1, action.radius));
    }
  },
});
