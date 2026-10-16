# 🦇 yarasa's statusline

A colorful 3-line status line for [Claude Code](https://claude.com/claude-code), with a bat.

![yarasa-statusline preview](docs/preview.svg)

- **Line 1:** model, effort level, agent name (with `--agent`), current folder
- **Line 2:** git branch, ahead/behind, staged/modified/untracked/conflicts, last commit
- **Line 3:** context / 5-hour / 7-day usage bars (green → yellow → red), session cost, duration, lines changed

## Install

Requires [Node.js](https://nodejs.org) and `git`. No other dependencies.

1. Download `statusline.js` to `~/.claude/statusline.js`.
2. Add this to `~/.claude/settings.json` (on Windows use forward slashes, e.g. `C:/Users/you/.claude/statusline.js`):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js"
  }
}
```

3. Restart Claude Code.

## Notes

- The last-commit age comes straight from git.
- Session duration is shown as `1h 15m`.

## License

MIT
