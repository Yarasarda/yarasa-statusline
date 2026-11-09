const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch {}
  // Son limit değerleri dosyaya yazılır; oturumdaki betikler (ör. "limit %98'de commit at") okuyabilsin.
  if (d.rate_limits) {
    try { fs.writeFileSync(path.join(os.homedir(), '.claude', 'cache', 'rate-limits.json'), JSON.stringify({ at: Date.now(), ...d.rate_limits })); } catch {}
  }

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
  const sep = `  ${fg(C.purple, '╺')}${fg(mix(C.purple, C.cyan, 0.5), '━')}${fg(C.cyan, '╸')}  `;

  // Usage color: green → yellow → red
  const heat = p => (p < 50 ? mix(C.green, C.yellow, p / 50) : mix(C.yellow, C.red, Math.min(1, (p - 50) / 40)));

  // Smooth bar with eighth-blocks, each cell colored by its own position
  const BAR = 8;
  const PARTS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
  const bar = (label, v, width = BAR) => {
    if (typeof v !== 'number') return null;
    const p = Math.max(0, Math.min(100, v));
    const eighths = Math.round((p / 100) * width * 8);
    let out = '';
    for (let i = 0; i < width; i++) {
      const fill = Math.max(0, Math.min(8, eighths - i * 8));
      const col = heat(((i + 0.5) / width) * 100);
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

  // Latest rate limits, so an agent in this session can check how close the 5h/7d windows are.
  try {
    if (d.rate_limits) fs.writeFileSync(path.join(os.tmpdir(), 'claude-limits.json'), JSON.stringify({ t: Date.now(), ...d.rate_limits }));
  } catch {}

  // Running subagents, written by subagent-statusline.js for this session
  const agents = (() => {
    try {
      const f = path.join(os.tmpdir(), `claude-agents-${d.session_id}.json`);
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (Date.now() - s.t > 15000) return [];
      const done = ['completed', 'failed', 'killed', 'stopped', 'cancelled', 'error'];
      return s.tasks.filter(t => !done.includes(String(t.status || '').toLowerCase()));
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
    l1.push(`${fg(C.orange, '⚙')} ${fg(C.orange, agents.length, true)} ${dim(agents.length === 1 ? 'agent' : 'agents')}`);
  }
  l1.push(`${fg(C.blue, '▸')} ${fg(C.blue, path.basename(cwd) || cwd, true)}`);

  // Session cost, duration and burn rate (shown next to the context bar on line 3)
  const cost = d.cost || {};
  const session = [];
  if (typeof cost.total_cost_usd === 'number') session.push(fg(C.yellow, `$${cost.total_cost_usd.toFixed(2)}`, true));
  if (typeof cost.total_duration_ms === 'number') {
    const m = Math.floor(cost.total_duration_ms / 60000);
    session.push(fg(C.cyan, `⏱ ${m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}`));
    if (typeof cost.total_cost_usd === 'number' && m >= 5)
      session.push(fg(C.orange, `🔥$${(cost.total_cost_usd / (m / 60)).toFixed(2)}/h`));
  }

  // Clock with the real moon phase; color drifts from night purple to day yellow
  const now = new Date();
  const lunation = (((now - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588 + 29.530588) % 29.530588;
  const moon = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][Math.round((lunation / 29.530588) * 8) % 8];
  const hour = now.getHours() + now.getMinutes() / 60;
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  l1.push(`${moon} ${fg(mix(C.purple, C.yellow, daylight), hhmm, true)}`);

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
    if (cost.total_lines_added || cost.total_lines_removed)
      parts.push(`${fg(C.green, `+${cost.total_lines_added || 0}`)}${dim('/')}${fg(C.red, `-${cost.total_lines_removed || 0}`)}`);
    let last = '';
    try {
      const [msg, age] = git('log', '-1', '--format=%s%x00%cr').trim().split('\0');
      const short = msg.length > 34 ? msg.slice(0, 33) + '…' : msg;
      last = sep + dim('✎ ') + fg(C.text, `"${short}"`) + dim(` · ${age}`);
    } catch {}
    l2 = parts.join(' ') + last;
  } catch {
    l2 = dim('⎇ not a git repo');
  }

  // --- Line 3: context (wide bar) and session; line 4: rate limits ---
  const kfmt = n => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1000) + 'k');
  const ctxBar = (() => {
    const cw = d.context_window || {};
    const b = bar('ctx', cw.used_percentage, BAR * 2);
    if (!b) return null;
    const size = cw.context_window_size;
    const used = typeof cw.total_input_tokens === 'number' ? cw.total_input_tokens
      : typeof size === 'number' ? (size * cw.used_percentage) / 100 : null;
    const tokens = typeof used === 'number' && typeof size === 'number' ? ' ' + dim(`${kfmt(used)}/${kfmt(size)}`) : '';
    return b + tokens + (cw.used_percentage >= 80 ? ' ' + fg(C.red, '⚠', true) : '');
  })();
  const l3 = [ctxBar, session.join(' ')].filter(Boolean);
  const l4 = [
    limitBar('5h', d.rate_limits?.five_hour),
    limitBar('7d', d.rate_limits?.seven_day),
  ].filter(Boolean);

  // Bat on the left: gradient wings, glowing eyes that pulse and sometimes blink, twinkling stars below.
  // The status line refreshes every few seconds, so the frame is picked from the clock.
  const tick = Math.floor(Date.now() / 5000);
  const blink = tick % 7 === 0;
  const eye = mix(C.yellow, C.orange, (Math.sin(tick * 1.3) + 1) / 2);
  const batRows = [' /\\_     _/\\ ', '/   \\^o^/   \\', '\\_/\\_/ \\_/\\_/'];
  const bat = batRows.map((row, r) => {
    if (r !== 1) return gradient(row, C.purple, C.pink, true);
    const [left, right] = [row.slice(0, 5), row.slice(8)];
    const e = blink ? '-' : '^';
    return gradient(left, C.purple, mix(C.purple, C.pink, 0.4), true)
      + fg(eye, e, true) + fg(C.red, 'o', true) + fg(eye, e, true)
      + gradient(right, mix(C.purple, C.pink, 0.6), C.pink, true);
  });
  // Night sky under the bat: each star slot twinkles on its own rhythm
  const stars = [...'  ✦   ·   ✧  '].map((ch, i) => {
    if (ch === ' ') return ch;
    const t = (Math.sin(tick * 0.9 + i * 2.1) + 1) / 2;
    return fg(mix(C.muted, i % 2 ? C.cyan : C.yellow, t), t < 0.25 ? '·' : ch, t > 0.7);
  }).join('');
  bat.push(stars);
  // Line 4 only exists when there are rate limits (subscription plans)
  // Running subagents get their own line(s) under the limits: every name, wrapped to the terminal width.
  const agentLines = [];
  if (agents.length) {
    const spin = ['◐', '◓', '◑', '◒'][tick % 4];
    const width = Math.max(40, (process.stdout.columns || +process.env.COLUMNS || 120) - 20);
    let cur = [], len = 0;
    for (const a of agents) {
      const name = String(a.name || a.agentType || 'agent');
      const n = name.length > 28 ? name.slice(0, 27) + '…' : name;
      const tk = typeof a.tokens === 'number' ? kfmt(a.tokens) : '';
      if (cur.length && len + n.length + tk.length + 5 > width) { agentLines.push(cur.join(dim(' · '))); cur = []; len = 0; }
      cur.push(`${fg(C.orange, spin)} ${fg(C.text, n)}${tk ? ' ' + dim(tk) : ''}`);
      len += n.length + tk.length + 6;
    }
    if (cur.length) agentLines.push(cur.join(dim(' · ')));
  }
  const lines = [l1.join(sep), l2, l3.join(sep), l4.join(sep)].filter((l, i) => i < 3 || l).concat(agentLines);
  while (bat.length < lines.length) bat.push(' '.repeat(13));
  const tree = lines.map((_, i) => fg(mix(C.purple, C.cyan, i / (lines.length - 1)),
    i === 0 ? '╭─' : i === lines.length - 1 ? '╰─' : '├─'));
  // Each line starts with a reset code: Claude Code trims leading spaces, which shifted the bat's first row left.
  process.stdout.write(lines.map((l, i) => `\x1b[0m${bat[i]} ${tree[i]} ${l}`).join('\n'));
});
