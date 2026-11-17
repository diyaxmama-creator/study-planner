import test from 'node:test';
import assert from 'node:assert/strict';
import { px, ICONS } from '../js/pixel.js';

test('px draws one crisp rect per filled cell, sized by scale', () => {
  const svg = px(['X.', '.X'], '#f00', 4);
  assert.equal((svg.match(/<rect /g) || []).length, 2);
  assert.match(svg, /width="8" height="8" viewBox="0 0 2 2"/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  assert.match(svg, /fill="#f00"/);
});

test('icons are rectangular grids', () => {
  for (const [name, rows] of Object.entries(ICONS)) assert.ok(rows.every(r => r.length === rows[0].length), name);
});
