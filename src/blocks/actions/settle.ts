import { firstRef, hasPrefabs } from '../fields';
import { actionBlock } from '../types';

export const settle = actionBlock({
  type: 'settle',
  editor: {
    title: 'پایین ریختن و پر کردن صفحه',
    about: 'برای صفحه‌ای که بعضی مهره‌هایش حذف شده‌اند: مهره‌های گروه در ستون خودشان پایین می‌ریزند و جای خالی از بالا با مهره‌های تازه پر می‌شود. صفحه همان جایی است که اشیای گروه را در ویرایشگر چیده‌ای.',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'settle', target: firstRef(ctx), prefabs: [ctx.scene.prefabs[0].id] }),
    fields: [{ key: 'target', label: 'مهره‌های کدام گروه', kind: 'ref' }, { key: 'prefabs', label: 'مهره‌های تازه از این‌ها', kind: 'prefabs' }],
  },
  sentence: (a) => a.target.by === 'tag' ? `مهره‌های گروه «${a.target.tag}» را پایین بریز و جای خالی را پر کن` : 'صفحه را پر کن',
  run: (game, action) => {
    if (action.target.by !== 'tag') return;
    const tag = action.target.tag;
    // The board is where the scene, as it was built, has objects of the group.
    const built = game.scene.objects.filter((o) => o.tags.includes(tag));
    if (built.length === 0) return;
    const cell = game.scene.cell || built[0].width;
    const left = Math.min(...built.map((o) => o.x + o.width / 2 - cell / 2));
    const top = Math.min(...built.map((o) => o.y + o.height / 2 - cell / 2));
    const cols = Math.round((Math.max(...built.map((o) => o.x + o.width / 2 + cell / 2)) - left) / cell);
    const rows = Math.round((Math.max(...built.map((o) => o.y + o.height / 2 + cell / 2)) - top) / cell);
    const prefabs = action.prefabs.flatMap((id) => game.scene.prefabs.filter((p) => p.id === id));
    const pieces = game.entities.filter((e) => e.alive && e.def.tags.includes(tag));
    for (let col = 0; col < cols; col++) {
      const middle = left + col * cell + cell / 2;
      const column = pieces.filter((e) => Math.floor((e.x + e.width / 2 - left) / cell) === col).sort((a, b) => b.y - a.y);
      let row = rows - 1;
      // Those already there drop to the lowest free cells, keeping their order.
      for (const piece of column) {
        if (row < 0) break;
        const y = top + row * cell + (cell - piece.height) / 2;
        if (Math.abs(piece.y - y) > 0.5) game.slideTo(piece, middle - piece.width / 2, y, 0.2);
        row -= 1;
      }
      // New ones come in from above the board to fill what is left.
      for (let above = 1; row >= 0 && prefabs.length > 0; row--, above++) {
        const prefab = prefabs[Math.floor(Math.random() * prefabs.length)];
        const y = top + row * cell + (cell - prefab.height) / 2;
        const entity = game.createEntity(prefab, middle - prefab.width / 2, top - above * cell);
        entity.spawned = true;
        game.entities.push(entity);
        game.layerOf(entity).addChild(entity.view);
        game.slideTo(entity, entity.x, y, 0.25);
      }
    }
  },
});
