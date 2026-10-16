// Renders the status line's real ANSI output into docs/preview.svg.
// Usage: node docs/make-preview.js   (uses sample session data below)
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const now = Math.floor(Date.now() / 1000);
const sample = {
  model: { display_name: 'Opus' },
  effort: { level: 'high' },
  workspace: { current_dir: path.resolve(__dirname, '..') },
  context_window: { used_percentage: 42, context_window_size: 200000, total_input_tokens: 84000 },
  rate_limits: {
    five_hour: { used_percentage: 63, resets_at: now + 7300 },
    seven_day: { used_percentage: 21, resets_at: now + 300000 },
  },
  cost: { total_cost_usd: 3.12, total_duration_ms: 2900000, total_lines_added: 420, total_lines_removed: 61 },
  session_id: 'preview',
};
const ansi = execFileSync('node', [path.join(__dirname, '..', 'statusline.js')], { input: JSON.stringify(sample), encoding: 'utf8' });

const CELL = 9, ROW = 22, PAD_X = 18, TOP = 33;
const esc = c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c);
const wide = c => /\p{Extended_Pictographic}/u.test(c);
const out = [];
let maxCol = 0;
ansi.split('\n').forEach((line, row) => {
  let col = 0, fg = null, bg = null, bold = false;
  for (const tok of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = tok.match(/^\x1b\[([0-9;]*)m$/);
    if (m) {
      const p = m[1].split(';').map(Number);
      for (let i = 0; i < p.length; i++) {
        if (p[i] === 0) { fg = bg = null; bold = false; }
        else if (p[i] === 1) bold = true;
        else if (p[i] === 38 || p[i] === 48) { const rgb = `rgb(${p.slice(i + 2, i + 5).join(',')})`; p[i] === 38 ? (fg = rgb) : (bg = rgb); i += 4; }
      }
      continue;
    }
    for (const ch of tok) {
      const x = PAD_X + col * CELL, y = TOP + row * ROW, w = wide(ch) ? 2 : 1;
      if (bg) out.push(`<rect x="${x}" y="${y - 15}" width="${CELL * w + 0.5}" height="20" fill="${bg}"/>`);
      if (ch !== ' ') out.push(`<text x="${x}" y="${y}" fill="${fg || 'rgb(192,202,245)'}"${bold ? ' font-weight="bold"' : ''}>${esc(ch)}</text>`);
      col += w;
    }
  }
  maxCol = Math.max(maxCol, col);
});
const rows = ansi.split('\n').length;
const W = PAD_X * 2 + maxCol * CELL, H = TOP + (rows - 1) * ROW + 25;
fs.writeFileSync(path.join(__dirname, 'preview.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Cascadia Mono','DejaVu Sans Mono',Consolas,monospace" font-size="15">\n` +
  `<rect width="${W}" height="${H}" rx="10" fill="#1a1b26"/>\n${out.join('\n')}\n</svg>\n`);
console.log(`docs/preview.svg: ${rows} lines, ${W}x${H}`);
