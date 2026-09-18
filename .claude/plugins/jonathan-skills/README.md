# jonathan-skills — Claude Code marketplace

A personal Claude Code marketplace containing the **interface-design** plugin.

## Structure

```
.claude-plugin/marketplace.json          # marketplace manifest (lists plugins)
plugins/interface-design/
  .claude-plugin/plugin.json             # plugin manifest
  skills/interface-design/SKILL.md       # the skill
```

## Install

### Option A — from a Git repo (use it on any machine)

1. Push this folder to a GitHub repo, e.g. `your-username/claude-skills`.
2. In Claude Code:
   ```
   /plugin marketplace add your-username/claude-skills
   /plugin install interface-design@jonathan-skills
   ```

### Option B — from a local folder (single machine, no Git)

```
/plugin marketplace add /absolute/path/to/interface-design-marketplace
/plugin install interface-design@jonathan-skills
```

After installing, start a new session. The skill auto-triggers on UI/design work,
or invoke it explicitly with `/interface-design`.

## Updating

Bump `version` in `plugins/interface-design/.claude-plugin/plugin.json`, push, then
in Claude Code: `/plugin marketplace update jonathan-skills`.

## Notes

- The skill references two commands (`/interface-design:design-review`,
  `/interface-design:design-deslop`). Those are separate command files that were not
  present to copy, so they're not bundled here — the core skill works without them.
  To add them later, drop the command markdown files in
  `plugins/interface-design/commands/` and reinstall.
