import { TAP_GRACE } from '../../runtime/constants';
import { triggerBlock } from '../types';

export const holding = triggerBlock({
  type: 'holding',
  editor: {
    title: 'تا وقتی صفحه لمس است',
    short: 'پشت‌سرهم، تا وقتی انگشت روی صفحه است.',
    make: () => ({ type: 'holding' }),
    fields: [],
  },
  sentence: () => 'تا وقتی صفحه لمس است',
  fired: (game) => {
    const held = [...game.pointers.values()].some((p) => !game.onControl(p)) || game.keys.has('Space');
    return held && game.time > TAP_GRACE ? [{}] : [];
  },
});
