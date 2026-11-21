import assert from 'node:assert/strict';
import test from 'node:test';
import { steeringX } from './shooter-steering.mjs';

const ship = { x: 308, y: 995, width: 104, height: 110 };
const centered = 360;
const hazard = { x: 348, y: 840, width: 24, height: 24, id: 'bolt', tags: ['تیر دشمن'], vx: 0, vy: 260, visible: true };
const steer = (hazards, motion = new Map()) => steeringX(ship, hazards, motion, 720, 1300);

test('dodge a launched enemy bolt identified only by its tag', () => {
  assert.ok(Math.abs(steer([hazard]) - centered) > 70);
});
test('predict a descending mover even when its reported body velocity is zero', () => {
  const rock = { ...hazard, id: 'rock', tags: ['دشمن'], width: 84, height: 84, x: 318, y: 760, vy: 0 };
  assert.ok(Math.abs(steer([rock], new Map([['rock', { mover: {vx:0, vy:260} }]])) - centered) > 85);
});
test('stay on the safe side if reaching a firing lane would cross a nearby shot', () => {
  const target = { ...hazard, x: 610, y: 200, tags:['دشمن'], vy:0 };
  const crossing = { ...hazard, x: 434, y: ship.y + 36, vy:0 };
  assert.ok(steer([target]) > 600);
  assert.ok(steer([target, crossing]) < crossing.x);
});
