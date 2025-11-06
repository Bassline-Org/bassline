import { describe, it, expect, beforeEach } from "vitest";
import { Graph, Pattern, rewrite, resolve } from "../src/minimal-graph.js";

describe("Minimal Graph Runtime", () => {
  let g;

  beforeEach(() => {
    g = new Graph();
  });

  describe("Core Operations", () => {
    it("should add edges to the graph", () => {
      const ctx1 = g.add("alice", "likes", "bob");
      const ctx2 = g.add("bob", "likes", "carol");

      expect(g.edges.length).toBe(2);
      expect(g.edges[0]).toMatchObject({
        source: "alice",
        attr: "likes",
        target: "bob",
        context: ctx1,
        id: 0
      });
      expect(g.edges[1]).toMatchObject({
        source: "bob",
        attr: "likes",
        target: "carol",
        context: ctx2,
        id: 1
      });
    });

    it("should auto-generate contexts and assign sequential IDs", () => {
      const ctx1 = g.add("a", "b", "c");
      const ctx2 = g.add("d", "e", "f");
      const ctx3 = g.add("g", "h", "i");

      // Returns auto-generated contexts
      expect(ctx1).toBe("edge:0");
      expect(ctx2).toBe("edge:1");
      expect(ctx3).toBe("edge:2");

      // Internal IDs are still sequential
      expect(g.edges[0].id).toBe(0);
      expect(g.edges[1].id).toBe(1);
      expect(g.edges[2].id).toBe(2);
    });
  });

  describe("Pattern Matching", () => {
    it("should match literal patterns", () => {
      g.add("alice", "likes", "bob");
      g.add("bob", "likes", "carol");
      g.add("alice", "age", 25);

      const results = g.query(["alice", "likes", "bob", "*"]);
      expect(results.length).toBe(1);
      expect(results[0].size).toBe(0); // No variables, so no bindings
    });

    it("should bind variables in patterns", () => {
      g.add("alice", "likes", "bob");
      g.add("bob", "likes", "carol");
      g.add("carol", "likes", "alice");

      const results = g.query(["?x", "likes", "?y", "*"]);
      expect(results.length).toBe(3);

      const bindings = results.map(b => ({
        x: b.get("?x"),
        y: b.get("?y")
      }));

      expect(bindings).toContainEqual({ x: "alice", y: "bob" });
      expect(bindings).toContainEqual({ x: "bob", y: "carol" });
      expect(bindings).toContainEqual({ x: "carol", y: "alice" });
    });

    it("should match wildcards", () => {
      g.add("alice", "likes", "bob");
      g.add("alice", "hates", "carol");
      g.add("bob", "likes", "alice");

      const results = g.query(["alice", "*", "?target", "*"]);
      expect(results.length).toBe(2);

      const targets = results.map(b => b.get("?target"));
      expect(targets).toContain("bob");
      expect(targets).toContain("carol");
    });

    it("should handle multi-pattern queries", () => {
      g.add("alice", "type", "person");
      g.add("alice", "age", 25);
      g.add("bob", "type", "person");
      g.add("bob", "age", 30);
      g.add("carol", "type", "animal");
      g.add("carol", "age", 5);

      const results = g.query(
        ["?x", "type", "person", "*"],
        ["?x", "age", "?age", "*"]
      );

      expect(results.length).toBe(2);

      const people = results.map(b => ({
        name: b.get("?x"),
        age: b.get("?age")
      }));

      expect(people).toContainEqual({ name: "alice", age: 25 });
      expect(people).toContainEqual({ name: "bob", age: 30 });
    });

    it("should enforce variable consistency across patterns", () => {
      g.add("alice", "likes", "bob");
      g.add("bob", "likes", "alice");
      g.add("alice", "age", 25);
      g.add("bob", "age", 30);

      // ?x must be the same in both patterns
      const results = g.query(
        ["?x", "likes", "bob", "*"],
        ["?x", "age", "?age", "*"]
      );

      expect(results.length).toBe(1);
      expect(results[0].get("?x")).toBe("alice");
      expect(results[0].get("?age")).toBe(25);
    });
  });

  describe("Incremental Matching", () => {
    it("should handle partial matches that complete later", () => {
      const matches = [];
      const unwatch = g.watch(
        [
          ["?x", "type", "person"],
          ["?x", "name", "?name"],
          ["?x", "age", "?age"]
        ],
        (bindings) => {
          matches.push({
            id: bindings.get("?x"),
            name: bindings.get("?name"),
            age: bindings.get("?age")
          });
        }
      );

      // Add edges out of order
      g.add("p1", "age", 25);        // Partial match
      g.add("p1", "type", "person");  // Still partial
      g.add("p1", "name", "alice");   // Complete! Should fire

      expect(matches.length).toBe(1);
      expect(matches[0]).toEqual({
        id: "p1",
        name: "alice",
        age: 25
      });

      // Add another person
      g.add("p2", "type", "person");
      g.add("p2", "name", "bob");
      g.add("p2", "age", 30);

      expect(matches.length).toBe(2);
      expect(matches[1]).toEqual({
        id: "p2",
        name: "bob",
        age: 30
      });

      unwatch();
    });

    it("should track multiple partial matches independently", () => {
      const matches = [];
      g.watch(
        [
          ["?x", "foo", "?y"],
          ["?y", "bar", "?z"]
        ],
        (bindings) => {
          matches.push({
            x: bindings.get("?x"),
            y: bindings.get("?y"),
            z: bindings.get("?z")
          });
        }
      );

      // Create multiple partial matches
      g.add("a", "foo", "b");  // Partial: a->b
      g.add("c", "foo", "d");  // Partial: c->d
      g.add("d", "bar", "e");  // Completes c->d->e

      expect(matches.length).toBe(1);
      expect(matches[0]).toEqual({ x: "c", y: "d", z: "e" });

      g.add("b", "bar", "f");  // Completes a->b->f

      expect(matches.length).toBe(2);
      expect(matches[1]).toEqual({ x: "a", y: "b", z: "f" });
    });
  });

  describe("Watch (Persistent Patterns)", () => {
    it("should fire callbacks on match", () => {
      const matches = [];
      const unwatch = g.watch(
        [["?x", "type", "trigger"]],
        (bindings) => {
          matches.push(bindings.get("?x"));
        }
      );

      g.add("t1", "type", "trigger");
      g.add("t2", "type", "trigger");
      g.add("t3", "type", "other");

      expect(matches).toEqual(["t1", "t2"]);

      unwatch();
    });

    it("should process existing edges when watch is created", () => {
      g.add("existing1", "type", "match");
      g.add("existing2", "type", "match");

      const matches = [];
      g.watch(
        [["?x", "type", "match"]],
        (bindings) => {
          matches.push(bindings.get("?x"));
        }
      );

      expect(matches).toEqual(["existing1", "existing2"]);
    });

    it("should unwatch when returned function is called", () => {
      const matches = [];
      const unwatch = g.watch(
        [["?x", "test", "true"]],
        (bindings) => {
          matches.push(bindings.get("?x"));
        }
      );

      g.add("a", "test", "true");
      expect(matches).toEqual(["a"]);

      unwatch();

      g.add("b", "test", "true");
      expect(matches).toEqual(["a"]); // Should not include "b"
    });
  });

  describe("Batch Operations", () => {
    it("should commit all edges atomically", () => {
      const success = g.batch(() => {
        g.add("a", "b", "c");
        g.add("d", "e", "f");
        g.add("g", "h", "i");
      });

      expect(success).toBe(true);
      expect(g.edges.length).toBe(3);
    });

    it("should rollback on error", () => {
      const edgesBefore = g.edges.length;

      expect(() => {
        g.batch(() => {
          g.add("a", "b", "c");
          g.add("d", "e", "f");
          throw new Error("Rollback!");
        });
      }).toThrow("Rollback!");

      expect(g.edges.length).toBe(edgesBefore);
    });

    it("should reset pattern states on rollback", () => {
      const matches = [];
      g.watch(
        [
          ["?x", "step", "1"],
          ["?x", "step", "2"]
        ],
        (bindings) => {
          matches.push(bindings.get("?x"));
        }
      );

      // Add first part outside batch
      g.add("process", "step", "1");

      // Try batch that fails
      expect(() => {
        g.batch(() => {
          g.add("process", "step", "2"); // Would complete match
          throw new Error("Rollback!");
        });
      }).toThrow();

      expect(matches).toEqual([]); // No matches should fire

      // Complete it properly
      g.add("process", "step", "2");
      expect(matches).toEqual(["process"]);
    });

    it("should handle nested patterns firing during batch", () => {
      // Rule: when we see "trigger", add "response"
      g.watch(
        [["?x", "type", "trigger"]],
        (bindings) => {
          g.add(bindings.get("?x"), "response", "fired");
        }
      );

      g.batch(() => {
        g.add("t1", "type", "trigger");
        g.add("t2", "type", "trigger");
      });

      // Check that responses were added
      const responses = g.query(["?x", "response", "fired", "*"]);
      expect(responses.length).toBe(2);
    });
  });

  describe("Graph Rewriting", () => {
    it("should apply rewrite rules", () => {
      // Rule: mark evaluated items as done
      // Pass graph as third parameter to rewrite
      g.watch(
        [["?x", "needs_eval", true]],
        rewrite(
          [["?x", "needs_eval", true]],
          [["?x", "evaluated", true]],
          g  // Pass the graph instance
        )
      );

      g.add("item1", "needs_eval", true);
      g.add("item2", "needs_eval", true);

      const evaluated = g.query(["?x", "evaluated", true, "*"]);
      expect(evaluated.length).toBe(2);
    });

    it("should resolve variables in produce patterns", () => {
      expect(resolve("?x", new Map([["?x", "alice"]]))).toBe("alice");
      expect(resolve("literal", new Map())).toBe("literal");
      expect(resolve("?unbound", new Map())).toBe("?unbound");
    });
  });

  describe("Cascading Rules", () => {
    it("should handle rules that trigger other rules", () => {
      // Rule 1: a -> b
      g.watch(
        [["?x", "a", true]],
        (bindings) => {
          g.add(bindings.get("?x"), "b", true);
        }
      );

      // Rule 2: b -> c
      g.watch(
        [["?x", "b", true]],
        (bindings) => {
          g.add(bindings.get("?x"), "c", true);
        }
      );

      // Rule 3: c -> d
      g.watch(
        [["?x", "c", true]],
        (bindings) => {
          g.add(bindings.get("?x"), "d", true);
        }
      );

      // Start the cascade
      g.add("cascade", "a", true);

      // Check all steps executed
      expect(g.query(["cascade", "b", true, "*"]).length).toBe(1);
      expect(g.query(["cascade", "c", true, "*"]).length).toBe(1);
      expect(g.query(["cascade", "d", true, "*"]).length).toBe(1);
    });
  });

  describe("Constraints", () => {
    it("should enforce constraints via patterns that throw", () => {
      // Constraint: no duplicate names
      const names = new Set();
      g.watch(
        [["?x", "name", "?name"]],
        (bindings) => {
          const name = bindings.get("?name");
          if (names.has(name)) {
            throw new Error(`Duplicate name: ${name}`);
          }
          names.add(name);
        }
      );

      g.add("p1", "name", "alice");
      g.add("p2", "name", "bob");

      expect(() => {
        g.add("p3", "name", "alice"); // Duplicate!
      }).toThrow("Duplicate name: alice");
    });
  });

  describe("Meta-Patterns (Patterns in Graph)", () => {
    it("should store pattern specifications in the graph", () => {
      // Store a pattern spec in the graph
      g.add("pattern-1", "type", "pattern");
      g.add("pattern-1", "triple", ["?x", "likes", "?y"]);
      g.add("pattern-1", "triple", ["?y", "likes", "?x"]);

      // Query for patterns
      const patterns = g.query(
        ["?p", "type", "pattern"]
      );

      expect(patterns.length).toBe(1);
      expect(patterns[0].get("?p")).toBe("pattern-1");
    });

    it("should create patterns from graph data", () => {
      // Store pattern definition
      g.add("index-rule", "match", [["?x", "type", "person"]]);
      g.add("index-rule", "action", "index");

      // Pattern that creates indexes
      g.watch(
        [["?rule", "action", "index"]],
        (bindings) => {
          // In a real implementation, we'd parse the match spec
          // and create a new pattern
          g.add("index-created", "for", bindings.get("?rule"));
        }
      );

      // Check that index creation was triggered
      const created = g.query(["index-created", "for", "?rule", "*"]);
      expect(created.length).toBe(1);
    });
  });

  describe("Index Patterns", () => {
    it("should build indexes using patterns", () => {
      // Create an "index" using a pattern
      const typeIndex = new Map();

      g.watch(
        [["?x", "type", "?t"]],
        (bindings) => {
          const type = bindings.get("?t");
          const item = bindings.get("?x");

          if (!typeIndex.has(type)) {
            typeIndex.set(type, []);
          }
          typeIndex.get(type).push(item);
        }
      );

      g.add("alice", "type", "person");
      g.add("bob", "type", "person");
      g.add("fido", "type", "dog");
      g.add("mittens", "type", "cat");

      expect(typeIndex.get("person")).toEqual(["alice", "bob"]);
      expect(typeIndex.get("dog")).toEqual(["fido"]);
      expect(typeIndex.get("cat")).toEqual(["mittens"]);
    });
  });

  describe("Performance", () => {
    it("should handle many edges efficiently", () => {
      const start = Date.now();

      // Add 1000 edges
      for (let i = 0; i < 1000; i++) {
        g.add(`node${i}`, "index", i);
      }

      // Query them
      const results = g.query(["?x", "index", "?i", "*"]);

      const elapsed = Date.now() - start;

      expect(results.length).toBe(1000);
      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it("should handle many patterns efficiently", () => {
      const matches = [];

      // Create 100 patterns
      for (let i = 0; i < 100; i++) {
        g.watch(
          [[`specific${i}`, "trigger", "?value"]],
          (bindings) => {
            matches.push(bindings.get("?value"));
          }
        );
      }

      // Trigger one of them
      g.add("specific50", "trigger", "fired!");

      expect(matches).toEqual(["fired!"]);
    });
  });
});

describe("Edge Cases", () => {
  let g;

  beforeEach(() => {
    g = new Graph();
  });

  it("should handle empty patterns", () => {
    const results = g.query();
    expect(results).toEqual([]);
  });

  it("should handle undefined wildcards", () => {
    g.add("a", "b", "c");

    const results1 = g.query([undefined, "b", "c", "*"]);
    const results2 = g.query([null, "b", "c", "*"]);

    expect(results1.length).toBe(1);
    expect(results2.length).toBe(1);
  });

  it("should handle complex values", () => {
    const obj = { complex: "object" };
    const arr = [1, 2, 3];

    g.add("node", "data", obj);
    g.add("node", "array", arr);

    const results = g.query(["node", "data", "?val", "*"]);
    expect(results[0].get("?val")).toBe(obj);

    const arrResults = g.query(["node", "array", "?val", "*"]);
    expect(arrResults[0].get("?val")).toBe(arr);
  });
});