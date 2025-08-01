# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 IMPORTANT: Read Context Documentation First! 🚨

**Before starting ANY work in this repository, you MUST read:**
1. `bassline-web/context/implementation-journal.md` - Detailed implementation history, architecture decisions, and lessons learned
2. `bassline-web/context/quick-reference.md` - Quick reference for current architecture and common patterns

These files contain CRITICAL information about:
- What has already been built and tested
- Architecture decisions and why they were made
- Common pitfalls that have been discovered and fixed
- The current state of the implementation

**Failing to read these will likely result in repeating past mistakes or breaking existing functionality.**

## Project Overview

Bassline is a web frontend implementation for a visual programming environment based on propagation networks. This follows an existing Pharo Smalltalk implementation and represents the first dedicated web-based interface for the system.

## Technology Stack

- **Backend/Framework**: React Router v7 (full-stack framework)
- **Graph Visualization**: React Flow for visual node/edge editing
- **UI Components**: shadcn/ui for consistent component library
- **Language**: TypeScript (assumed with React Router v7)

## Core Concepts

The system is built around:
- **Contacts**: Information-carrying cells with content and blend modes
- **ContactGroups**: Collections of contacts forming computational boundaries  
- **ContactGroupWires**: Connections propagating information between contacts
- **Boundary Contacts**: Interface contacts that create abstraction boundaries

Key differentiator: This is NOT a traditional dataflow system - it supports bidirectional constraint propagation with natural cycles.

## React Flow Integration

When implementing with React Flow:
- Map Contacts to React Flow nodes
- Map ContactGroupWires to React Flow edges
- Use custom node types for different Contact types (regular vs boundary)
- Implement hierarchical navigation through nested React Flow instances
- Consider using React Flow's subflows for ContactGroups

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture Guidelines

1. **Routing Structure** (React Router v7):
   - Use nested routes for the pager navigation model
   - Each ContactGroup level gets its own route
   - Implement breadcrumb navigation for hierarchy

2. **Component Structure**:
   - Use shadcn components for UI consistency
   - Create custom React Flow node components for Contacts
   - Implement edge components for ContactGroupWires
   - Build boundary contact interfaces as special node types

3. **State Management**:
   - Leverage React Router v7's data loading patterns
   - Consider using React Flow's internal state for graph data
   - Implement propagation logic separate from visualization

## Key Documentation

- `README.org`: Comprehensive technical specification and propagation network theory
- `ClaudeSummary.md`: Implementation strategy and UI/UX plans
- Existing Pharo implementation serves as reference for behavior and semantics