import { actionBlock } from '../types';

export const say = actionBlock({
  type: 'say',
  editor: {
    title: 'حرف زدن (گفت‌وگو)',
    about: 'یک جعبه پایین صفحه با نام گوینده، و حرفش حرف‌به‌حرف نوشته می‌شود. بازی صبر می‌کند تا بازیکن لمس کند؛ بعد کارهای بعدی همین قانون انجام می‌شوند. چند «حرف زدن» پشت هم یعنی یک گفت‌وگو. مقدارها را با {score} می‌شود نوشت.',
    make: () => ({ type: 'say', speaker: 'Knight', text: 'Hello!', color: '#ffd23f' }),
    fields: [
      { key: 'speaker', label: 'چه کسی می‌گوید', kind: 'text' },
      { key: 'text', label: 'چه می‌گوید', kind: 'text' },
      { key: 'color', label: 'رنگ نام و قاب', kind: 'color' },
    ],
  },
  sentence: (a) => `${a.speaker || 'کسی'} می‌گوید: «${a.text}»`,
  // The rest of the rule's actions run once the words have been tapped through.
  takesRest: true,
  run: (game, action, context, rest) => {
    game.speak(action, rest, context);
  },
});
