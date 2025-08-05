# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bassline is a web-based visual programming environment built on propagation networks - a bidirectional constraint system that supports natural cycles and contradiction handling.

## Conceptual Model

### Propagation Networks
A propagation network is a graph where information flows bidirectionally between nodes. Unlike dataflow systems where data flows in one direction, propagation networks allow constraints to flow in any direction, finding consistent solutions across the entire network.

### Core Abstractions

1. **Contacts**: The fundamental unit of computation
   - Hold a single value (content)
   - Have a blend mode that determines how to handle multiple incoming values
   - Can be wired to other contacts to share information
   - Changes propagate automatically through connected contacts

2. **Groups**: Hierarchical containers for organization and abstraction
   - Contain contacts and other groups (recursive structure)
   - Define computational boundaries
   - Can have boundary contacts that serve as input/output interfaces
   - Enable modular, reusable components

3. **Gadgets**: Groups with computational behavior
   - Regular groups just organize contacts
   - Gadgets (via primitive gadgets) perform computation
   - Have input and output boundary contacts
   - Execute when inputs change and activation conditions are met
   - Examples: add, multiply, string concat, logic gates

4. **Wires**: Connections that propagate information
   - Can be bidirectional (constraint) or directed (dataflow-like)
   - Automatically propagate changes between connected contacts
   - Support cycles without infinite loops (change detection)

### Key Properties
- **Bidirectional**: Information flows both ways through connections
- **Constraint-based**: The network finds solutions that satisfy all constraints
- **Hierarchical**: Groups can contain groups, enabling complex abstractions
- **Live**: Changes propagate immediately (or in batches)
- **Contradiction-aware**: Can detect and handle conflicting constraints

## Current Architecture (v2)

### Technology Stack
- **Framework**: React Router v7 (SPA mode)
- **Graph Visualization**: React Flow
- **UI Components**: shadcn/ui
- **Language**: TypeScript
- **Propagation Engine**: Custom Worker-based implementation

### Core Architecture Components

1. **Propagation Core v2** (`app/propagation-core-v2/`)
   - Pure functional/async propagation engine
   - Worker thread execution for performance
   - Pluggable scheduler system (immediate, batch)
   - Primitive gadgets for computation

2. **Simple Editor** (`app/routes/simple-editor.tsx`)
   - Clean React implementation
   - No manual state synchronization
   - React Flow for visualization
   - Mode system for different interaction patterns

3. **Worker Architecture**
   - `NetworkClient` - Main thread interface
   - `network-worker.ts` - Worker thread implementation
   - Async message passing for all operations
   - Change notifications via subscriptions

### Key Concepts

- **Contacts**: Information-carrying nodes with content and blend modes (accept-last, merge)
- **Groups**: Hierarchical containers that can be regular groups or primitive gadgets
- **Wires**: Connections between contacts (bidirectional or directed)
- **Boundary Contacts**: Input/output interfaces for groups
- **Primitive Gadgets**: Built-in computational units (add, multiply, gate, etc.)

**Important**: This is NOT a traditional dataflow system - it supports bidirectional constraint propagation with natural cycles.

### Development Commands

```bash
npm run dev       # Start development server
npm test          # Run tests
npm run typecheck # Type checking
npm run lint      # Linting
```

### Current Implementation Status

✅ **Completed**:
- Functional/async propagation engine
- Worker thread integration
- Immediate and batch schedulers
- Core primitive gadgets (math, string, logic, control, array)
- Simple editor with React Flow
- Property panels and mode system
- Basic refactoring tools

🚧 **In Progress**:
- Worker-based propagation network
- React Router integration

📋 **Planned**:
- Remove global state management
- Undo/redo functionality
- Distributed propagation support

### Key Design Decisions

1. **Functional over OOP**: Pure functions, immutable data, async operations
2. **Worker Threads**: Propagation runs off main thread for performance
3. **Scheduler Abstraction**: Pluggable scheduling strategies
4. **No Global State**: All state flows through React Router loaders/actions (planned)
5. **Primitive Gadgets**: Functions are resolved in Worker, only IDs cross thread boundary

### Testing

- Unit tests for propagation logic: `__tests__/propagation.test.ts`
- Primitive gadget tests: `__tests__/primitives.test.ts`
- Scheduler tests: `__tests__/*-scheduler.test.ts`
- Worker test page: `/worker-test` route for manual testing

### Important Notes

- Propagation only occurs when content actually changes (prevents infinite loops)
- Primitive gadgets are directional - only execute on input changes
- Batch scheduler processes updates in configurable chunks with delays
- Worker state resets when switching schedulers (current limitation)

### Routes

- `/` - Home page
- `/simple-editor` - Main editor interface
- `/worker-test` - Worker performance testing page

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.