import { slider } from '../fields';
import { group } from '../say';
import { behaviorBlock } from '../types';

export const homing = behaviorBlock({
  type: 'homing',
  editor: {
    title: 'تعقیب هدف (موشک)',
    about: 'وقتی پرواز می‌کند آرام به طرف نزدیک‌ترین شیء یک گروه می‌چرخد و سرعتش را نگه می‌دارد؛ مثل موشک. برای تیر و گلوله. عکسش رو به بالا باشد.',
    make: () => ({ type: 'homing', targetTag: '', turn: 180 }),
    fields: [
      { key: 'targetTag', label: 'به طرف این گروه', kind: 'tag' },
      slider('turn', 'تندی چرخش', 20, 720, 10, 'هرچه بیشتر، تیزتر می‌پیچد.', 'درجه در ثانیه'),
    ],
  },
  sentence: (b) => `به طرف نزدیک‌ترین ${group(b.targetTag)} می‌پیچد، مثل موشک`,
  step: (game, e, b, frame) => {
    const { dt } = frame;
    game.home(e, b, dt);
  },
});
