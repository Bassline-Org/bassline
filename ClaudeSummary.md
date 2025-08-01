# Visual Propagation Network Editor - Project Summary

## Core Concept
Building a visual programming environment for **propagation networks** - computational systems where information flows asynchronously between "cells" that merge partial information using semi-lattice operations. Think constraint programming meets visual dataflow, with true bidirectional semantics.

## Technical Architecture

### Fundamental Primitives
- **Contacts**: Information-carrying cells with content and blend modes for merging incoming data
- **ContactGroups**: Collections of contacts that form computational boundaries  
- **ContactGroupWires**: Connections that propagate information between contacts
- **Boundary Contacts**: Special interface contacts that create clean abstraction boundaries

### Key Constraints
- Internal contacts can only connect to other internal contacts within same group, OR to boundary contacts of subgroups
- Boundary contacts serve as explicit interfaces between abstraction levels
- Information propagation is event-driven and asynchronous
- All connections are naturally bidirectional (constraint-style, not dataflow-style)

### Hierarchical Composition
- Groups can contain subgroups arbitrarily deep
- Boundary contacts prevent "connection span" problems - all visible connections are local to current scope
- Built-in refactoring operations: extract subgroups, abstract boundaries, move contacts/wires

## Visual Programming Paradigm

### Core Philosophy
- **Topology IS semantics** - the network structure directly encodes computation
- **Cycles are features** - bidirectional constraints create natural cycles
- **Progressive disclosure** - manage complexity through hierarchical scoping, not overwhelming canvases

### UI Approach (Target)
- **Pager flow** (like Glamorous Toolkit inspectors) instead of traditional canvas editor
- Navigate right to go deeper into subgroups, left to go up hierarchy levels  
- Each "page" shows one abstraction level - complete visual isolation between levels
- Inspired by Dreams' scoped-in views for complexity management

### Refactoring Workflow
1. Build messy flat networks initially
2. Gradually abstract key connection points to boundary contacts
3. Extract stable patterns into reusable subgroups  
4. Build libraries of proven "gadgets"

## Implementation Goals

### Immediate: Web Frontend
- Implement the pager navigation flow
- Visual contact/wire editor for each page
- Boundary contact interface between pages
- Basic refactoring operations (add contacts, connect, abstract boundaries)

### Long-term Vision
- Full constraint propagation with semi-lattices
- Zoomable UI (after validating with pager flow)
- Export to executable constraint systems
- Domain-specific gadget libraries

## Key Differentiators
- **Not tree-based** like traditional programming - naturally handles cycles and bidirectional flow
- **Visual structure matches computational semantics** - no hidden execution model
- **True compositionality** through boundary contacts - subgroups are black boxes with explicit interfaces
- **Refactoring-driven development** - evolve from messy to organized incrementally

The goal is to create the first practical visual programming environment for constraint-style computation, where the visual metaphor genuinely enhances rather than hinders the programming experience.

