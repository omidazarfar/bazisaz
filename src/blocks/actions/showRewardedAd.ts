import { actionBlock } from '../types';

export const showRewardedAd = actionBlock({
  type: 'showRewardedAd',
  still: true,
  editor: {
    title: 'پیشنهاد تبلیغ جایزه‌ای',
    about: 'اگر بازیکن تبلیغ را تا آخر ببیند، اتفاق «بازیکن تبلیغ جایزه‌ای را تا آخر دید» رخ می‌دهد.',
    make: () => ({ type: 'showRewardedAd' }),
    fields: [],
  },
  sentence: (_a) => 'تبلیغ جایزه‌ای پیشنهاد بده',
  run: (game, _action) => {
    void game.options.onShowRewardedAd?.().then((watched) => {
      if (watched) game.rewards += 1;
    });
  },
});
