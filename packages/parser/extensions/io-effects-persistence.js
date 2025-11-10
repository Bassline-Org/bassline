/**
 * Persistence Effects
 *
 * Graph persistence using IO contexts pattern.
 * Provides snapshot and incremental sync capabilities.
 *
 * Usage:
 *   // Snapshot backup
 *   graph.add("backup1", "TARGET", "file://db.json", null);
 *   graph.add("backup1", "handle", "BACKUP", "input");
 *
 *   // Restore from snapshot
 *   graph.add("load1", "SOURCE", "file://db.json", null);
 *   graph.add("load1", "handle", "LOAD", "input");
 *
 *   // Incremental sync
 *   graph.add("sync1", "TARGET", "file://log.jsonl", null);
 *   graph.add("sync1", "SINCE_TIME", lastTime, null);
 *   graph.add("sync1", "handle", "SYNC", "input");
 *
 *   // Replay from log
 *   graph.add("replay1", "SOURCE", "file://log.jsonl", null);
 *   graph.add("replay1", "handle", "REPLAY", "input");
 */

import { promises as fs } from 'fs';
import { getInput, installIOEffect } from './io-effects.js';
import {
  matchGraph,
  pattern as pat,
  patternQuad as pq,
} from "../src/algebra/pattern.js";
import { variable as v, word as w } from "../src/types.js";

/**
 * BACKUP Effect - Write full graph snapshot to JSON file (atomic)
 *
 * Uses temp file + rename for atomic writes to prevent corruption
 */
const BACKUP = {
  execute: async (graph, ctx) => {
    const target = getInput(graph, ctx, "TARGET") || "file://backup.json";

    // Build snapshot
    const data = {
      metadata: {
        timestamp: Date.now(),
        edgeCount: graph.edges.length,
        contexts: graph.listContexts()
      },
      edges: graph.edges  // All edges (s, a, t, c)
    };

    // Write atomically: temp file + rename
    const path = target.replace("file://", "");
    const tempPath = path + '.tmp';

    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, path);  // Atomic operation!

    return {
      SUCCESS: "TRUE",
      EDGE_COUNT: graph.edges.length,
      TARGET: target,
      TIMESTAMP: data.metadata.timestamp
    };
  },
  category: "persistence",
  doc: "Write full graph snapshot to JSON file (atomic). Input: TARGET (optional, default: file://backup.json)"
};

/**
 * LOAD Effect - Restore graph from JSON snapshot
 */
const LOAD = {
  execute: async (graph, ctx) => {
    const source = getInput(graph, ctx, "SOURCE");

    if (!source) {
      throw new Error("LOAD requires SOURCE input");
    }

    // Read snapshot
    const path = source.replace("file://", "");
    const content = await fs.readFile(path, 'utf8');
    const data = JSON.parse(content);

    // Add all edges (deduplication handled by graph.add())
    let loadedCount = 0;
    for (const edge of data.edges) {
      graph.add(edge.source, edge.attr, edge.target, edge.context);
      loadedCount++;
    }

    return {
      SUCCESS: "TRUE",
      LOADED_COUNT: loadedCount,
      SOURCE: source,
      TIMESTAMP: data.metadata?.timestamp
    };
  },
  category: "persistence",
  doc: "Restore graph from JSON snapshot. Input: SOURCE"
};

/**
 * SYNC Effect - Incremental backup of edges since watermark (atomic)
 *
 * Backs up contexts that have timestamps > SINCE_TIME.
 * Timestamps stored as: ctx timestamp time timestamps
 * Uses batched writes for atomicity
 */
const SYNC = {
  execute: async (graph, ctx) => {
    const target = getInput(graph, ctx, "TARGET");
    const sinceTime = getInput(graph, ctx, "SINCE_TIME") || 0;

    if (!target) {
      throw new Error("SYNC requires TARGET input");
    }

    // Query contexts with timestamp > sinceTime
    const allTimestamps = matchGraph(graph, pat(pq(v("ctx"), w("timestamp"), v("time"), w("timestamps"))));
    const recentCtxs = allTimestamps
      .filter(r => r.get("time") > sinceTime)
      .map(r => r.get("ctx"));

    // Get all edges for those contexts
    const newEdges = [];
    for (const ctxVal of recentCtxs) {
      const edges = matchGraph(graph, pat(pq(v("s"), v("a"), v("t"), ctxVal)));
      for (const edge of edges) {
        newEdges.push({
          source: edge.get("s"),
          attr: edge.get("a"),
          target: edge.get("t"),
          context: ctxVal
        });
      }
    }

    // Append to JSONL file atomically (single write)
    if (newEdges.length > 0) {
      const path = target.replace("file://", "");
      const content = newEdges.map(e => JSON.stringify(e)).join("\n") + "\n";
      await fs.appendFile(path, content, 'utf8');
    }

    // Compute max timestamp from synced contexts
    const timestamps = allTimestamps
      .filter(r => recentCtxs.includes(r.get("?ctx")))
      .map(r => r.get("?time"));
    const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : sinceTime;

    return {
      SUCCESS: "TRUE",
      SYNCED_COUNT: newEdges.length,
      LAST_TIME: maxTime,
      TARGET: target
    };
  },
  category: "persistence",
  doc: "Incremental sync of edges since watermark (atomic). Inputs: TARGET, SINCE_TIME (optional, default: 0)"
};

/**
 * REPLAY Effect - Read JSONL log and apply edges
 */
const REPLAY = {
  execute: async (graph, ctx) => {
    const source = getInput(graph, ctx, "SOURCE");

    if (!source) {
      throw new Error("REPLAY requires SOURCE input");
    }

    // Read JSONL file
    const path = source.replace("file://", "");
    const content = await fs.readFile(path, 'utf8');
    const lines = content.split("\n").filter(l => l.trim());

    // Apply each edge
    let count = 0;
    for (const line of lines) {
      const edge = JSON.parse(line);
      graph.add(edge.source, edge.attr, edge.target, edge.context);
      count++;
    }

    return {
      SUCCESS: "TRUE",
      REPLAYED_COUNT: count,
      SOURCE: source
    };
  },
  category: "persistence",
  doc: "Replay edges from JSONL log. Input: SOURCE"
};

/**
 * PRUNE_TOMBSTONES Effect - Remove edges marked with tombstone context
 *
 * Removes all edges where context === "tombstone" from the graph.
 * This is a garbage collection operation for long-running graphs.
 *
 * Usage:
 *   // Mark edges for deletion
 *   graph.add("old-data", "deleted", "TRUE", "tombstone");
 *
 *   // Prune all tombstones
 *   graph.add("prune1", "handle", "PRUNE_TOMBSTONES", "input");
 */
const PRUNE_TOMBSTONES = {
  execute: async (graph, ctx) => {
    const before = graph.edges.length;

    // Filter out tombstoned edges
    graph.edges = graph.edges.filter(e => e.context !== "tombstone");

    const removed = before - graph.edges.length;

    return {
      SUCCESS: "TRUE",
      REMOVED: removed,
      BEFORE: before,
      AFTER: graph.edges.length
    };
  },
  category: "persistence",
  doc: "Remove all edges with tombstone context. No inputs required."
};

/**
 * Install all persistence effects on a graph
 */
export function installAllPersistence(graph) {
  installIOEffect(graph, "BACKUP", BACKUP.execute, {
    category: BACKUP.category,
    doc: BACKUP.doc
  });

  installIOEffect(graph, "LOAD", LOAD.execute, {
    category: LOAD.category,
    doc: LOAD.doc
  });

  installIOEffect(graph, "SYNC", SYNC.execute, {
    category: SYNC.category,
    doc: SYNC.doc
  });

  installIOEffect(graph, "REPLAY", REPLAY.execute, {
    category: REPLAY.category,
    doc: REPLAY.doc
  });

  installIOEffect(graph, "PRUNE_TOMBSTONES", PRUNE_TOMBSTONES.execute, {
    category: PRUNE_TOMBSTONES.category,
    doc: PRUNE_TOMBSTONES.doc
  });
}

// Export individual effects for selective installation
export const persistenceEffects = {
  BACKUP,
  LOAD,
  SYNC,
  REPLAY,
  PRUNE_TOMBSTONES
};
