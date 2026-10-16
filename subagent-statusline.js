// Records this session's subagents so statusline.js can show their count and names.
// Prints nothing, so Claude Code keeps its default subagent rows.
const fs = require('fs');
const os = require('os');
const path = require('path');

let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  try {
    const d = JSON.parse(raw);
    const tasks = (d.tasks || []).map(t => ({ name: t.name, agentType: t.agentType, status: t.status }));
    const f = path.join(os.tmpdir(), `claude-agents-${d.session_id}.json`);
    fs.writeFileSync(f, JSON.stringify({ t: Date.now(), tasks }));
  } catch {}
});
