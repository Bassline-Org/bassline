import { describe, it } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import { pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

describe("NAC Performance Benchmarks", () => {
    it("Selective NAC with indexed lookup (best case)", () => {
        const g = new WatchedGraph();
        let matchCount = 0;

        // NAC: Find people NOT deleted (selective - indexes entity "alice")
        const p = pattern(
            patternQuad(v("person"), w("type"), w("person")),
        ).setNAC(patternQuad(v("person"), w("deleted"), w("true")));

        g.watch({
            pattern: p,
            production: (m) => {
                matchCount++;
                return [];
            },
        });

        // Populate graph with 10K people (only 1 deleted)
        const start = performance.now();

        for (let i = 0; i < 10000; i++) {
            const person = w(`person${i}`);
            g.add(q(person, w("type"), w("person")));

            // Delete person 5000
            if (i === 5000) {
                g.add(q(person, w("deleted"), w("true")));
            }
        }

        const elapsed = performance.now() - start;
        const edgesPerSec = Math.round((10000 / elapsed) * 1000);

        console.log("\n=== Selective NAC (Indexed Lookup) ===");
        console.log(`Total edges: 10,000`);
        console.log(`Matches: ${matchCount} (expected: 9,999)`);
        console.log(`Time: ${elapsed.toFixed(2)}ms`);
        console.log(`Throughput: ${edgesPerSec.toLocaleString()} edges/sec`);
        console.log(
            `Per-edge NAC check: Only scans ~1 quad (indexed by entity)`,
        );
    });

    it("Wildcard NAC (worst case - must scan all)", () => {
        const g = new WatchedGraph();
        let matchCount = 0;

        // NAC: Find any edge, but NOT if ANY person is deleted
        // This is worst-case: all variables, must scan full graph
        const p = pattern(patternQuad(v("x"), v("a"), v("t"))).setNAC(
            patternQuad(v("deleted_person"), w("deleted"), w("true")),
        );

        g.watch({
            pattern: p,
            production: (m) => {
                matchCount++;
                return [];
            },
        });

        // Add 1000 edges first (NAC not violated)
        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
            const person = w(`person${i}`);
            g.add(q(person, w("type"), w("person")));
        }

        const elapsed = performance.now() - start;
        const edgesPerSec = Math.round((1000 / elapsed) * 1000);

        console.log("\n=== Wildcard NAC (Full Graph Scan) ===");
        console.log(`Total edges: 1,000`);
        console.log(`Matches: ${matchCount} (expected: 1,000)`);
        console.log(`Time: ${elapsed.toFixed(2)}ms`);
        console.log(`Throughput: ${edgesPerSec.toLocaleString()} edges/sec`);
        console.log(
            `Per-edge NAC check: Must scan all ${g.size} quads (no index match)`,
        );
    });

    it("Multi-literal NAC (set intersection)", () => {
        const g = new WatchedGraph();
        let matchCount = 0;

        // NAC: Find alice's attributes, but NOT if alice is deleted in context "system"
        // This uses intersection of entityQuadIndex + attributeQuadIndex + groupQuadIndex
        const p = pattern(
            patternQuad(w("alice"), v("attr"), v("value")),
        ).setNAC(
            patternQuad(w("alice"), w("deleted"), w("true"), w("system")),
        );

        g.watch({
            pattern: p,
            production: (m) => {
                matchCount++;
                return [];
            },
        });

        // Add many edges for different people + contexts
        const start = performance.now();

        // Add 5K edges across different entities
        for (let i = 0; i < 1000; i++) {
            g.add(q(w(`person${i}`), w("name"), w(`name${i}`)));
            g.add(q(w(`person${i}`), w("age"), i));
            g.add(q(w(`person${i}`), w("city"), w("NYC")));
            g.add(q(w(`person${i}`), w("deleted"), w("true"), w("archive"))); // Different context
            g.add(q(w(`person${i}`), w("status"), w("active")));
        }

        // Add alice's data (NAC not violated - different context)
        g.add(q(w("alice"), w("name"), w("Alice")));
        g.add(q(w("alice"), w("age"), 30));
        g.add(q(w("alice"), w("city"), w("NYC")));
        g.add(q(w("alice"), w("deleted"), w("true"), w("archive"))); // archive, not system

        const elapsed = performance.now() - start;
        const edgesPerSec = Math.round((5004 / elapsed) * 1000);

        console.log("\n=== Multi-Literal NAC (Index Intersection) ===");
        console.log(`Total edges: 5,004`);
        console.log(`Matches: ${matchCount} (expected: 3 alice attributes)`);
        console.log(`Time: ${elapsed.toFixed(2)}ms`);
        console.log(`Throughput: ${edgesPerSec.toLocaleString()} edges/sec`);
        console.log(
            `Per-edge NAC check: Intersects 3 indexes (entity="alice" ∩ attr="deleted" ∩ group="system")`,
        );
    });

    it("Stress test: 10K edges with selective NAC", () => {
        const g = new WatchedGraph();
        let matchCount = 0;

        // Pattern: Find admin users
        // NAC: Not if they're suspended
        const p = pattern(
            patternQuad(v("user"), w("role"), w("admin")),
        ).setNAC(patternQuad(v("user"), w("suspended"), w("true")));

        g.watch({
            pattern: p,
            production: (m) => {
                matchCount++;
                return [];
            },
        });

        const start = performance.now();

        // Add 10K users, 100 admins, 10 suspended admins
        for (let i = 0; i < 10000; i++) {
            const user = w(`user${i}`);
            g.add(q(user, w("type"), w("user")));

            // Every 100th is admin
            if (i % 100 === 0) {
                g.add(q(user, w("role"), w("admin")));

                // Every 1000th admin is suspended
                if (i % 1000 === 0) {
                    g.add(q(user, w("suspended"), w("true")));
                }
            }
        }

        const elapsed = performance.now() - start;
        const edgesPerSec = Math.round((10100 / elapsed) * 1000);

        console.log("\n=== Stress Test: 10K Edges with Selective NAC ===");
        console.log(`Total edges: 10,100`);
        console.log(`Matches: ${matchCount} (expected: 90 admins)`);
        console.log(`Time: ${elapsed.toFixed(2)}ms`);
        console.log(`Throughput: ${edgesPerSec.toLocaleString()} edges/sec`);
        console.log(`Graph size: ${g.size.toLocaleString()} quads`);
        console.log(
            `NAC efficiency: Only checks quads indexed by ?user binding`,
        );
    });
});
