/** Pick a reachable firing lane and check the entire crossing for incoming hazards. */
export function steeringX(ship, entities, motion, width, shipSpeed) {
  const mx = ship.x + ship.width / 2, my = ship.y + ship.height / 2;
  const margin = ship.width / 2 + 6;
  const inside = x => Math.max(margin, Math.min(width - margin, x));
  const enemies = entities.filter(e => e.visible && e.tags.includes('دشمن'));
  const target = enemies.filter(e => e.y + e.height < my - 60).sort((a,b) => b.y - a.y)[0];
  const aim = inside(target ? target.x + target.width / 2 : mx);
  const hazards = entities.filter(e => e.visible && (e.tags.includes('تیر دشمن') || e.tags.includes('دشمن')));
  const trajectory = [];
  for (const h of hazards) {
    const model = motion.get(h.id);
    // A mover advances its position directly. Its speed is separate from the velocity of a launched bolt.
    const vy = h.vy + (model?.mover?.vy ?? 0);
    const vx = h.vx + (model?.mover?.vx ?? 0);
    const wave = model?.wave;
    const phase = wave && vy > 0 ? (h.y - model.startY) / vy * 2 * Math.PI / wave.seconds : 0;
    for (let step = 1; step <= 24; step++) {
      const t = step * 0.05;
      const dy = Math.abs(h.y + h.height / 2 + vy * t - my) - h.height / 2 - ship.height / 2;
      if (dy > 32) continue;
      const sway = wave ? wave.distance * (Math.sin(phase + t * 2 * Math.PI / wave.seconds) - Math.sin(phase)) : 0;
      trajectory.push({ t, x: h.x + h.width / 2 + vx * t + sway, dy, halfWidth: h.width / 2 });
    }
  }
  const lanes = [aim, inside(mx), width - margin];
  for (let x = margin; x < width - margin; x += 24) lanes.push(x);
  let best = -Infinity, result = aim;
  for (const lane of lanes) {
    let risk = 0;
    for (const h of trajectory) {
      const x = mx + Math.sign(lane - mx) * Math.min(Math.abs(lane - mx), shipSpeed * h.t);
      const dx = Math.abs(h.x - x) - h.halfWidth - ship.width / 2;
      const clearance = Math.max(dx, h.dy);
      risk += Math.max(0, 32 - clearance) ** 2 * (1.4 - h.t);
    }
    const score = -risk - Math.abs(lane - aim) - 0.15 * Math.abs(lane - mx);
    if (score > best) { best = score; result = lane; }
  }
  return result;
}
