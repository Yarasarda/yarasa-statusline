# 🦇 yarasa's statusline

A colorful 3-line status line for [Claude Code](https://claude.com/claude-code), with a bat.

```
 /\_     _/\   Opus 5.5  │  ⚡ high  │  📁 my-project
/   \^o^/   \  ⎇ main ↑1 ●2 ✚1 ?3  │  ✎ "fix login bug" · 2 hours ago
\_/\_/ \_/\_/  ctx ██░░░░░░░░ 21%  │  5h ██████░░░░ 64%  │  7d █████████░ 88%  │  $1.23 ⏱ 1sa 15dk +156/-23
```

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

- Some UI text is in Turkish (`temiz` = clean, `git deposu değil` = not a git repo, `sa`/`dk` = hour/minute). Edit `statusline.js` to change it.
- The last-commit age comes straight from git, so it is in English.

## License

MIT
