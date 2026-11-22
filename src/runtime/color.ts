/** A colour made lighter (amount above 0, toward white) or darker (below 0, toward black). */
export function shadeOf(colour: string, amount: number): string {
  const hex = colour.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((d) => d + d).join('') : hex.slice(0, 6);
  const parts = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  const toward = amount > 0 ? 255 : 0;
  const mixed = parts.map((p) => Math.round(p + (toward - p) * Math.abs(amount)));
  return `#${mixed.map((p) => p.toString(16).padStart(2, '0')).join('')}`;
}
