/**
 * Simple Algebra Throughput Benchmark
 *
 * Clean measurement of algebra implementation performance
 */

import { WatchedGraph } from "../src/algebra/watch.js";
import { pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

console.log("=== Algebra Throughput Benchmark ===\n");
console.log("Environment: Node.js", process.version);
console.log("Date:", new Date().toISOString());
console.log("\n" + "=".repeat(60) + "\n");

function measure(name, fn, edgeCount) {
    console.log(`## ${name}`);

    // Warmup
    fn(Math.min(100, edgeCount));

    // Measure
    const start = performance.now();
    fn(edgeCount);
    const elapsed = performance.now() - start;

    const throughput = (edgeCount / elapsed) * 1000;

    console.log(`  Edges: ${edgeCount.toLocaleString()}`);
    console.log(`  Time: ${elapsed.toFixed(2)}ms`);
    console.log(`  Throughput: ${Math.round(throughput).toLocaleString()} edges/sec`);
    console.log(`  Per edge: ${(elapsed / edgeCount).toFixed(4)}ms\n`);

    return throughput;
}

const results = {};

// 1. Raw graph operations (no patterns)
results.raw = measure(
    "1. Raw Graph - No Patterns",
    (count) => {
        const g = new WatchedGraph();
        for (let i = 0; i < count; i++) {
            g.add(q(w(`e${i}`), w("attr"), i));
        }
    },
    100000
);

// 2. Single pattern matching
results.singlePattern = measure(
    "2. Single Pattern Matching",
    (count) => {
        const g = new WatchedGraph();
        g.watch({
            pattern: pattern(patternQuad(v("x"), w("type"), w("person"))),
            production: () => []
        });
        for (let i = 0; i < count; i++) {
            g.add(q(w(`e${i}`), w("type"), i % 2 ? w("person") : w("thing")));
        }
    },
    100000
);

// 3. Many patterns with selective activation
results.manyPatterns = measure(
    "3. 1000 Patterns (Unique Attributes)",
    (count) => {
        const g = new WatchedGraph();
        // Create 1000 patterns with unique attributes
        for (let i = 0; i < 1000; i++) {
            g.watch({
                pattern: pattern(patternQuad(v("x"), w(`attr${i}`), v("y"))),
                production: () => []
            });
        }
        // Add edges that distribute across patterns
        for (let i = 0; i < count; i++) {
            g.add(q(w(`e${i}`), w(`attr${i % 100}`), i));
        }
    },
    50000
);

// 4. Multi-quad patterns
results.multiQuad = measure(
    "4. Multi-Quad Pattern (Reciprocal)",
    (count) => {
        const g = new WatchedGraph();
        g.watch({
            pattern: pattern(
                patternQuad(v("X"), w("likes"), v("Y")),
                patternQuad(v("Y"), w("likes"), v("X"))
            ),
            production: () => []
        });
        // Create reciprocal edges
        for (let i = 0; i < count / 2; i++) {
            g.add(q(w(`p${i}`), w("likes"), w(`p${i + 1}`)));
            g.add(q(w(`p${i + 1}`), w("likes"), w(`p${i}`)));
        }
    },
    10000
);

// 5. Cascading rules (reactive pipeline)
results.cascading = measure(
    "5. Cascading Rules (3-stage)",
    (count) => {
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
            g.add(q(w(`item${i}`), w("status"), w("raw")));
        }
    },
    10000
);

// 6. Batch stress test
results.batch = measure(
    "6. Batch Stress Test",
    (count) => {
        const g = new WatchedGraph();
        for (let i = 0; i < count; i++) {
            g.add(q(w(`e${i}`), w(`a${i % 100}`), w(`v${i % 1000}`)));
        }
    },
    200000
);

// Summary
console.log("=".repeat(60));
console.log("\n## SUMMARY\n");
console.log("Benchmark                    | Edges/sec     | ms/edge");
console.log("-".repeat(60));

const benchmarks = [
    ["Raw Graph", results.raw],
    ["Single Pattern", results.singlePattern],
    ["1000 Patterns", results.manyPatterns],
    ["Multi-Quad", results.multiQuad],
    ["Cascading", results.cascading],
    ["Batch Stress", results.batch]
];

for (const [name, throughput] of benchmarks) {
    const msPerEdge = (1000 / throughput).toFixed(4);
    console.log(`${name.padEnd(28)} | ${Math.round(throughput).toLocaleString().padStart(13)} | ${msPerEdge}`);
}

const avg = Object.values(results).reduce((a, b) => a + b, 0) / Object.keys(results).length;
const max = Math.max(...Object.values(results));
const min = Math.min(...Object.values(results));

console.log("\n" + "=".repeat(60));
console.log(`Average: ${Math.round(avg).toLocaleString()} edges/sec`);
console.log(`Peak: ${Math.round(max).toLocaleString()} edges/sec`);
console.log(`Min: ${Math.round(min).toLocaleString()} edges/sec`);
console.log(`Range: ${(max / min).toFixed(2)}x variation`);
console.log("=".repeat(60) + "\n");
