// Tiny pixel-art icons. Each icon is a grid: 'X' = given colour, 'o' = white highlight, '.' = empty.
export const ICONS = {
  heart: ['.XX.XX.', 'XoXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  star: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '.XX.XX.', 'X.....X'],
  check: ['......X', '.....X.', 'X...X..', '.X.X...', '..X....'],
  list: ['XXXXXXX', '.......', 'XXXXXXX', '.......', 'XXXXXXX'],
  cal: ['XXXXXXX', 'X.X.X.X', 'XXXXXXX', 'X.X.X.X', 'XXXXXXX'],
  note: ['XXXXX.', 'X...XX', 'X.XX.X', 'X....X', 'X.XX.X', 'XXXXXX'],
};

export function px(rows, color, scale = 3) {
  const w = rows[0].length, h = rows.length;
  let rects = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'o' ? '#fff' : color}"/>`;
  }));
  return `<svg width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// DOM helper: icon element (markup comes only from the constants above, never from user data).
export function icon(name, color = 'currentColor', scale = 2) {
  const s = document.createElement('span');
  s.className = 'px-icon';
  s.innerHTML = px(ICONS[name], color, scale);
  return s;
}
