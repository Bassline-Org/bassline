/**
 * Persistence Effects Tests
 *
 * Tests for snapshot backup/restore and incremental sync.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../src/minimal-graph.js';
import { installAllPersistence } from '../extensions/io-effects-persistence.js';
import { installReifiedRules } from '../extensions/reified-rules.js';
import { installReifiedAggregations, builtinAggregations } from '../extensions/aggregation/index.js';
import { createContext } from '../src/pattern-words.js';
import { isHandled, getOutput } from '../extensions/io-effects.js';
import { promises as fs } from 'fs';

// Helper: wait for effect to complete
async function waitForEffect(graph, effectName, ctx, maxWait = 1000) {
  const startTime = Date.now();
  while (!isHandled(graph, effectName, ctx)) {
    if (Date.now() - startTime > maxWait) {
      throw new Error(`Timeout waiting for ${effectName} to handle ${ctx}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe("Persistence - Snapshot", () => {
  let graph;
  let testFile;

  beforeEach(() => {
    graph = new Graph();
    installAllPersistence(graph);
    testFile = `/tmp/bassline-test-${Date.now()}.json`;
  });

  it("should backup and restore graph", async () => {
    // Add data
    graph.add("alice", "age", 30, null);
    graph.add("bob", "age", 25, null);
    graph.add("alice", "city", "NYC", null);

    // Backup
    graph.add("backup1", "TARGET", `file://${testFile}`, null);
    graph.add("backup1", "handle", "BACKUP", "input");
    await waitForEffect(graph, "BACKUP", "backup1");

    // Verify backup succeeded
    const success = getOutput(graph, "backup1", "SUCCESS");
    const edgeCount = getOutput(graph, "backup1", "EDGE_COUNT");
    expect(success).toBe("TRUE");
    // Edge count includes system edges from effects, so just verify it's >= our data edges
    expect(edgeCount).toBeGreaterThanOrEqual(3);

    // Clear graph
    graph.edges = [];
    expect(graph.edges.length).toBe(0);

    // Load
    graph.add("load1", "SOURCE", `file://${testFile}`, null);
    graph.add("load1", "handle", "LOAD", "input");
    await waitForEffect(graph, "LOAD", "load1");

    // Verify load succeeded
    const loadSuccess = getOutput(graph, "load1", "SUCCESS");
    const loadedCount = getOutput(graph, "load1", "LOADED_COUNT");
    expect(loadSuccess).toBe("TRUE");
    expect(loadedCount).toBeGreaterThanOrEqual(3);

    // Verify data restored (includes system edges)
    expect(graph.edges.length).toBeGreaterThanOrEqual(3);
    const aliceAge = graph.query(["alice", "age", "?a", "*"]);
    expect(aliceAge[0].get("?a")).toBe(30);

    // Cleanup
    await fs.unlink(testFile);
  });

  it("should preserve contexts", async () => {
    const ctx = "my-special-context";
    graph.add("alice", "name", "Alice", ctx);
    graph.add("bob", "name", "Bob", ctx);

    // Backup
    graph.add("backup2", "TARGET", `file://${testFile}`, null);
    graph.add("backup2", "handle", "BACKUP", "input");
    await waitForEffect(graph, "BACKUP", "backup2");

    // Clear and load
    graph.edges = [];
    graph.add("load2", "SOURCE", `file://${testFile}`, null);
    graph.add("load2", "handle", "LOAD", "input");
    await waitForEffect(graph, "LOAD", "load2");

    // Verify context preserved
    const result = graph.query(["alice", "name", "?n", ctx]);
    expect(result.length).toBe(1);
    expect(result[0].get("?n")).toBe("Alice");

    // Cleanup
    await fs.unlink(testFile);
  });

  it("should reactivate rules on load", async () => {
    const context = createContext(graph);
    installReifiedRules(graph, context);

    // Define and activate rule (use uppercase for pattern matching)
    graph.add("ADULT", "TYPE", "RULE!", "system");
    graph.add("ADULT", "matches", "?p AGE ?a *", "ADULT");
    graph.add("ADULT", "produces", "?p ADULT TRUE *", "ADULT");
    graph.add("ADULT", "memberOf", "rule", "system");

    // Add data - rule should fire
    graph.add("alice", "AGE", 30, null);

    // Verify rule fired
    const adultBefore = graph.query(["alice", "ADULT", "?v", "*"]);
    expect(adultBefore.length).toBe(1);
    expect(adultBefore[0].get("?v")).toBe("TRUE");

    // Backup
    graph.add("backup3", "TARGET", `file://${testFile}`, null);
    graph.add("backup3", "handle", "BACKUP", "input");
    await waitForEffect(graph, "BACKUP", "backup3");

    // Clear and reinstall
    graph.edges = [];
    graph.patterns = [];
    installReifiedRules(graph, context);

    // Load
    graph.add("load3", "SOURCE", `file://${testFile}`, null);
    graph.add("load3", "handle", "LOAD", "input");
    await waitForEffect(graph, "LOAD", "load3");

    // Verify rule reactivated and fired
    const adultAfter = graph.query(["alice", "ADULT", "?v", "*"]);
    expect(adultAfter.length).toBe(1);
    expect(adultAfter[0].get("?v")).toBe("TRUE");

    // Cleanup
    await fs.unlink(testFile);
  });

  it("should handle empty graph", async () => {
    // Note: Graph has system edges from installing persistence
    // Backup includes those system edges
    graph.add("backup4", "TARGET", `file://${testFile}`, null);
    graph.add("backup4", "handle", "BACKUP", "input");
    await waitForEffect(graph, "BACKUP", "backup4");

    const edgeCount = getOutput(graph, "backup4", "EDGE_COUNT");
    // System edges from persistence installation are included
    expect(edgeCount).toBeGreaterThan(0);

    // Load backup
    graph.edges = [];
    graph.add("load4", "SOURCE", `file://${testFile}`, null);
    graph.add("load4", "handle", "LOAD", "input");
    await waitForEffect(graph, "LOAD", "load4");

    const loadedCount = getOutput(graph, "load4", "LOADED_COUNT");
    expect(loadedCount).toBeGreaterThan(0);

    // Cleanup
    await fs.unlink(testFile);
  });
});

describe("Persistence - Incremental Sync", () => {
  let graph;
  let testFile;

  beforeEach(() => {
    graph = new Graph();
    installAllPersistence(graph);
    testFile = `/tmp/bassline-test-sync-${Date.now()}.jsonl`;
  });

  it("should sync only new edges", async () => {
    // Add first batch with timestamps
    const ctx1 = "edit:batch1";
    graph.add("alice", "age", 30, ctx1);
    graph.add("alice", "city", "NYC", ctx1);
    graph.add(ctx1, "timestamp", 1000, "timestamps");

    // First sync
    graph.add("sync1", "TARGET", `file://${testFile}`, null);
    graph.add("sync1", "SINCE_TIME", 0, null);
    graph.add("sync1", "handle", "SYNC", "input");
    await waitForEffect(graph, "SYNC", "sync1");

    const count1 = getOutput(graph, "sync1", "SYNCED_COUNT");
    const lastTime1 = getOutput(graph, "sync1", "LAST_TIME");
    expect(count1).toBe(2);  // alice's edges
    expect(lastTime1).toBe(1000);

    // Add second batch with later timestamp
    const ctx2 = "edit:batch2";
    graph.add("bob", "age", 25, ctx2);
    graph.add(ctx2, "timestamp", 2000, "timestamps");

    // Second sync - should only sync bob's edge
    graph.add("sync2", "TARGET", `file://${testFile}`, null);
    graph.add("sync2", "SINCE_TIME", 1000, null);
    graph.add("sync2", "handle", "SYNC", "input");
    await waitForEffect(graph, "SYNC", "sync2");

    const count2 = getOutput(graph, "sync2", "SYNCED_COUNT");
    const lastTime2 = getOutput(graph, "sync2", "LAST_TIME");
    expect(count2).toBe(1);  // Only bob's edge
    expect(lastTime2).toBe(2000);

    // Cleanup
    await fs.unlink(testFile);
  });

  it("should replay from JSONL log", async () => {
    // Create JSONL with edges
    const edges = [
      { source: "alice", attr: "age", target: 30, context: "ctx1" },
      { source: "bob", attr: "age", target: 25, context: "ctx2" },
      { source: "alice", attr: "city", target: "NYC", context: "ctx1" }
    ];

    const content = edges.map(e => JSON.stringify(e)).join("\n") + "\n";
    await fs.writeFile(testFile, content, 'utf8');

    // Replay
    graph.add("replay1", "SOURCE", `file://${testFile}`, null);
    graph.add("replay1", "handle", "REPLAY", "input");
    await waitForEffect(graph, "REPLAY", "replay1");

    const replayedCount = getOutput(graph, "replay1", "REPLAYED_COUNT");
    expect(replayedCount).toBe(3);

    // Verify edges loaded
    const aliceAge = graph.query(["alice", "age", "?a", "*"]);
    expect(aliceAge[0].get("?a")).toBe(30);

    const bobAge = graph.query(["bob", "age", "?a", "*"]);
    expect(bobAge[0].get("?a")).toBe(25);

    // Cleanup
    await fs.unlink(testFile);
  });

  it("should handle sync with no new edges", async () => {
    // Add edges with timestamp
    const ctx1 = "edit:old";
    graph.add("alice", "age", 30, ctx1);
    graph.add(ctx1, "timestamp", 1000, "timestamps");

    // Sync with watermark AFTER all edges
    graph.add("sync3", "TARGET", `file://${testFile}`, null);
    graph.add("sync3", "SINCE_TIME", 2000, null);
    graph.add("sync3", "handle", "SYNC", "input");
    await waitForEffect(graph, "SYNC", "sync3");

    const count = getOutput(graph, "sync3", "SYNCED_COUNT");
    const lastTime = getOutput(graph, "sync3", "LAST_TIME");
    expect(count).toBe(0);
    expect(lastTime).toBe(2000);  // Watermark unchanged

    // Cleanup (file may not exist, that's ok)
    try {
      await fs.unlink(testFile);
    } catch (e) {
      // Ignore - file might not be created for empty sync
    }
  });

  it("should handle multiple timestamps for same context", async () => {
    const ctx1 = "edit:multi";
    graph.add("alice", "age", 30, ctx1);

    // Add multiple timestamps (context used at different times)
    graph.add(ctx1, "timestamp", 1000, "timestamps");
    graph.add(ctx1, "timestamp", 1500, "timestamps");
    graph.add(ctx1, "timestamp", 2000, "timestamps");

    // Sync - should use max timestamp
    graph.add("sync4", "TARGET", `file://${testFile}`, null);
    graph.add("sync4", "SINCE_TIME", 0, null);
    graph.add("sync4", "handle", "SYNC", "input");
    await waitForEffect(graph, "SYNC", "sync4");

    const lastTime = getOutput(graph, "sync4", "LAST_TIME");
    expect(lastTime).toBe(2000);  // Max of all timestamps

    // Cleanup
    await fs.unlink(testFile);
  });
});

describe("Persistence - Integration", () => {
  let graph;
  let context;
  let snapshotFile;
  let logFile;

  beforeEach(() => {
    graph = new Graph();
    context = createContext(graph);
    installAllPersistence(graph);
    installReifiedRules(graph, context);
    installReifiedAggregations(graph, builtinAggregations, context);
    snapshotFile = `/tmp/bassline-test-snapshot-${Date.now()}.json`;
    logFile = `/tmp/bassline-test-log-${Date.now()}.jsonl`;
  });

  it("should backup and restore graph with rules and aggregations", async () => {
    // Setup rule (use uppercase for pattern matching)
    graph.add("ADULT", "TYPE", "RULE!", "system");
    graph.add("ADULT", "matches", "?p AGE ?a *", "ADULT");
    graph.add("ADULT", "produces", "?p ADULT TRUE *", "ADULT");
    graph.add("ADULT", "memberOf", "rule", "system");

    // Setup aggregation
    graph.add("COUNT-PEOPLE", "AGGREGATE", "COUNT", null);
    graph.add("COUNT-PEOPLE", "memberOf", "aggregation", "system");

    // Add data
    graph.add("alice", "AGE", 30, null);
    graph.add("COUNT-PEOPLE", "ITEM", "alice", null);
    graph.add("bob", "AGE", 25, null);
    graph.add("COUNT-PEOPLE", "ITEM", "bob", null);

    // Backup
    graph.add("backup", "TARGET", `file://${snapshotFile}`, null);
    graph.add("backup", "handle", "BACKUP", "input");
    await waitForEffect(graph, "BACKUP", "backup");

    // Clear and reinstall
    graph.edges = [];
    graph.patterns = [];
    installReifiedRules(graph, context);
    installReifiedAggregations(graph, builtinAggregations, context);

    // Load
    graph.add("load", "SOURCE", `file://${snapshotFile}`, null);
    graph.add("load", "handle", "LOAD", "input");
    await waitForEffect(graph, "LOAD", "load");

    // Verify rule reactivated
    const adultCheck = graph.query(["alice", "ADULT", "?v", "*"]);
    expect(adultCheck.length).toBe(1);

    // Cleanup
    await fs.unlink(snapshotFile);
  });
});

describe("Persistence - Atomic Writes", () => {
  let graph;
  let testFile;

  beforeEach(() => {
    graph = new Graph();
    installAllPersistence(graph);
    testFile = `/tmp/bassline-test-atomic-${Date.now()}.json`;
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFile);
    } catch (e) {
      // Ignore
    }
    try {
      await fs.unlink(testFile + '.tmp');
    } catch (e) {
      // Ignore
    }
  });

  it("should use temp file for atomic backup", async () => {
    // Add data
    graph.add("alice", "age", 30, null);

    // Start backup
    graph.add("backup1", "TARGET", `file://${testFile}`, null);
    graph.add("backup1", "handle", "BACKUP", "input");

    // Wait for completion
    await waitForEffect(graph, "BACKUP", "backup1");

    // Verify no temp file left behind
    try {
      await fs.access(testFile + '.tmp');
      throw new Error("Temp file should not exist after backup");
    } catch (e) {
      expect(e.code).toBe('ENOENT');
    }

    // Verify main file exists and is valid
    const content = await fs.readFile(testFile, 'utf8');
    const data = JSON.parse(content);
    expect(data.edges.length).toBeGreaterThan(0);
  });

  it("should batch writes in SYNC for atomicity", async () => {
    // Add edges with timestamps
    const ctx1 = "batch1";
    graph.add("alice", "age", 30, ctx1);
    graph.add("bob", "age", 25, ctx1);
    graph.add("charlie", "age", 35, ctx1);
    graph.add(ctx1, "timestamp", 1000, "timestamps");

    // Sync
    const logFile = `/tmp/bassline-test-sync-${Date.now()}.jsonl`;
    graph.add("sync1", "TARGET", `file://${logFile}`, null);
    graph.add("sync1", "SINCE_TIME", 0, null);
    graph.add("sync1", "handle", "SYNC", "input");
    await waitForEffect(graph, "SYNC", "sync1");

    const count = getOutput(graph, "sync1", "SYNCED_COUNT");
    expect(count).toBe(3);

    // Verify log file has all entries
    const content = await fs.readFile(logFile, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(3);

    // Cleanup
    await fs.unlink(logFile);
  });
});

describe("Persistence - Garbage Collection", () => {
  let graph;

  beforeEach(() => {
    graph = new Graph();
    installAllPersistence(graph);
  });

  it("should prune tombstoned edges", async () => {
    // Add normal edges
    graph.add("alice", "age", 30, null);
    graph.add("bob", "age", 25, null);

    // Add tombstoned edges
    graph.add("old1", "data", "value1", "tombstone");
    graph.add("old2", "data", "value2", "tombstone");

    // Count non-tombstone edges before prune
    const beforeNonTombstone = graph.edges.filter(e => e.context !== "tombstone").length;

    // Prune
    graph.add("prune1", "handle", "PRUNE_TOMBSTONES", "input");
    await waitForEffect(graph, "PRUNE_TOMBSTONES", "prune1");

    // Check results
    const success = getOutput(graph, "prune1", "SUCCESS");
    const removed = getOutput(graph, "prune1", "REMOVED");

    expect(success).toBe("TRUE");
    expect(removed).toBe(2);

    // Verify our tombstoned data edges are gone
    const oldData = graph.query(["old1", "data", "?v", "*"]);
    expect(oldData.length).toBe(0);
    const old2Data = graph.query(["old2", "data", "?v", "*"]);
    expect(old2Data.length).toBe(0);

    // Verify normal edges still exist
    const aliceAge = graph.query(["alice", "age", "?a", "*"]);
    expect(aliceAge[0].get("?a")).toBe(30);

    // After pruning, we should have original non-tombstone edges + effect output edges
    const afterNonTombstone = graph.edges.filter(e => e.context !== "tombstone").length;
    expect(afterNonTombstone).toBeGreaterThanOrEqual(beforeNonTombstone);
  });

  it("should handle empty tombstone prune", async () => {
    // Add only normal edges
    graph.add("alice", "age", 30, null);
    graph.add("bob", "age", 25, null);

    const before = graph.edges.filter(e => e.context !== "tombstone").length;

    // Prune (nothing to prune)
    graph.add("prune1", "handle", "PRUNE_TOMBSTONES", "input");
    await waitForEffect(graph, "PRUNE_TOMBSTONES", "prune1");

    const removed = getOutput(graph, "prune1", "REMOVED");
    expect(removed).toBe(0);

    // After pruning with no tombstones, should have original + effect output edges
    const after = graph.edges.filter(e => e.context !== "tombstone").length;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("should enable refinement compaction pattern", async () => {
    // Add initial value
    graph.add("AGG1", "AGG1:RESULT:V1", 10, null);

    // Add refined version
    graph.add("AGG1", "AGG1:RESULT:V2", 30, null);
    graph.add("AGG1:RESULT:V2", "REFINES", "AGG1:RESULT:V1", null);

    // Pattern: Tombstone old versions
    const refined = graph.query(["?newer", "REFINES", "?older", "*"]);
    expect(refined.length).toBe(1);

    // Mark old version as tombstone
    const olderKey = refined[0].get("?older");
    graph.add("AGG1", olderKey, 10, "tombstone");

    // Prune
    graph.add("prune1", "handle", "PRUNE_TOMBSTONES", "input");
    await waitForEffect(graph, "PRUNE_TOMBSTONES", "prune1");

    const removed = getOutput(graph, "prune1", "REMOVED");
    expect(removed).toBe(1);

    // New version still exists
    const current = graph.query(["AGG1", "AGG1:RESULT:V2", "?v", "*"]);
    expect(current[0].get("?v")).toBe(30);
  });
});
