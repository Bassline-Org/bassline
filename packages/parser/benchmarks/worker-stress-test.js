
import { parentPort, workerData } from 'worker_threads';
import { Graph } from '../src/minimal-graph.js';

const { workerId, patternStart, patternEnd, edgeCount, wildcardRatio } = workerData;

function runWorkerTest() {
  const graph = new Graph();
  const startTime = Date.now();
  const startMem = process.memoryUsage().heapUsed;

  // Create patterns for this worker's range
  const patternCount = patternEnd - patternStart;
  const wildcardCount = Math.floor(patternCount * wildcardRatio);
  const literalCount = patternCount - wildcardCount;

  // Add literal patterns
  for (let i = 0; i < literalCount; i++) {
    const id = patternStart + i;
    graph.watch(
      [[`node${id}`, `attr${id}`, `value${id}`]],
      () => {}
    );
  }

  // Add wildcard patterns
  for (let i = 0; i < wildcardCount; i++) {
    const id = patternStart + literalCount + i;
    graph.watch(
      [["?x", `rel${id}`, "?y"]],
      () => {}
    );
  }

  const patternsTime = Date.now() - startTime;

  // Add edges
  const edgeStartTime = Date.now();
  let matchCount = 0;

  // Process edges in batches
  const batchSize = 10000;
  const numBatches = Math.ceil(edgeCount / batchSize);

  for (let b = 0; b < numBatches; b++) {
    graph.batch(() => {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, edgeCount);

      for (let i = start; i < end; i++) {
        if (i % 3 === 0) {
          // Matches literal pattern
          const patternId = patternStart + (i % literalCount);
          graph.add(`node${patternId}`, `attr${patternId}`, `value${patternId}`);
          matchCount++;
        } else if (i % 3 === 1 && wildcardCount > 0) {
          // Matches wildcard pattern
          const patternId = patternStart + literalCount + (i % wildcardCount);
          graph.add(`src${i}`, `rel${patternId}`, `tgt${i}`);
          matchCount++;
        } else {
          // No match
          graph.add(`other${i}`, "data", i);
        }
      }
    });

    // Send progress update
    if (b % 10 === 0) {
      parentPort.postMessage({
        type: 'progress',
        workerId,
        progress: (b / numBatches * 100).toFixed(1)
      });
    }
  }

  const edgeTime = Date.now() - edgeStartTime;
  const totalTime = Date.now() - startTime;
  const endMem = process.memoryUsage().heapUsed;

  return {
    workerId,
    patterns: patternCount,
    literalPatterns: literalCount,
    wildcardPatterns: wildcardCount,
    edges: edgeCount,
    matches: matchCount,
    patternsTime,
    edgeTime,
    totalTime,
    memoryUsed: Math.round((endMem - startMem) / 1024 / 1024),
    edgesInGraph: graph.edges.length
  };
}

// Run the test and send results back
try {
  const results = runWorkerTest();
  parentPort.postMessage({ type: 'complete', results });
} catch (error) {
  parentPort.postMessage({ type: 'error', error: error.message });
}
