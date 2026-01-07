# Bassline Agent Skills

Agent skills for working with Bassline, following the [Agent Skills standard](https://agentskills.io/specification).

Agent skills are markdown files that help LLMs understand and work with your codebase. They provide context, examples, and usage patterns that agents can reference when performing tasks.

## Usage

Copy the `bassline/` directory to your project's skills location (e.g., `.claude/skills/`).

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

## Learn More

- [Agent Skills Specification](https://agentskills.io/specification)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
