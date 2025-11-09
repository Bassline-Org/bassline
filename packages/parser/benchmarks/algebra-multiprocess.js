/**
 * Multi-Process Algebra Throughput Benchmark
 *
 * Tests aggregate throughput across multiple Node.js processes
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Worker script that will run in each process
const WORKER_SCRIPT = `
import { WatchedGraph } from "../src/algebra/watch.js";
import { pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

const processId = parseInt(process.argv[2]);
const edgeCount = parseInt(process.argv[3]);
const benchmarkType = process.argv[4];

function runWorkload(count) {
    if (benchmarkType === "raw") {
        const g = new WatchedGraph();
        for (let i = 0; i < count; i++) {
            g.add(q(w(\`p\${processId}-e\${i}\`), w("attr"), i));
        }
    } else if (benchmarkType === "pattern") {
        const g = new WatchedGraph();
        g.watch({
            pattern: pattern(patternQuad(v("x"), w("type"), w("person"))),
            production: () => []
        });
        for (let i = 0; i < count; i++) {
            g.add(q(w(\`p\${processId}-e\${i}\`), w("type"), i % 2 ? w("person") : w("thing")));
        }
    } else if (benchmarkType === "cascading") {
        const g = new WatchedGraph();
        g.watch({
            pattern: pattern(patternQuad(v("x"), w("status"), w("raw"))),
            production: (m) => [q(m.get("x"), w("status"), w("verified"))]
        });
        g.watch({
            pattern: pattern(patternQuad(v("x"), w("status"), w("verified"))),
            production: (m) => [q(m.get("x"), w("status"), w("processed"))]
        });
        g.watch({
            pattern: pattern(patternQuad(v("x"), w("status"), w("processed"))),
            production: (m) => [q(m.get("x"), w("status"), w("complete"))]
        });
        for (let i = 0; i < count; i++) {
            g.add(q(w(\`p\${processId}-item\${i}\`), w("status"), w("raw")));
        }
    }
}

function runBenchmark() {
    // Warmup - run with smaller dataset
    const warmupCount = Math.min(1000, Math.floor(edgeCount / 10));
    runWorkload(warmupCount);

    // Actual measurement
    const start = performance.now();
    runWorkload(edgeCount);
    const elapsed = performance.now() - start;
    const throughput = (edgeCount / elapsed) * 1000;

    console.log(JSON.stringify({
        processId,
        edgeCount,
        elapsed,
        throughput
    }));
}

runBenchmark();
`;

async function runMultiProcessBenchmark(processCount, edgesPerProcess, benchmarkType) {
    console.log(`\n## ${benchmarkType.toUpperCase()} - ${processCount} Processes`);
    console.log(`  Edges per process: ${edgesPerProcess.toLocaleString()}`);
    console.log(`  Total edges: ${(processCount * edgesPerProcess).toLocaleString()}`);

    // Write worker script to temp file
    const workerPath = join(__dirname, ".worker-temp.js");
    await import("fs/promises").then(fs => fs.writeFile(workerPath, WORKER_SCRIPT));

    const workers = [];
    const results = [];

    // Spawn all processes
    const startTime = Date.now();

    for (let i = 0; i < processCount; i++) {
        const worker = spawn("node", [workerPath, String(i), String(edgesPerProcess), benchmarkType], {
            cwd: __dirname,
            stdio: ["ignore", "pipe", "inherit"]
        });

        workers.push(new Promise((resolve, reject) => {
            let output = "";

            worker.stdout.on("data", (data) => {
                output += data.toString();
            });

            worker.on("close", (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output.trim());
                        results.push(result);
                        resolve();
                    } catch (e) {
                        reject(new Error(`Failed to parse output: ${output}`));
                    }
                } else {
                    reject(new Error(`Worker ${i} exited with code ${code}`));
                }
            });

            worker.on("error", reject);
        }));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    const totalElapsed = Date.now() - startTime;

    // Calculate aggregate metrics
    const totalEdges = processCount * edgesPerProcess;
    const aggregateThroughput = (totalEdges / totalElapsed) * 1000;
    const avgProcessThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    const minProcessThroughput = Math.min(...results.map(r => r.throughput));
    const maxProcessThroughput = Math.max(...results.map(r => r.throughput));

    console.log(`\n  Total wall-clock time: ${totalElapsed.toFixed(2)}ms`);
    console.log(`  Aggregate throughput: ${Math.round(aggregateThroughput).toLocaleString()} edges/sec`);
    console.log(`  Avg per-process: ${Math.round(avgProcessThroughput).toLocaleString()} edges/sec`);
    console.log(`  Min per-process: ${Math.round(minProcessThroughput).toLocaleString()} edges/sec`);
    console.log(`  Max per-process: ${Math.round(maxProcessThroughput).toLocaleString()} edges/sec`);
    console.log(`  Parallel efficiency: ${(aggregateThroughput / avgProcessThroughput).toFixed(2)}x`);

    // Cleanup
    await import("fs/promises").then(fs => fs.unlink(workerPath).catch(() => {}));

    return {
        processCount,
        edgesPerProcess,
        totalEdges,
        totalElapsed,
        aggregateThroughput,
        avgProcessThroughput,
        results
    };
}

console.log("=== Multi-Process Algebra Benchmark ===\n");
console.log("Environment: Node.js", process.version);
console.log("Date:", new Date().toISOString());
console.log("\n" + "=".repeat(60));

const benchmarks = [];

// Test 1: Raw operations across different process counts
console.log("\n# BENCHMARK 1: Raw Graph Operations\n");

for (const processCount of [1, 2, 4, 8]) {
    const result = await runMultiProcessBenchmark(processCount, 50000, "raw");
    benchmarks.push({ type: "raw", ...result });
}

// Test 2: Pattern matching
console.log("\n\n# BENCHMARK 2: Single Pattern Matching\n");

for (const processCount of [1, 2, 4, 8]) {
    const result = await runMultiProcessBenchmark(processCount, 50000, "pattern");
    benchmarks.push({ type: "pattern", ...result });
}

// Test 3: Cascading rules
console.log("\n\n# BENCHMARK 3: Cascading Rules\n");

for (const processCount of [1, 2, 4, 8]) {
    const result = await runMultiProcessBenchmark(processCount, 10000, "cascading");
    benchmarks.push({ type: "cascading", ...result });
}

// Summary
console.log("\n\n" + "=".repeat(60));
console.log("\n## MULTI-PROCESS SCALING SUMMARY\n");

const byType = {};
for (const b of benchmarks) {
    if (!byType[b.type]) byType[b.type] = [];
    byType[b.type].push(b);
}

for (const [type, results] of Object.entries(byType)) {
    console.log(`\n### ${type.toUpperCase()}`);
    console.log("\nProcesses | Edges/Process | Total Edges | Aggregate Throughput | Scaling");
    console.log("-".repeat(80));

    const baseline = results[0].aggregateThroughput;

    for (const r of results) {
        const scaling = (r.aggregateThroughput / baseline).toFixed(2);
        console.log(
            `${String(r.processCount).padStart(9)} | ${String(r.edgesPerProcess).padStart(13)} | ` +
            `${String(r.totalEdges).padStart(11)} | ${Math.round(r.aggregateThroughput).toLocaleString().padStart(20)} | ${scaling}x`
        );
    }
}

console.log("\n" + "=".repeat(60));
console.log("\n## KEY FINDINGS\n");

const raw8 = benchmarks.find(b => b.type === "raw" && b.processCount === 8);
const raw1 = benchmarks.find(b => b.type === "raw" && b.processCount === 1);

console.log(`1. Single process peak: ${Math.round(raw1.aggregateThroughput).toLocaleString()} edges/sec`);
console.log(`2. 8-process aggregate: ${Math.round(raw8.aggregateThroughput).toLocaleString()} edges/sec`);
console.log(`3. Multi-process scaling: ${(raw8.aggregateThroughput / raw1.aggregateThroughput).toFixed(2)}x`);
console.log(`4. Parallel efficiency: ${((raw8.aggregateThroughput / raw1.aggregateThroughput) / 8 * 100).toFixed(1)}%`);
console.log("\n" + "=".repeat(60) + "\n");
