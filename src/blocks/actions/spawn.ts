import { firstRef, hasPrefabs } from '../fields';
import { actionBlock } from '../types';

export const spawn = actionBlock({
  type: 'spawn',
  editor: {
    title: 'ساختن یک شیء',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'spawn', prefab: ctx.scene.prefabs[0].id, at: firstRef(ctx) }),
    fields: [
      { key: 'prefab', label: 'چه چیزی', kind: 'prefab' },
      { key: 'at', label: 'کجا', kind: 'place' },
      { key: 'ahead', label: 'جلوی آن، به طرفی که نگاه می‌کند', hint: 'برای ضربه‌ی شمشیر یا شلیک: به‌جای وسط شیء، درست جلویش ساخته می‌شود و به همان طرف نگاه می‌کند.', kind: 'bool', fallback: false, advanced: true, showIf: (v) => v.at !== 'tap' },
    ],
  },
  sentence: (a, { scene, who }) => `یک «${scene.prefabs.find((p) => p.id === a.prefab)?.name ?? '؟'}» روی ${who(a.at)} بساز`,
  check: (a, { checkRef, hasPrefab, say }) => {
    checkRef(a.at);
    if (!hasPrefab(a.prefab)) say(`creates missing prefab "${a.prefab}".`);
  },
  run: (game, action, context) => {
    const prefab = game.scene.prefabs.find((p) => p.id === action.prefab)!;
    if (action.at === 'tap') {
      // Where the screen was last touched, in the space the new object lives in.
      if (!game.lastTap) return;
      const spot = game.inSpace(Boolean(prefab.fixed), game.lastTap);
      const entity = game.createEntity(prefab, spot.x - prefab.width / 2, spot.y - prefab.height / 2);
      entity.spawned = true;
      game.entities.push(entity);
      game.layerOf(entity).addChild(entity.view);
      return;
    }
    for (const at of game.targets(action.at, context)) {
      // Ahead is the way it faces; seen from above, walking up or down (or slantwise), it is that way:
      // a sword swung at a skeleton above the knight, not at the empty floor beside it.
      const way = action.ahead && at.went && at.went.y !== 0 ? at.went : null;
      const ahead = way
        ? { x: (way.x * (at.width + prefab.width)) / 2, y: (way.y * (at.height + prefab.height)) / 2 }
        : { x: action.ahead ? (at.facing * (at.width + prefab.width)) / 2 : 0, y: 0 };
      const entity = game.createEntity(prefab, at.x + (at.width - prefab.width) / 2 + ahead.x, at.y + (at.height - prefab.height) / 2 + ahead.y);
      entity.spawned = true;
      if (action.ahead) entity.facing = at.facing;
      // A picture drawn pointing right, turned to point that way (its mirror image when it faces left).
      if (way) entity.angle = at.facing < 0 ? Math.atan2(-way.y, -way.x) : Math.atan2(way.y, way.x);
      game.insertAbove(entity, at);
    }
  },
});
