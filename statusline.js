const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch {}

  // --- Truecolor helpers ---
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const fg = (rgb, s, bold) => `\x1b[${bold ? '1;' : ''}38;2;${rgb.join(';')}m${s}\x1b[0m`;
  const pill = (bgRgb, fgRgb, s) => `\x1b[1;48;2;${bgRgb.join(';')};38;2;${fgRgb.join(';')}m ${s} \x1b[0m`;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const gradient = (s, from, to, bold) => {
    const chars = [...s];
    return chars.map((ch, i) => (ch === ' ' ? ch : fg(mix(from, to, chars.length > 1 ? i / (chars.length - 1) : 0), ch, bold))).join('');
  };

  const C = {
    purple: hex('#bb9af7'), pink: hex('#f7768e'), cyan: hex('#7dcfff'), blue: hex('#7aa2f7'),
    green: hex('#9ece6a'), yellow: hex('#e0af68'), orange: hex('#ff9e64'), red: hex('#f7768e'),
    text: hex('#c0caf5'), muted: hex('#565f89'), dark: hex('#1a1b26'), teal: hex('#73daca'),
  };
  const dim = s => fg(C.muted, s);
  const sep = dim('  ┃  ');

  // Usage color: green → yellow → red
  const heat = p => (p < 50 ? mix(C.green, C.yellow, p / 50) : mix(C.yellow, C.red, Math.min(1, (p - 50) / 40)));

  // Smooth bar with eighth-blocks, each cell colored by its own position
  const BAR = 10;
  const PARTS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
  const bar = (label, v) => {
    if (typeof v !== 'number') return null;
    const p = Math.max(0, Math.min(100, v));
    const eighths = Math.round((p / 100) * BAR * 8);
    let out = '';
    for (let i = 0; i < BAR; i++) {
      const fill = Math.max(0, Math.min(8, eighths - i * 8));
      const col = heat(((i + 0.5) / BAR) * 100);
      out += fill === 8 ? fg(col, '█') : fill > 0 ? fg(col, PARTS[fill]) : dim('─');
    }
    return `${dim(label)} ${out} ${fg(heat(p), Math.round(p) + '%', true)}`;
  };

  // Time until a rate-limit window resets (resets_at is unix seconds)
  const resetIn = ts => {
    if (typeof ts !== 'number') return '';
    const m = Math.max(0, Math.round((ts * 1000 - Date.now()) / 60000));
    const txt = m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
      : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
    return ' ' + fg(C.teal, '↻ ' + txt);
  };
  const limitBar = (label, w) => {
    const b = bar(label, w?.used_percentage);
    return b && b + resetIn(w?.resets_at);
  };

  // Running subagents, written by subagent-statusline.js for this session
  const agents = (() => {
    try {
      const f = path.join(os.tmpdir(), `claude-agents-${d.session_id}.json`);
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Date.now() - s.t > 15000) return [];
      return s.tasks.filter(t => t.status === 'running');
    } catch { return []; }
  })();

  // --- Line 1: model, effort, agents, folder ---
  const effortColor = { low: C.cyan, medium: C.blue, high: C.purple, xhigh: C.pink, max: C.red };
  const effortDots = { low: '●○○○○', medium: '●●○○○', high: '●●●○○', xhigh: '●●●●○', max: '●●●●●' };
  const cwd = d.workspace?.current_dir || d.cwd || process.cwd();
  const l1 = [pill(C.purple, C.dark, d.model?.display_name || '?')];
  if (d.effort?.level) {
    const col = effortColor[d.effort.level] || C.text;
    l1.push(`${fg(col, effortDots[d.effort.level] || '•')} ${fg(col, d.effort.level, true)}`);
  }
  if (d.agent?.name) l1.push(`${fg(C.yellow, '◆')} ${fg(C.yellow, d.agent.name, true)}`);
  if (agents.length) {
    const names = agents.map(a => a.name || a.agentType || 'agent');
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
    l1.push(`${fg(C.orange, '⚙')} ${fg(C.orange, agents.length, true)} ${dim(shown)}`);
  }
  l1.push(`${fg(C.blue, '▸')} ${fg(C.blue, path.basename(cwd) || cwd, true)}`);

  // --- Line 2: git status ---
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] });
  let l2;
  try {
    let branch = '?', ahead = 0, behind = 0, staged = 0, modified = 0, untracked = 0, conflicts = 0;
    for (const line of git('status', '--porcelain=v2', '--branch').split('\n')) {
      if (line.startsWith('# branch.head ')) branch = line.slice(14);
      else if (line.startsWith('# branch.ab ')) [ahead, behind] = line.slice(12).split(' ').map(n => Math.abs(+n));
      else if (line.startsWith('? ')) untracked++;
      else if (line.startsWith('u ')) conflicts++;
      else if (line.startsWith('1 ') || line.startsWith('2 ')) {
        if (line[2] !== '.') staged++;
        if (line[3] !== '.') modified++;
      }
    }
    const parts = [`${fg(C.purple, '⎇')} ${gradient(branch, C.purple, C.pink, true)}`];
    if (ahead) parts.push(fg(C.green, `↑${ahead}`));
    if (behind) parts.push(fg(C.red, `↓${behind}`));
    const dirty = [];
    if (staged) dirty.push(fg(C.green, `●${staged}`));
    if (modified) dirty.push(fg(C.yellow, `✚${modified}`));
    if (untracked) dirty.push(dim(`?${untracked}`));
    if (conflicts) dirty.push(fg(C.red, `✖${conflicts}`, true));
    parts.push(dirty.length ? dirty.join(' ') : fg(C.green, '✔ clean'));
    let last = '';
    try {
      const [msg, age] = git('log', '-1', '--format=%s%x00%cr').trim().split('\0');
      const short = msg.length > 40 ? msg.slice(0, 39) + '…' : msg;
      last = sep + dim('✎ ') + fg(C.text, `"${short}"`) + dim(` · ${age}`);
    } catch {}
    l2 = parts.join(' ') + last;
  } catch {
    l2 = dim('⎇ not a git repo');
  }

  // --- Line 3: usage and session info ---
  const l3 = [
    bar('ctx', d.context_window?.used_percentage),
    limitBar('5h', d.rate_limits?.five_hour),
    limitBar('7d', d.rate_limits?.seven_day),
  ].filter(Boolean);
  const cost = d.cost || {};
  const session = [];
  if (typeof cost.total_cost_usd === 'number') session.push(fg(C.yellow, `$${cost.total_cost_usd.toFixed(2)}`, true));
  if (typeof cost.total_duration_ms === 'number') {
    const m = Math.floor(cost.total_duration_ms / 60000);
    session.push(fg(C.cyan, `⏱ ${m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}`));
  }
  if (cost.total_lines_added || cost.total_lines_removed)
    session.push(`${fg(C.green, `+${cost.total_lines_added || 0}`)}${dim('/')}${fg(C.red, `-${cost.total_lines_removed || 0}`)}`);
  if (session.length) l3.push(session.join(' '));

  // 3-line bat on the left: gradient wings, glowing eyes, tree connectors
  const batRows = [' /\\_     _/\\ ', '/   \\^o^/   \\', '\\_/\\_/ \\_/\\_/'];
  const bat = batRows.map((row, r) => {
    if (r !== 1) return gradient(row, C.purple, C.pink, true);
    const [left, face, right] = [row.slice(0, 5), row.slice(5, 8), row.slice(8)];
    return gradient(left, C.purple, mix(C.purple, C.pink, 0.4), true)
      + fg(C.yellow, face[0], true) + fg(C.red, face[1], true) + fg(C.yellow, face[2], true)
      + gradient(right, mix(C.purple, C.pink, 0.6), C.pink, true);
  });
  const tree = ['╭─', '├─', '╰─'].map((t, i) => fg(mix(C.purple, C.cyan, i / 2), t));
  const lines = [l1.join(sep), l2, l3.join(sep)];
  process.stdout.write(lines.map((l, i) => `${bat[i]} ${tree[i]} ${l}`).join('\n'));
});
