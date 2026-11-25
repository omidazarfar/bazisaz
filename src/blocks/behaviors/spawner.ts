import { fa, hasPrefabs, slider } from '../fields';
import { behaviorBlock } from '../types';

export const spawner = behaviorBlock({
  type: 'spawner',
  editor: {
    title: 'ساخت خودکار',
    about: 'هر چند ثانیه یک شیء تازه می‌سازد. لبه‌ی چپ و پایین شیء تازه روی گوشه‌ی بالا-چپ این شیء می‌نشیند.',
    available: hasPrefabs,
    make: ({ scene }) => ({ type: 'spawner', prefabs: [scene.prefabs[0].id], minInterval: 1, maxInterval: 2, spreadX: 0, spreadY: 0, everyDistance: 0 }),
    fields: [
      { key: 'prefabs', label: 'چه چیزهایی بسازد', kind: 'prefabs' },
      slider('minInterval', 'کمترین فاصله', 0.2, 10, 0.1, undefined, 'ثانیه'),
      slider('maxInterval', 'بیشترین فاصله', 0.2, 10, 0.1, undefined, 'ثانیه'),
      { ...slider('spreadX', 'پراکندگی افقی', 0, 720, 10, 'هر بار تا این اندازه چپ‌تر یا راست‌تر ساخته می‌شود'), fallback: 0, advanced: true },
      { ...slider('spreadY', 'پراکندگی عمودی', 0, 720, 10), fallback: 0, advanced: true },
      { ...slider('everyDistance', 'به‌جای زمان، با حرکت دوربین بساز', 0, 1000, 10, 'صفر یعنی با زمان. اگر عددی بگذاری، هر بار که دوربین این‌قدر جلو برود یکی می‌سازد؛ برای مرحله‌ی بی‌پایان، این شیء را «به صفحه چسبیده» کن.'), fallback: 0, advanced: true },
    ],
  },
  sentence: (b, { scene }) => {
    const names = b.prefabs.map((id) => `«${scene.prefabs.find((p) => p.id === id)?.name ?? '؟'}»`).join(' یا ');
    return `هر ${fa(b.minInterval)} تا ${fa(b.maxInterval)} ثانیه یک ${names} می‌سازد`;
  },
  check: (b, { object, say, hasPrefab }) => {
    if (b.prefabs.length === 0) say(`spawner "${object.id}" has nothing to create.`);
    for (const id of b.prefabs) {
      if (!hasPrefab(id)) say(`spawner "${object.id}" refers to missing prefab "${id}".`);
    }
    if (!(b.minInterval > 0) || b.maxInterval < b.minInterval) {
      say(`spawner "${object.id}" needs 0 < minInterval <= maxInterval.`);
    }
  },
  step: (game, e, b, frame) => {
    const { dt } = frame;
    // By the clock, or by how far the camera has travelled.
    e.spawnIn -= b.everyDistance > 0 ? game.cameraTravel : dt;
    if (e.spawnIn <= 0) {
      e.spawnIn = b.everyDistance > 0 ? b.everyDistance : b.minInterval + Math.random() * (b.maxInterval - b.minInterval);
      const id = b.prefabs[Math.floor(Math.random() * b.prefabs.length)];
      const prefab = game.scene.prefabs.find((p) => p.id === id)!;
      // A spawner fixed to the screen still creates things in the world, under where it is on the screen now.
      const from = e.def.fixed && !prefab.fixed ? game.inSpace(false, { x: e.x, y: e.y }) : { x: e.x, y: e.y };
      const entity = game.createEntity(
        prefab,
        from.x + (Math.random() * 2 - 1) * b.spreadX,
        from.y - prefab.height + (Math.random() * 2 - 1) * b.spreadY,
      );
      entity.spawned = true;
      frame.spawned.push({ entity, above: e });
    }
  },
});
