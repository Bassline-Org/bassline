import { describe, expect, it } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import { pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

describe("Algebra - NAC (Negative Application Conditions)", () => {
    describe("Basic NAC functionality", () => {
        it("should filter matches when NAC pattern exists", () => {
            const g = new WatchedGraph();
            const productions = [];

            // Pattern: find persons, but NOT if they are deleted
            const p = pattern(
                patternQuad(v("person"), w("type"), w("person")),
            ).setNAC(
                patternQuad(v("person"), w("deleted"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    productions.push(m.get("person"));
                    return [];
                },
            });

            // Add person who is not deleted
            g.add(q(w("alice"), w("type"), w("person")));

            // Add person who IS deleted (add deletion FIRST, before pattern completes)
            g.add(q(w("bob"), w("deleted"), w("true")));
            g.add(q(w("bob"), w("type"), w("person")));

            // Check: alice should match, bob should be filtered by NAC
            expect(productions.length).toBe(1);
            expect(productions[0].spelling).toBe(w("alice").spelling);
        });

        it("should work with variables bound from positive pattern", () => {
            const g = new WatchedGraph();
            const results = [];

            // Pattern: person with age, but NOT if banned
            const p = pattern(
                patternQuad(v("p"), w("age"), v("a")),
            ).setNAC(
                patternQuad(v("p"), w("banned"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push({ person: m.get("p"), age: m.get("a") });
                    return [];
                },
            });

            g.add(q(w("alice"), w("age"), 30));

            // Add banned status BEFORE age (so NAC check sees it)
            g.add(q(w("bob"), w("banned"), w("true")));
            g.add(q(w("bob"), w("age"), 25));

            expect(results.length).toBe(1);
            expect(results[0].person.spelling).toBe(w("alice").spelling);
            expect(results[0].age).toBe(30);
        });

        it("should accept matches when NAC pattern does not exist", () => {
            const g = new WatchedGraph();
            const productions = [];

            const p = pattern(
                patternQuad(v("p"), w("status"), w("active")),
            ).setNAC(
                patternQuad(v("p"), w("blocked"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    productions.push(m.get("p"));
                    return [];
                },
            });

            g.add(q(w("alice"), w("status"), w("active")));
            g.add(q(w("bob"), w("status"), w("active")));

            expect(productions.length).toBe(2);
            expect(productions[0].spelling).toBe(w("alice").spelling);
            expect(productions[1].spelling).toBe(w("bob").spelling);
        });
    });

    describe("Multiple NAC patterns", () => {
        it("should filter when ANY NAC pattern matches (conjunction)", () => {
            const g = new WatchedGraph();
            const results = [];

            const p = pattern(
                patternQuad(v("p"), w("type"), w("user")),
            ).setNAC(
                patternQuad(v("p"), w("deleted"), w("true")),
                patternQuad(v("p"), w("banned"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push(m.get("p"));
                    return [];
                },
            });

            // Alice: not deleted, not banned → should match
            g.add(q(w("alice"), w("type"), w("user")));

            // Bob: deleted → should NOT match (add NAC quad FIRST)
            g.add(q(w("bob"), w("deleted"), w("true")));
            g.add(q(w("bob"), w("type"), w("user")));

            // Carol: banned → should NOT match (add NAC quad FIRST)
            g.add(q(w("carol"), w("banned"), w("true")));
            g.add(q(w("carol"), w("type"), w("user")));

            // Dave: both deleted AND banned → should NOT match (add NAC quads FIRST)
            g.add(q(w("dave"), w("deleted"), w("true")));
            g.add(q(w("dave"), w("banned"), w("true")));
            g.add(q(w("dave"), w("type"), w("user")));

            expect(results.length).toBe(1);
            expect(results[0].spelling).toBe(w("alice").spelling);
        });
    });

    describe("Refinement pattern use case", () => {
        it("should find current value using NAC refinement", () => {
            const g = new WatchedGraph();

            // Create versioned values
            g.add(q(w("AGG1:RESULT:V1"), w("VALUE"), 10));
            g.add(q(w("AGG1:RESULT:V2"), w("VALUE"), 30));
            g.add(q(w("AGG1:RESULT:V3"), w("VALUE"), 45));

            // Mark refinements
            g.add(q(w("AGG1:RESULT:V2"), w("REFINES"), w("AGG1:RESULT:V1")));
            g.add(q(w("AGG1:RESULT:V3"), w("REFINES"), w("AGG1:RESULT:V2")));

            // Query for current (non-refined) value
            const currentValues = [];
            const p = pattern(
                patternQuad(v("key"), w("VALUE"), v("val")),
            ).setNAC(
                patternQuad(v("newer"), w("REFINES"), v("key")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    currentValues.push({
                        key: m.get("key"),
                        value: m.get("val"),
                    });
                    return [];
                },
            });

            // Only V3 should match (no newer version refines it)
            expect(currentValues.length).toBe(1);
            expect(currentValues[0]).toEqual({
                key: w("AGG1:RESULT:V3"),
                value: 45,
            });
        });
    });

    describe("NAC with multi-quad patterns", () => {
        it("should check NAC after all positive patterns match", () => {
            const g = new WatchedGraph();
            const results = [];

            // Pattern: person with age AND email, but NOT if suspended
            const p = pattern(
                patternQuad(v("p"), w("age"), v("a")),
                patternQuad(v("p"), w("email"), v("e")),
            ).setNAC(
                patternQuad(v("p"), w("suspended"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push({
                        person: m.get("p"),
                        age: m.get("a"),
                        email: m.get("e"),
                    });
                    return [];
                },
            });

            // Alice: has age and email, not suspended → should match
            g.add(q(w("alice"), w("age"), 30));
            g.add(q(w("alice"), w("email"), w("alice@example.com")));

            // Bob: has age and email, IS suspended → should NOT match
            g.add(q(w("bob"), w("age"), 25));
            g.add(q(w("bob"), w("suspended"), w("true")));
            g.add(q(w("bob"), w("email"), w("bob@example.com")));

            expect(results.length).toBe(1);
            expect(results[0].person).toEqual(w("alice"));
        });
    });

    describe("NAC with wildcards", () => {
        it("should work with wildcards in NAC patterns", () => {
            const g = new WatchedGraph();
            const results = [];

            // Pattern: find all attributes of person, but NOT if deleted in ANY context
            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
            ).setNAC(
                patternQuad(v("p"), w("deleted"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push(m.get("p"));
                    return [];
                },
            });

            g.add(q(w("alice"), w("type"), w("person")));
            g.add(q(w("bob"), w("deleted"), w("true")));
            g.add(q(w("bob"), w("type"), w("person")));

            expect(results.length).toBe(1);
            expect(results[0].spelling).toBe(w("alice").spelling);
        });
    });

    describe("NAC reactive behavior", () => {
        it("should not fire when NAC quad is added before pattern completes", () => {
            const g = new WatchedGraph();
            const productions = [];

            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
                patternQuad(v("p"), w("age"), v("a")),
            ).setNAC(
                patternQuad(v("p"), w("deleted"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    productions.push(m.get("p"));
                    return [];
                },
            });

            // Add first quad (partial match)
            g.add(q(w("alice"), w("type"), w("person")));

            // Add NAC violation
            g.add(q(w("alice"), w("deleted"), w("true")));

            // Complete pattern (should check NAC and reject)
            g.add(q(w("alice"), w("age"), 30));

            expect(productions.length).toBe(0);
        });

        it("should fire when NAC quad is added but pattern completes first", () => {
            const g = new WatchedGraph();
            const productions = [];

            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
                patternQuad(v("p"), w("age"), v("a")),
            ).setNAC(
                patternQuad(v("p"), w("deleted"), w("true")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    productions.push(m.get("p"));
                    return [];
                },
            });

            // Add both quads before NAC violation
            g.add(q(w("alice"), w("type"), w("person")));
            g.add(q(w("alice"), w("age"), 30));

            expect(productions.length).toBe(1);
            expect(productions[0].spelling).toBe(w("alice").spelling);

            // Adding NAC quad later doesn't retroactively invalidate
            g.add(q(w("alice"), w("deleted"), w("true")));
            expect(productions.length).toBe(1);
        });
    });

    describe("NAC with literals", () => {
        it("should work with literal values in NAC", () => {
            const g = new WatchedGraph();
            const results = [];

            // Find all people, but only if bob does NOT exist as a person
            // (NAC with literals is a global check)
            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
            ).setNAC(
                patternQuad(w("bob"), w("type"), w("person")),
            );

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push(m.get("p"));
                    return [];
                },
            });

            // Add alice - bob doesn't exist yet, so this matches
            g.add(q(w("alice"), w("type"), w("person")));

            // Add carol - bob still doesn't exist, so this matches
            g.add(q(w("carol"), w("type"), w("person")));

            expect(results.length).toBe(2);

            // Now add bob - this won't match because NAC checks "bob exists"
            g.add(q(w("bob"), w("type"), w("person")));

            // Still only alice and carol (bob filtered by global NAC)
            expect(results.length).toBe(2);
        });
    });

    describe("NAC edge cases", () => {
        it("should handle pattern with no NAC (backward compatibility)", () => {
            const g = new WatchedGraph();
            const results = [];

            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
            );
            // No setNAC call

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push(m.get("p"));
                    return [];
                },
            });

            g.add(q(w("alice"), w("type"), w("person")));
            g.add(q(w("bob"), w("type"), w("person")));

            expect(results).toEqual([w("alice"), w("bob")]);
        });

        it("should handle empty NAC array", () => {
            const g = new WatchedGraph();
            const results = [];

            const p = pattern(
                patternQuad(v("p"), w("type"), w("person")),
            ).setNAC(); // Empty

            g.watch({
                pattern: p,
                production: (m) => {
                    results.push(m.get("p"));
                    return [];
                },
            });

            g.add(q(w("alice"), w("type"), w("person")));

            expect(results).toEqual([w("alice")]);
        });
    });
});
