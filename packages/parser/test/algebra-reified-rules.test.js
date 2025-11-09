import { describe, expect, it } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import {
    installReifiedRules,
    getActiveRules,
    getRuleDefinition,
} from "../src/algebra/reified-rules.js";
import { pattern, patternQuad, matchGraph } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { word as w, variable as v, WC } from "../src/types.js";

describe("Algebra - Reified Rules", () => {
    describe("Basic Rule Activation", () => {
        it("should activate rule and fire for existing data", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Add data first
            g.add(q(w("alice"), w("age"), 30));
            g.add(q(w("bob"), w("age"), 25));

            // Define rule structure
            g.add(q(w("ADULT-CHECK"), w("TYPE"), w("RULE!"), w("system")));
            g.add(
                q(
                    w("ADULT-CHECK"),
                    w("matches"),
                    w("?p age ?a *"),
                    w("ADULT-CHECK"),
                ),
            );
            g.add(
                q(
                    w("ADULT-CHECK"),
                    w("produces"),
                    w("?p adult true *"),
                    w("ADULT-CHECK"),
                ),
            );

            // Activate rule
            g.add(q(w("ADULT-CHECK"), w("memberOf"), w("rule"), w("system")));

            // Check production fired for existing data
            const results = matchGraph(
                g,
                pattern(patternQuad(v("p"), w("adult"), w("true"), WC)),
            );

            expect(results).toHaveLength(2);
            const people = results.map((r) => r.get("p").spelling);
            expect(people).toContain(w("alice").spelling);
            expect(people).toContain(w("bob").spelling);
        });

        it("should fire for data added after activation", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Define and activate rule first
            g.add(q(w("RULE1"), w("matches"), w("?x type test *"), w("RULE1")));
            g.add(
                q(w("RULE1"), w("produces"), w("?x marked true *"), w("RULE1")),
            );
            g.add(q(w("RULE1"), w("memberOf"), w("rule"), w("system")));

            // Add data after activation
            g.add(q(w("test1"), w("type"), w("test")));
            g.add(q(w("test2"), w("type"), w("test")));

            // Check production fired
            const results = matchGraph(
                g,
                pattern(patternQuad(v("x"), w("marked"), w("true"), WC)),
            );

            expect(results).toHaveLength(2);
        });

        it("should support variable substitution in productions", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Rule that copies age value
            g.add(
                q(w("COPY-AGE"), w("matches"), w("?p age ?a *"), w("COPY-AGE")),
            );
            g.add(
                q(
                    w("COPY-AGE"),
                    w("produces"),
                    w("?p age-copy ?a *"),
                    w("COPY-AGE"),
                ),
            );
            g.add(q(w("COPY-AGE"), w("memberOf"), w("rule"), w("system")));

            g.add(q(w("alice"), w("age"), 30));

            // Check that age value was copied
            const results = matchGraph(
                g,
                pattern(patternQuad(w("alice"), w("age-copy"), v("a"), WC)),
            );

            expect(results).toHaveLength(1);
            expect(results[0].get("a")).toBe(30);
        });
    });

    describe("Multi-Quad Patterns", () => {
        it("should support multi-quad match patterns", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Rule requires person to have BOTH age AND email
            g.add(
                q(w("VERIFY"), w("matches"), w("?p age ?a * ?p email ?e *"), w("VERIFY")),
            );
            g.add(
                q(w("VERIFY"), w("produces"), w("?p verified true *"), w("VERIFY")),
            );
            g.add(q(w("VERIFY"), w("memberOf"), w("rule"), w("system")));

            // Alice has both
            g.add(q(w("alice"), w("age"), 30));
            g.add(q(w("alice"), w("email"), w("alice@example.com")));

            // Bob only has age
            g.add(q(w("bob"), w("age"), 25));

            // Only alice should be verified
            const results = matchGraph(
                g,
                pattern(patternQuad(v("p"), w("verified"), w("true"), WC)),
            );

            expect(results).toHaveLength(1);
            expect(results[0].get("p").spelling).toEqual(w("alice").spelling);
        });

        it("should support multi-quad via multiple match edges", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Store pattern quads as separate edges
            g.add(q(w("RULE2"), w("matches"), w("?p type person *"), w("RULE2")));
            g.add(q(w("RULE2"), w("matches"), w("?p city ?c *"), w("RULE2")));
            g.add(
                q(w("RULE2"), w("produces"), w("?p located true *"), w("RULE2")),
            );
            g.add(q(w("RULE2"), w("memberOf"), w("rule"), w("system")));

            g.add(q(w("alice"), w("type"), w("person")));
            g.add(q(w("alice"), w("city"), w("NYC")));

            const results = matchGraph(
                g,
                pattern(patternQuad(w("alice"), w("located"), w("true"), WC)),
            );

            expect(results).toHaveLength(1);
        });
    });

    describe("NAC (Negative Application Conditions)", () => {
        it("should support single NAC pattern", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Verify people NOT deleted
            g.add(
                q(w("VERIFY"), w("matches"), w("?p type person *"), w("VERIFY")),
            );
            g.add(q(w("VERIFY"), w("nac"), w("?p deleted true *"), w("VERIFY")));
            g.add(
                q(w("VERIFY"), w("produces"), w("?p verified true *"), w("VERIFY")),
            );
            g.add(q(w("VERIFY"), w("memberOf"), w("rule"), w("system")));

            // Add people
            g.add(q(w("alice"), w("type"), w("person")));
            g.add(q(w("bob"), w("deleted"), w("true"))); // Mark deleted FIRST
            g.add(q(w("bob"), w("type"), w("person")));

            // Only alice should be verified
            const results = matchGraph(
                g,
                pattern(patternQuad(v("p"), w("verified"), w("true"), WC)),
            );

            expect(results).toHaveLength(1);
            expect(results[0].get("p").spelling).toEqual(w("alice").spelling);
        });

        it("should support multiple NAC patterns", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Find users NOT deleted AND NOT banned
            g.add(q(w("CHECK"), w("matches"), w("?p type user *"), w("CHECK")));
            g.add(q(w("CHECK"), w("nac"), w("?p deleted true *"), w("CHECK")));
            g.add(q(w("CHECK"), w("nac"), w("?p banned true *"), w("CHECK")));
            g.add(
                q(w("CHECK"), w("produces"), w("?p active true *"), w("CHECK")),
            );
            g.add(q(w("CHECK"), w("memberOf"), w("rule"), w("system")));

            // Alice: clean
            g.add(q(w("alice"), w("type"), w("user")));

            // Bob: deleted
            g.add(q(w("bob"), w("deleted"), w("true")));
            g.add(q(w("bob"), w("type"), w("user")));

            // Carol: banned
            g.add(q(w("carol"), w("banned"), w("true")));
            g.add(q(w("carol"), w("type"), w("user")));

            // Only alice should be active
            const results = matchGraph(
                g,
                pattern(patternQuad(v("p"), w("active"), w("true"), WC)),
            );

            expect(results).toHaveLength(1);
            expect(results[0].get("p").spelling).toEqual(w("alice").spelling);
        });
    });

    describe("Rule Deactivation", () => {
        it("should deactivate rule via tombstone", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Activate rule
            g.add(q(w("RULE1"), w("matches"), w("?x type test *"), w("RULE1")));
            g.add(
                q(w("RULE1"), w("produces"), w("?x marked true *"), w("RULE1")),
            );
            g.add(q(w("RULE1"), w("memberOf"), w("rule"), w("system")));

            // Verify it's active
            expect(getActiveRules(g)).toContain("RULE1");

            // Deactivate
            g.add(q(w("RULE1"), w("memberOf"), w("rule"), w("tombstone")));

            // Verify it's no longer active
            expect(getActiveRules(g)).not.toContain("RULE1");

            // Add data - should NOT trigger rule
            g.add(q(w("test1"), w("type"), w("test")));

            const results = matchGraph(
                g,
                pattern(patternQuad(v("x"), w("marked"), w("true"), WC)),
            );
            expect(results).toHaveLength(0);
        });
    });

    describe("Multiple Rules", () => {
        it("should support multiple active rules", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Rule 1: mark adults
            g.add(q(w("ADULT"), w("matches"), w("?p age ?a *"), w("ADULT")));
            g.add(q(w("ADULT"), w("produces"), w("?p adult true *"), w("ADULT")));
            g.add(q(w("ADULT"), w("memberOf"), w("rule"), w("system")));

            // Rule 2: mark people
            g.add(
                q(w("PERSON"), w("matches"), w("?p type person *"), w("PERSON")),
            );
            g.add(
                q(w("PERSON"), w("produces"), w("?p is-person true *"), w("PERSON")),
            );
            g.add(q(w("PERSON"), w("memberOf"), w("rule"), w("system")));

            // Add alice with age and type
            g.add(q(w("alice"), w("age"), 30));
            g.add(q(w("alice"), w("type"), w("person")));

            // Both rules should have fired
            expect(
                matchGraph(g, pattern(patternQuad(w("alice"), w("adult"), w("true"), WC))),
            ).toHaveLength(1);

            expect(
                matchGraph(
                    g,
                    pattern(patternQuad(w("alice"), w("is-person"), w("true"), WC)),
                ),
            ).toHaveLength(1);
        });
    });

    describe("Cascading Rules", () => {
        it("should support rules that trigger other rules", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            // Rule 1: raw → verified
            g.add(
                q(
                    w("VERIFY"),
                    w("matches"),
                    w("?x status raw *"),
                    w("VERIFY"),
                ),
            );
            g.add(
                q(
                    w("VERIFY"),
                    w("produces"),
                    w("?x status verified *"),
                    w("VERIFY"),
                ),
            );
            g.add(q(w("VERIFY"), w("memberOf"), w("rule"), w("system")));

            // Rule 2: verified → processed
            g.add(
                q(
                    w("PROCESS"),
                    w("matches"),
                    w("?x status verified *"),
                    w("PROCESS"),
                ),
            );
            g.add(
                q(
                    w("PROCESS"),
                    w("produces"),
                    w("?x status processed *"),
                    w("PROCESS"),
                ),
            );
            g.add(q(w("PROCESS"), w("memberOf"), w("rule"), w("system")));

            // Add raw item
            g.add(q(w("item1"), w("status"), w("raw")));

            // Should cascade through both rules
            expect(
                matchGraph(
                    g,
                    pattern(patternQuad(w("item1"), w("status"), w("verified"), WC)),
                ),
            ).toHaveLength(1);

            expect(
                matchGraph(
                    g,
                    pattern(patternQuad(w("item1"), w("status"), w("processed"), WC)),
                ),
            ).toHaveLength(1);
        });
    });

    describe("Introspection", () => {
        it("should list active rules", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            expect(getActiveRules(g)).toHaveLength(0);

            g.add(q(w("RULE1"), w("matches"), w("?x foo ?y *"), w("RULE1")));
            g.add(q(w("RULE1"), w("produces"), w("?x bar ?y *"), w("RULE1")));
            g.add(q(w("RULE1"), w("memberOf"), w("rule"), w("system")));

            expect(getActiveRules(g)).toEqual(["RULE1"]);

            g.add(q(w("RULE2"), w("matches"), w("?a baz ?b *"), w("RULE2")));
            g.add(q(w("RULE2"), w("produces"), w("?a qux ?b *"), w("RULE2")));
            g.add(q(w("RULE2"), w("memberOf"), w("rule"), w("system")));

            const active = getActiveRules(g);
            expect(active).toHaveLength(2);
            expect(active).toContain("RULE1");
            expect(active).toContain("RULE2");
        });

        it("should get rule definition", () => {
            const g = new WatchedGraph();
            installReifiedRules(g);

            g.add(q(w("TEST-RULE"), w("TYPE"), w("RULE!"), w("system")));
            g.add(
                q(
                    w("TEST-RULE"),
                    w("matches"),
                    w("?p age ?a *"),
                    w("TEST-RULE"),
                ),
            );
            g.add(
                q(
                    w("TEST-RULE"),
                    w("nac"),
                    w("?p deleted true *"),
                    w("TEST-RULE"),
                ),
            );
            g.add(
                q(
                    w("TEST-RULE"),
                    w("produces"),
                    w("?p verified true *"),
                    w("TEST-RULE"),
                ),
            );
            g.add(q(w("TEST-RULE"), w("memberOf"), w("rule"), w("system")));

            const def = getRuleDefinition(g, "TEST-RULE");

            expect(def).toHaveProperty("TYPE");
            expect(def.TYPE).toContain("RULE!");

            expect(def).toHaveProperty("MATCHES");
            expect(def.MATCHES).toContain("?P AGE ?A *");

            expect(def).toHaveProperty("NAC");
            expect(def.NAC).toContain("?P DELETED TRUE *");

            expect(def).toHaveProperty("PRODUCES");
            expect(def.PRODUCES).toContain("?P VERIFIED TRUE *");
        });
    });

    describe("Edge Cases", () => {
        it("should handle rule with no production gracefully", () => {
            const g = new WatchedGraph();
            const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            installReifiedRules(g);

            g.add(q(w("BAD-RULE"), w("matches"), w("?x foo ?y *"), w("BAD-RULE")));
            // No produces edge
            g.add(q(w("BAD-RULE"), w("memberOf"), w("rule"), w("system")));

            // Should warn but not crash
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it("should handle rule with no matches gracefully", () => {
            const g = new WatchedGraph();
            const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            installReifiedRules(g);

            g.add(q(w("BAD-RULE"), w("produces"), w("?x bar ?y *"), w("BAD-RULE")));
            // No matches edge
            g.add(q(w("BAD-RULE"), w("memberOf"), w("rule"), w("system")));

            // Should warn but not crash
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it("should handle invalid pattern syntax gracefully", () => {
            const g = new WatchedGraph();
            const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            installReifiedRules(g);

            g.add(
                q(w("BAD-RULE"), w("matches"), w("invalid syntax"), w("BAD-RULE")),
            );
            g.add(q(w("BAD-RULE"), w("produces"), w("?x bar ?y *"), w("BAD-RULE")));
            g.add(q(w("BAD-RULE"), w("memberOf"), w("rule"), w("system")));

            // Should log warning but not crash
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});
