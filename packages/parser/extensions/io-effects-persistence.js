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

/**
 * BACKUP Effect - Write full graph snapshot to JSON file
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

    // Write to file
    const path = target.replace("file://", "");
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf8');

    return {
      SUCCESS: "TRUE",
      EDGE_COUNT: graph.edges.length,
      TARGET: target,
      TIMESTAMP: data.metadata.timestamp
    };
  },
  category: "persistence",
  doc: "Write full graph snapshot to JSON file. Input: TARGET (optional, default: file://backup.json)"
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
 * SYNC Effect - Incremental backup of edges since watermark
 *
 * Backs up contexts that have timestamps > SINCE_TIME.
 * Timestamps stored as: ctx timestamp time timestamps
 */
const SYNC = {
  execute: async (graph, ctx) => {
    const target = getInput(graph, ctx, "TARGET");
    const sinceTime = getInput(graph, ctx, "SINCE_TIME") || 0;

    if (!target) {
      throw new Error("SYNC requires TARGET input");
    }

    // Query contexts with timestamp > sinceTime
    const allTimestamps = graph.query(["?ctx", "timestamp", "?time", "timestamps"]);
    const recentCtxs = allTimestamps
      .filter(r => r.get("?time") > sinceTime)
      .map(r => r.get("?ctx"));

    // Get all edges for those contexts
    const newEdges = [];
    for (const ctxVal of recentCtxs) {
      const edges = graph.query(["?s", "?a", "?t", ctxVal]);
      for (const edge of edges) {
        newEdges.push({
          source: edge.get("?s"),
          attr: edge.get("?a"),
          target: edge.get("?t"),
          context: ctxVal
        });
      }
    }

    // Append to JSONL file
    const path = target.replace("file://", "");
    for (const edge of newEdges) {
      await fs.appendFile(path, JSON.stringify(edge) + "\n", 'utf8');
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
  doc: "Incremental sync of edges since watermark. Inputs: TARGET, SINCE_TIME (optional, default: 0)"
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
}

// Export individual effects for selective installation
export const persistenceEffects = {
  BACKUP,
  LOAD,
  SYNC,
  REPLAY
};
