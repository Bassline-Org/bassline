# Bassline Agent Skills

Agent skills for working with Bassline, following the [Agent Skills standard](https://agentskills.io/specification).

Agent skills are markdown files that help LLMs understand and work with your codebase. They provide context, examples, and usage patterns that agents can reference when performing tasks.

## Installation

Install skills to your project:

```bash
# Install all skills to ./skills
npx @bassline/skills install

# Install to a custom path
npx @bassline/skills install --path .claude/skills

# List available skills
npx @bassline/skills list
```

## Available Skills

| Skill      | Description                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------- |
| `bassline` | Complete Bassline documentation - core resources, blits, TCL, database, services, and trust |

## Structure

```
bassline/
├── SKILL.md       # Core concepts and package overview
├── core.md        # Cells, stores, propagators, functions
├── blit.md        # SQLite-backed persistent apps
├── tcl.md         # TCL scripting language
├── database.md    # SQLite connections
├── services.md    # Claude API integration
└── trust.md       # Capability gating
```

## Usage with Claude Code

After installing, add the skills path to your Claude Code settings or place them in `.claude/skills/`.

## Learn More

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
