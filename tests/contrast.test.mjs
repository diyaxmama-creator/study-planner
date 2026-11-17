import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const root = css.match(/:root\s*{([^}]*)}/)[1];
const vars = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Text/background pairs the UI actually uses; WCAG AA body text needs 4.5:1.
for (const [fg, bg] of [['on-acc', 'acc'], ['late', 'card'], ['late', 'bg'], ['mute', 'card'], ['mute', 'soft'], ['ink', 'soft'], ['acc-ink', 'bg']]) {
  test(`--${fg} on --${bg} is readable`, () => {
    assert.ok(vars[fg] && vars[bg], `missing --${fg} or --${bg}`);
    assert.ok(ratio(vars[fg], vars[bg]) >= 4.5, `${ratio(vars[fg], vars[bg]).toFixed(2)}:1`);
  });
}

test('no white text on the pink accent', () => {
  assert.doesNotMatch(css, /color:\s*#fff/i);
});
