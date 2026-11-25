import { actionBlock } from '../types';

export const showAd = actionBlock({
  type: 'showAd',
  still: true,
  editor: {
    title: 'نمایش تبلیغ تمام‌صفحه',
    about: 'فقط وقتی تبلیغات در بخش «بازی» روشن باشد.',
    make: () => ({ type: 'showAd' }),
    fields: [],
  },
  sentence: (_a) => 'تبلیغ تمام‌صفحه نشان بده',
  run: (game, _action) => {
    if (game.project.ads.enabled) game.options.onShowAd?.();
  },
});
