import { describeRef } from '../say';
import type { Entity } from '../../runtime/Game';
import { firstRef, hasPrefabs } from '../fields';
import { actionBlock } from '../types';

export const slideAll = actionBlock({
  type: 'slideAll',
  editor: {
    title: 'سُر دادن همه‌ی مهره‌ها به یک طرف',
    about: 'حرکت بازی ۲۰۴۸: همه‌ی مهره‌های گروه تا جایی که راه دارند به یک طرف سُر می‌خورند. دو مهره که مقدارشان یکی است به هم که برسند یکی می‌شوند و مقدارش یکی بالا می‌رود. اگر چیزی جابه‌جا شد، یک مهره‌ی تازه در یک خانه‌ی خالی می‌آید.',
    available: hasPrefabs,
    make: (ctx) => ({ type: 'slideAll', target: firstRef(ctx), direction: 'left', boardTag: '', mergeBy: 'level', prefab: ctx.scene.prefabs[0].id }),
    fields: [
      { key: 'target', label: 'مهره‌های کدام گروه', kind: 'ref' },
      { key: 'direction', label: 'به کدام طرف', kind: 'choice', options: [
        { value: 'left', label: 'چپ' },
        { value: 'right', label: 'راست' },
        { value: 'up', label: 'بالا' },
        { value: 'down', label: 'پایین' },
      ] },
      { key: 'boardTag', label: 'گروه خانه‌های صفحه', hint: 'اشیایی که خانه‌های صفحه را نشان می‌دهند؛ مهره‌ها از آن‌ها بیرون نمی‌روند.', kind: 'tag' },
      { key: 'mergeBy', label: 'دو تا با این مقدارِ یکسان یکی شوند', hint: 'خالی بگذار تا فقط سُر بخورند.', kind: 'valueName' },
      { key: 'prefab', label: 'مهره‌ی تازه', kind: 'prefab' },
    ],
  },
  sentence: (a, { scene }) => `همه‌ی مهره‌های ${a.target.by === 'tag' ? `گروه «${a.target.tag}»` : describeRef(scene, a.target)} را به ${{ left: 'چپ', right: 'راست', up: 'بالا', down: 'پایین' }[a.direction]} سُر بده`,
  run: (game, action) => {
    if (action.target.by !== 'tag') return;
    const pieceTag = action.target.tag;
    const slots = game.entities.filter((e) => e.alive && e.def.tags.includes(action.boardTag));
    if (slots.length === 0) return;
    const cell = game.scene.cell || slots[0].width;
    const mid = (e: Entity) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 });
    const left = Math.min(...slots.map((e) => mid(e).x)) - cell / 2;
    const top = Math.min(...slots.map((e) => mid(e).y)) - cell / 2;
    const cols = Math.round((Math.max(...slots.map((e) => mid(e).x)) - left) / cell + 0.5);
    const rows = Math.round((Math.max(...slots.map((e) => mid(e).y)) - top) / cell + 0.5);
    const grid: (Entity | null)[][] = Array.from({ length: rows }, () => Array<Entity | null>(cols).fill(null));
    for (const piece of game.entities) {
      if (!piece.alive || !piece.def.tags.includes(pieceTag)) continue;
      const col = Math.floor((mid(piece).x - left) / cell);
      const row = Math.floor((mid(piece).y - top) / cell);
      if (row >= 0 && row < rows && col >= 0 && col < cols) grid[row][col] = piece;
    }
    const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[action.direction];
    const [lines, length] = dx !== 0 ? [rows, cols] : [cols, rows];
    // Each row (or column) is walked from the edge the pieces are heading for.
    const cellAt = (line: number, i: number): [number, number] => (dx !== 0 ? [line, dx > 0 ? length - 1 - i : i] : [dy > 0 ? length - 1 - i : i, line]);
    let moved = false;
    for (let line = 0; line < lines; line++) {
      let free = 0;
      let ahead: Entity | null = null;
      let aheadMerged = false;
      for (let i = 0; i < length; i++) {
        const [row, col] = cellAt(line, i);
        const piece = grid[row][col];
        if (!piece) continue;
        grid[row][col] = null;
        const mine = piece.values.get(action.mergeBy) ?? 0;
        if (ahead && !aheadMerged && action.mergeBy !== '' && (ahead.values.get(action.mergeBy) ?? 0) === mine) {
          // It runs into one like itself: the two become one, a step higher. A piece merges once per move.
          ahead.values.set(action.mergeBy, mine + 1);
          aheadMerged = true;
          piece.alive = false;
          game.valuesChanged = true;
          moved = true;
          continue;
        }
        const [toRow, toCol] = cellAt(line, free);
        if (toRow !== row || toCol !== col) moved = true;
        grid[toRow][toCol] = piece;
        game.slideTo(piece, left + toCol * cell + (cell - piece.width) / 2, top + toRow * cell + (cell - piece.height) / 2, 0.1);
        ahead = piece;
        aheadMerged = false;
        free += 1;
      }
    }
    const prefab = game.scene.prefabs.find((p) => p.id === action.prefab);
    const empty = grid.flatMap((cells, row) => cells.flatMap((piece, col) => (piece ? [] : [[row, col]])));
    if (moved && prefab && empty.length > 0) {
      const [row, col] = empty[Math.floor(Math.random() * empty.length)];
      const entity = game.createEntity(prefab, left + col * cell + (cell - prefab.width) / 2, top + row * cell + (cell - prefab.height) / 2);
      entity.spawned = true;
      game.entities.push(entity);
      game.layerOf(entity).addChild(entity.view);
    }
  },
});
