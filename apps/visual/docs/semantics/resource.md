---
id: resource
name: Resource
summary: Bridge to external resources like shell commands and APIs
---

# Description

The Resource semantic connects your entity graph to external systems. It executes a resource (like a shell command) for each input entity or as a standalone operation, storing results back as attributes.

This enables powerful workflows:
- Read file contents into entities
- Execute commands per-entity with interpolated arguments
- Store external data as entity attributes for further processing

Results are persisted to the Resource entity itself and also attached to output entities for downstream composition.

# Usage

## Core Configuration

- `resource.path` = Resource path (default: `/shell`)
- `resource.output` = Attribute name to store result (default: `resource.result`)
- `resource.auto` = `true` to auto-execute when inputs change

## Shell Resource

When `resource.path = /shell`:

- `shell.cmd` = Command template with `{{attr}}` interpolation
- `shell.cwd` = Working directory template (optional)

Use `{{attrName}}` to interpolate entity attributes into the command.

## Execution Modes

**Standalone**: When no entities are bound, the command runs once. Use this for commands that don't need per-entity context.

**Per-entity**: When entities are bound, the command runs once per entity with that entity's attributes available for interpolation.

# Examples

## Read file contents

```
resource.path = /shell
shell.cmd = cat {{filepath}}
resource.output = content
```

## List directory contents

```
resource.path = /shell
shell.cmd = ls -la {{directory}}
resource.output = listing
```

## Git status for each project

```
resource.path = /shell
shell.cmd = git -C {{path}} status --short
shell.cwd = {{path}}
resource.output = git.status
```

## Run tests per module

```
resource.path = /shell
shell.cmd = npm test -- {{testPath}}
shell.cwd = {{projectRoot}}
resource.output = test.result
resource.auto = true
```

## Count lines in files

```
resource.path = /shell
shell.cmd = wc -l < {{filepath}}
resource.output = lineCount
```

## Compile TypeScript files

```
resource.path = /shell
shell.cmd = tsc --noEmit {{filepath}}
resource.output = compile.result
```
