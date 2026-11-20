/** How a variable's value is written inside a text: whole numbers plainly, others with one decimal. */
export function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** A number of seconds as a clock: 65 is "1:05". Below zero counts as zero. */
export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * Replaces every {name} that is a known variable with its value; anything else
 * is left as typed. {name:time} shows the value as minutes and seconds, and
 * {name:int} drops what follows the decimal point.
 */
export function fillTemplate(template: string, values: ReadonlyMap<string, number>, own?: ReadonlyMap<string, number>, texts?: ReadonlyMap<string, string>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)(?::(time|int))?\}/g, (whole, name: string, format?: string) => {
    // A value of the object itself comes before a game variable of the same name.
    const value = own?.get(name) ?? values.get(name);
    if (value === undefined) return format ? whole : texts?.get(name) ?? whole;
    if (format === 'time') return formatTime(value);
    if (format === 'int') return String(Math.trunc(value));
    return formatValue(value);
  });
}

/**
 * Canvas text is laid out left-to-right, which puts punctuation and numbers
 * on the wrong side of a Persian or Arabic sentence. Lines containing such
 * letters are wrapped in a right-to-left embedding; other text is untouched.
 */
export function applyDirection(text: string): string {
  if (!/[֐-ࣿ]/.test(text)) return text;
  return text
    .split('\n')
    .map((line) => '‫' + line + '‬')
    .join('\n');
}
