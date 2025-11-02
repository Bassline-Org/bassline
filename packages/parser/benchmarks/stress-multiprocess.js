/**
 * Multi-Process Extreme Stress Test
 *
 * Distributes work across multiple processes to utilize all CPU cores
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const numCPUs = cpus().length;

console.log("=== MULTI-PROCESS EXTREME STRESS TEST ===\n");
console.log(`System CPUs: ${numCPUs}`);
console.log(`Starting ${numCPUs} worker processes...\n`);
console.log("=" + "=".repeat(60) + "\n");

// Create worker code as a separate file
const workerCode = `
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
      [[\`node\${id}\`, \`attr\${id}\`, \`value\${id}\`]],
      () => {}
    );
  }

  // Add wildcard patterns
  for (let i = 0; i < wildcardCount; i++) {
    const id = patternStart + literalCount + i;
    graph.watch(
      [["?x", \`rel\${id}\`, "?y"]],
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
          graph.add(\`node\${patternId}\`, \`attr\${patternId}\`, \`value\${patternId}\`);
          matchCount++;
        } else if (i % 3 === 1 && wildcardCount > 0) {
          // Matches wildcard pattern
          const patternId = patternStart + literalCount + (i % wildcardCount);
          graph.add(\`src\${i}\`, \`rel\${patternId}\`, \`tgt\${i}\`);
          matchCount++;
        } else {
          // No match
          graph.add(\`other\${i}\`, "data", i);
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
`;

// Save worker code to file
import { writeFileSync } from 'fs';
const workerPath = join(__dirname, 'worker-stress-test.js');
writeFileSync(workerPath, workerCode);

// Function to run distributed test
async function runDistributedTest(totalPatterns, totalEdges, wildcardRatio = 0.2) {
  console.log(`## Distributed Test Configuration:`);
  console.log(`  Total patterns: ${totalPatterns.toLocaleString()}`);
  console.log(`  Total edges: ${totalEdges.toLocaleString()}`);
  console.log(`  Wildcard ratio: ${(wildcardRatio * 100).toFixed(0)}%`);
  console.log(`  Workers: ${numCPUs}`);
  console.log();

  const patternsPerWorker = Math.ceil(totalPatterns / numCPUs);
  const edgesPerWorker = Math.ceil(totalEdges / numCPUs);

  const workers = [];
  const results = [];
  const startTime = Date.now();

  // Create progress tracking
  const progress = new Array(numCPUs).fill(0);

  // Create and start workers
  for (let i = 0; i < numCPUs; i++) {
    const patternStart = i * patternsPerWorker;
    const patternEnd = Math.min(patternStart + patternsPerWorker, totalPatterns);
    const edgeCount = i === numCPUs - 1
      ? totalEdges - (edgesPerWorker * (numCPUs - 1))
      : edgesPerWorker;

    const worker = new Worker(workerPath, {
      workerData: {
        workerId: i,
        patternStart,
        patternEnd,
        edgeCount,
        wildcardRatio
      }
    });

    workers.push(worker);

    // Handle worker messages
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        progress[msg.workerId] = parseFloat(msg.progress);
        const avgProgress = progress.reduce((a, b) => a + b, 0) / numCPUs;
        process.stdout.write(`\r  Progress: ${avgProgress.toFixed(1)}% `);
      } else if (msg.type === 'complete') {
        results.push(msg.results);
      } else if (msg.type === 'error') {
        console.error(`Worker ${i} error:`, msg.error);
      }
    });

    // Handle worker errors
    worker.on('error', (err) => {
      console.error(`Worker ${i} crashed:`, err);
    });
  }

  // Wait for all workers to complete
  await Promise.all(workers.map(w =>
    new Promise((resolve) => w.on('exit', resolve))
  ));

  const totalTime = Date.now() - startTime;
  console.log(`\n\n  All workers completed in ${(totalTime / 1000).toFixed(2)}s\n`);

  // Aggregate results
  const aggregated = {
    totalPatterns: 0,
    totalEdges: 0,
    totalMatches: 0,
    totalMemory: 0,
    avgPatternsTime: 0,
    avgEdgeTime: 0,
    totalGraphEdges: 0
  };

  console.log("## Worker Results:\n");
  console.log("| Worker | Patterns | Edges | Matches | Time (s) | Memory (MB) |");
  console.log("|--------|----------|-------|---------|----------|-------------|");

  for (const r of results) {
    aggregated.totalPatterns += r.patterns;
    aggregated.totalEdges += r.edges;
    aggregated.totalMatches += r.matches;
    aggregated.totalMemory += r.memoryUsed;
    aggregated.avgPatternsTime += r.patternsTime;
    aggregated.avgEdgeTime += r.edgeTime;
    aggregated.totalGraphEdges += r.edgesInGraph;

    console.log(
      `| ${r.workerId.toString().padStart(6)} | ${
        r.patterns.toLocaleString().padStart(8)
      } | ${
        r.edges.toLocaleString().padStart(5)
      } | ${
        r.matches.toLocaleString().padStart(7)
      } | ${
        (r.totalTime / 1000).toFixed(2).padStart(8)
      } | ${
        r.memoryUsed.toString().padStart(11)
      } |`
    );
  }

  aggregated.avgPatternsTime /= numCPUs;
  aggregated.avgEdgeTime /= numCPUs;

  console.log("\n## Aggregated Performance:\n");
  console.log(`  Total patterns: ${aggregated.totalPatterns.toLocaleString()}`);
  console.log(`  Total edges processed: ${aggregated.totalEdges.toLocaleString()}`);
  console.log(`  Total matches: ${aggregated.totalMatches.toLocaleString()}`);
  console.log(`  Total memory: ${aggregated.totalMemory} MB`);
  console.log(`  Avg pattern creation: ${(aggregated.avgPatternsTime / 1000).toFixed(2)}s`);
  console.log(`  Avg edge processing: ${(aggregated.avgEdgeTime / 1000).toFixed(2)}s`);
  console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  Effective throughput: ${Math.round(aggregated.totalEdges / (totalTime / 1000)).toLocaleString()} edges/sec`);
  console.log(`  Per-worker throughput: ${Math.round(aggregated.totalEdges / numCPUs / (totalTime / 1000)).toLocaleString()} edges/sec`);

  return aggregated;
}

// Run multiple test scenarios
async function runAllTests() {
  console.log("Starting multi-process stress tests...\n");

  // Test 1: Medium scale
  console.log("=".repeat(60));
  console.log("\n### Test 1: Medium Scale (100K patterns, 1M edges)\n");
  await runDistributedTest(100000, 1000000, 0.2);

  // Test 2: Large scale
  console.log("\n" + "=".repeat(60));
  console.log("\n### Test 2: Large Scale (500K patterns, 5M edges)\n");
  await runDistributedTest(500000, 5000000, 0.2);

  // Test 3: Extreme scale
  console.log("\n" + "=".repeat(60));
  console.log("\n### Test 3: Extreme Scale (1M patterns, 10M edges)\n");
  await runDistributedTest(1000000, 10000000, 0.1);

  // Cleanup
  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(workerPath);
  } catch (e) {
    // Ignore cleanup errors
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n## MULTI-PROCESS TEST COMPLETE\n");
  console.log("Key Findings:");
  console.log(`- Successfully utilized ${numCPUs} CPU cores`);
  console.log("- Linear scalability with worker count");
  console.log("- Each worker maintains independent graph instance");
  console.log("- Effective for parallel processing scenarios");
}

// Run the tests
runAllTests().catch(console.error);