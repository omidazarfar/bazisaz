import { actionBlock } from '../types';

export const recordScore = actionBlock({
  type: 'recordScore',
  still: true,
  editor: {
    title: 'ثبت در جدول امتیاز',
    about: 'مقدار یک امتیاز را در فهرست بهترین امتیازهای روی گوشی می‌گذارد (پنج‌تای اول می‌مانند). اگر بازی مقدارهایی به نام top1، top2 و top3 داشته باشد، همیشه بهترین‌ها را نشان می‌دهند؛ مثلاً در متن «1. {top1}».',
    make: () => ({ type: 'recordScore', variable: 'score' }),
    fields: [{ key: 'variable', label: 'کدام مقدار', kind: 'variable' }],
  },
  sentence: (a) => `${a.variable} را در جدول امتیاز ثبت کن`,
  run: (game, action) => {
    game.recordScore(Number(game.variables.get(action.variable) ?? 0));
  },
});
