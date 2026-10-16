const { execFileSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let d = {};
  try { d = JSON.parse(raw); } catch {}

  const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
  const dim = s => c('2', s);
  const sep = dim('  │  ');

  // Color by usage: green → yellow → red
  const heat = p => (p < 50 ? '32' : p < 80 ? '33' : '31');
  const bar = (label, v) => {
    if (typeof v !== 'number') return null;
    const p = Math.max(0, Math.min(100, Math.round(v)));
    const filled = Math.round(p / 10);
    return `${dim(label)} ${c(heat(p), '█'.repeat(filled))}${dim('░'.repeat(10 - filled))} ${c('1;' + heat(p), p + '%')}`;
  };

  // --- Line: model, efor, ajan, klasör ---
  const effortColor = { low: '36', medium: '34', high: '35', xhigh: '1;35', max: '1;31' };
  const cwd = d.workspace?.current_dir || d.cwd || process.cwd();
  const l1 = [c('1;36', d.model?.display_name || '?')];
  if (d.effort?.level) l1.push(`⚡ ${c(effortColor[d.effort.level] || '37', d.effort.level)}`);
  if (d.agent?.name) l1.push(`🤖 ${c('1;33', d.agent.name)}`);
  l1.push(`📁 ${c('1;34', path.basename(cwd) || cwd)}`);

  // --- Line: git durumu ---
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
    const parts = [`${c('35', '⎇')} ${c('1;35', branch)}`];
    if (ahead) parts.push(c('32', `↑${ahead}`));
    if (behind) parts.push(c('31', `↓${behind}`));
    const dirty = [];
    if (staged) dirty.push(c('32', `●${staged}`));
    if (modified) dirty.push(c('33', `✚${modified}`));
    if (untracked) dirty.push(c('90', `?${untracked}`));
    if (conflicts) dirty.push(c('1;31', `✖${conflicts}`));
    parts.push(dirty.length ? dirty.join(' ') : c('32', '✔ clean'));
    let last = '';
    try {
      const [msg, age] = git('log', '-1', '--format=%s%x00%cr').trim().split('\0');
      const short = msg.length > 40 ? msg.slice(0, 39) + '…' : msg;
      last = sep + dim(`✎ "${short}" · ${age}`);
    } catch {}
    l2 = parts.join(' ') + last;
  } catch {
    l2 = dim('not a git repo');
  }

  // --- Line: kullanım ve oturum bilgisi ---
  const l3 = [
    bar('ctx', d.context_window?.used_percentage),
    bar('5h', d.rate_limits?.five_hour?.used_percentage),
    bar('7d', d.rate_limits?.seven_day?.used_percentage),
  ].filter(Boolean);
  const cost = d.cost || {};
  const session = [];
  if (typeof cost.total_cost_usd === 'number') session.push(c('33', `$${cost.total_cost_usd.toFixed(2)}`));
  if (typeof cost.total_duration_ms === 'number') {
    const m = Math.floor(cost.total_duration_ms / 60000);
    session.push(c('36', `⏱ ${m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`}`));
  }
  if (cost.total_lines_added || cost.total_lines_removed)
    session.push(`${c('32', `+${cost.total_lines_added || 0}`)}${dim('/')}${c('31', `-${cost.total_lines_removed || 0}`)}`);
  if (session.length) l3.push(session.join(' '));

  // 3-line bat on the left
  const bat = [' /\\_     _/\\ ', '/   \\^o^/   \\', '\\_/\\_/ \\_/\\_/'].map(s => c('1;35', s));
  const lines = [l1.join(sep), l2, l3.join(sep)];
  process.stdout.write(lines.map((l, i) => `${bat[i]}  ${l}`).join('\n'));
});
