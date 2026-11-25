import { actionBlock } from '../types';

export const achieve = actionBlock({
  type: 'achieve',
  editor: {
    title: 'دستاورد',
    about: 'بار اولی که این کار انجام شود، یک نوار طلایی بالای صفحه می‌گوید «دستاورد: …» و روی گوشی می‌ماند؛ دفعه‌های بعد چیزی نشان نمی‌دهد. مثل «اولین سکه» یا «غول‌کش».',
    make: () => ({ type: 'achieve', name: 'First win' }),
    fields: [{ key: 'name', label: 'نام دستاورد', kind: 'text' }],
  },
  sentence: (a) => `دستاورد «${a.name}» را بده`,
  run: (game, action) => {
    game.achieve(action.name);
  },
});
