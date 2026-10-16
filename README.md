# 🦇 yarasa's statusline

A colorful 4-line status line for [Claude Code](https://claude.com/claude-code), with a bat that blinks under a twinkling sky.

![yarasa-statusline preview](docs/preview.svg)

- **Line 1:** model, effort level, agent name (with `--agent`), running subagents (count + names), current folder, clock with the real moon phase
- **Line 2:** git branch, ahead/behind, staged/modified/untracked/conflicts, lines changed this session, last commit
- **Line 3:** wide context bar (green → yellow → red) with token count and a ⚠ above 80%, session cost, duration, burn rate ($/h)
- **Line 4:** 5-hour / 7-day usage bars with time until reset (hidden when there are no rate limits)

## Install

Requires [Node.js](https://nodejs.org) and `git`. No other dependencies.

1. Download `statusline.js` and `subagent-statusline.js` to `~/.claude/`.
2. Add this to `~/.claude/settings.json` (on Windows use forward slashes, e.g. `C:/Users/you/.claude/statusline.js`):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js",
    "refreshInterval": 5
  },
  "subagentStatusLine": {
    "type": "command",
    "command": "node ~/.claude/subagent-statusline.js"
  }
}
```

`subagent-statusline.js` only records the running subagents of the session to a temp file so the main status line can show them; it keeps Claude Code's default subagent rows.

3. Restart Claude Code.

## Notes

- The last-commit age comes straight from git.
- Session duration is shown as `1h 15m`.
- The bat's eyes and the stars change with each refresh, so `refreshInterval` keeps them moving.
- `node docs/make-preview.js` regenerates the preview image from the real output.

## License

MIT
