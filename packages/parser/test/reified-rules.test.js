/**
 * Reified Rules Tests
 *
 * Tests graph-native rule storage and activation via system contexts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Graph } from "../src/minimal-graph.js";
import { createContext } from "../src/pattern-words.js";
import {
  installReifiedRules,
  getActiveRules,
  getRuleDefinition,
  getRuleFirings,
  parseQuadString,
} from "../extensions/reified-rules.js";

describe("Reified Rules - Basic Functionality", () => {
  let graph;
  let context;

  beforeEach(() => {
    graph = new Graph();
    context = createContext(graph);
    installReifiedRules(graph, context);
  });

  it("should parse quad strings correctly", () => {
    const quad1 = parseQuadString("?x TYPE PERSON *");
    expect(quad1).toEqual(["?X", "TYPE", "PERSON", "*"]);

    const quad2 = parseQuadString("ALICE AGE 30 *");
    expect(quad2).toEqual(["ALICE", "AGE", 30, "*"]);

    const quad3 = parseQuadString('?x NAME "Alice Smith" *');
    expect(quad3).toEqual(["?X", "NAME", "Alice Smith", "*"]);
  });

  it("should activate a simple rule", () => {
    // Define rule structure as edges
    graph.add("ADULT-CHECK", "TYPE", "RULE!", "system");
    graph.add("ADULT-CHECK", "matches", "?p AGE ?a *", "ADULT-CHECK");
    graph.add("ADULT-CHECK", "produces", "?p ADULT TRUE *", "ADULT-CHECK");

    // Activate rule
    graph.add("ADULT-CHECK", "memberOf", "rule", "system");

    // Verify rule is active
    const activeRules = getActiveRules(graph);
    expect(activeRules).toContain("ADULT-CHECK");

    // Add data that matches
    graph.add("ALICE", "AGE", 30, null);

    // Check rule fired
    const adults = graph.query(["?p", "ADULT", "?v", "*"]);
    expect(adults.length).toBe(1);
    expect(adults[0].get("?p")).toBe("ALICE");
    expect(adults[0].get("?v")).toBe("TRUE");

    // Check firing count
    expect(getRuleFirings(graph, "ADULT-CHECK")).toBeGreaterThan(0);
  });

  it("should handle multiple match patterns", () => {
    // Rule: person with age > 18 gets ADULT marker
    graph.add("PERSON-ADULT", "TYPE", "RULE!", "system");
    graph.add("PERSON-ADULT", "matches", "?p TYPE PERSON *", "PERSON-ADULT");
    graph.add("PERSON-ADULT", "matches", "?p AGE ?a *", "PERSON-ADULT");
    graph.add("PERSON-ADULT", "produces", "?p ADULT TRUE *", "PERSON-ADULT");

    // Activate
    graph.add("PERSON-ADULT", "memberOf", "rule", "system");

    // Add partial data (only TYPE)
    graph.add("BOB", "TYPE", "PERSON", null);

    // Should not fire yet (needs both TYPE and AGE)
    let adults = graph.query(["?p", "ADULT", "?v", "*"]);
    expect(adults.length).toBe(0);

    // Add AGE
    graph.add("BOB", "AGE", 25, null);

    // Now should fire
    adults = graph.query(["?p", "ADULT", "?v", "*"]);
    expect(adults.length).toBe(1);
    expect(adults[0].get("?p")).toBe("BOB");
  });

  it("should handle NAC (Negative Application Condition)", () => {
    // Rule: mark as ELIGIBLE only if NOT deleted
    graph.add("ELIGIBILITY", "TYPE", "RULE!", "system");
    graph.add("ELIGIBILITY", "matches", "?p TYPE PERSON *", "ELIGIBILITY");
    graph.add("ELIGIBILITY", "nac", "?p DELETED TRUE *", "ELIGIBILITY");
    graph.add("ELIGIBILITY", "produces", "?p ELIGIBLE TRUE *", "ELIGIBILITY");

    // Activate
    graph.add("ELIGIBILITY", "memberOf", "rule", "system");

    // Add person
    graph.add("ALICE", "TYPE", "PERSON", null);

    // Should fire (not deleted)
    let eligible = graph.query(["?p", "ELIGIBLE", "?v", "*"]);
    expect(eligible.length).toBe(1);
    expect(eligible[0].get("?p")).toBe("ALICE");

    // Add another person who is deleted
    // Note: DELETED must be added BEFORE TYPE because BOB is added AFTER rule activation
    // When TYPE edge triggers the watcher, NAC checks if DELETED exists at that moment
    graph.add("BOB", "DELETED", "TRUE", null);
    graph.add("BOB", "TYPE", "PERSON", null);

    // BOB should not get ELIGIBLE marker
    eligible = graph.query(["?p", "ELIGIBLE", "?v", "*"]);
    expect(eligible.length).toBe(1); // Still just ALICE
  });

  it("should allow deactivation", () => {
    // Define and activate rule
    graph.add("TEMP-RULE", "TYPE", "RULE!", "system");
    graph.add("TEMP-RULE", "matches", "?x FOO ?y *", "TEMP-RULE");
    graph.add("TEMP-RULE", "produces", "?x BAR ?y *", "TEMP-RULE");
    graph.add("TEMP-RULE", "memberOf", "rule", "system");

    // Verify active
    expect(getActiveRules(graph)).toContain("TEMP-RULE");

    // Add data - should fire
    graph.add("A", "FOO", "B", null);
    let results = graph.query(["A", "BAR", "?v", "*"]);
    expect(results.length).toBe(1);

    // Deactivate
    graph.add("TEMP-RULE", "memberOf", "rule", "tombstone");

    // Verify not active
    expect(getActiveRules(graph)).not.toContain("TEMP-RULE");

    // Add more data - should NOT fire
    graph.add("C", "FOO", "D", null);
    results = graph.query(["C", "BAR", "?v", "*"]);
    expect(results.length).toBe(0);
  });

  it("should scan existing edges on activation (order doesn't matter)", () => {
    // Add data BEFORE activating rule (any order works)
    graph.add("CHARLIE", "TYPE", "PERSON", null);
    graph.add("DAVE", "DELETED", "TRUE", null);
    graph.add("DAVE", "TYPE", "PERSON", null);  // Added after DELETED - would fail if reactive-only

    // Now define and activate rule
    graph.add("ELIGIBILITY", "TYPE", "RULE!", "system");
    graph.add("ELIGIBILITY", "matches", "?p TYPE PERSON *", "ELIGIBILITY");
    graph.add("ELIGIBILITY", "nac", "?p DELETED TRUE *", "ELIGIBILITY");
    graph.add("ELIGIBILITY", "produces", "?p ELIGIBLE TRUE *", "ELIGIBILITY");
    graph.add("ELIGIBILITY", "memberOf", "rule", "system");

    // Rule should have scanned existing edges and processed both
    const eligible = graph.query(["?p", "ELIGIBLE", "?v", "*"]);
    expect(eligible.length).toBe(1); // Only CHARLIE (DAVE blocked by NAC)
    expect(eligible[0].get("?p")).toBe("CHARLIE");
  });

  it("should query rule definition", () => {
    graph.add("MY-RULE", "TYPE", "RULE!", "system");
    graph.add("MY-RULE", "matches", "?x FOO ?y *", "MY-RULE");
    graph.add("MY-RULE", "matches", "?y BAR ?z *", "MY-RULE");
    graph.add("MY-RULE", "produces", "?x BAZ ?z *", "MY-RULE");
    graph.add("MY-RULE", "nac", "?x SKIP TRUE *", "MY-RULE");

    const def = getRuleDefinition(graph, "MY-RULE");

    expect(def.matchQuads.length).toBe(2);
    expect(def.produceQuads.length).toBe(1);
    expect(def.nacQuads.length).toBe(1);

    expect(def.matchQuads).toContain("?x FOO ?y *");
    expect(def.produceQuads).toContain("?x BAZ ?z *");
    expect(def.nacQuads).toContain("?x SKIP TRUE *");
  });
});

describe("Reified Rules - Complex Scenarios", () => {
  let graph;
  let context;

  beforeEach(() => {
    graph = new Graph();
    context = createContext(graph);
    installReifiedRules(graph, context);
  });

  it("should handle cascading rules", () => {
    // Rule 1: TYPE PERSON → VERIFIED
    graph.add("VERIFY", "TYPE", "RULE!", "system");
    graph.add("VERIFY", "matches", "?p TYPE PERSON *", "VERIFY");
    graph.add("VERIFY", "produces", "?p VERIFIED TRUE *", "VERIFY");
    graph.add("VERIFY", "memberOf", "rule", "system");

    // Rule 2: VERIFIED → PROCESSED
    graph.add("PROCESS", "TYPE", "RULE!", "system");
    graph.add("PROCESS", "matches", "?p VERIFIED TRUE *", "PROCESS");
    graph.add("PROCESS", "produces", "?p PROCESSED TRUE *", "PROCESS");
    graph.add("PROCESS", "memberOf", "rule", "system");

    // Rule 3: PROCESSED → COMPLETE
    graph.add("COMPLETE", "TYPE", "RULE!", "system");
    graph.add("COMPLETE", "matches", "?p PROCESSED TRUE *", "COMPLETE");
    graph.add("COMPLETE", "produces", "?p COMPLETE TRUE *", "COMPLETE");
    graph.add("COMPLETE", "memberOf", "rule", "system");

    // Add person
    graph.add("ALICE", "TYPE", "PERSON", null);

    // All three rules should fire in cascade
    expect(graph.query(["ALICE", "VERIFIED", "?v", "*"]).length).toBe(1);
    expect(graph.query(["ALICE", "PROCESSED", "?v", "*"]).length).toBe(1);
    expect(graph.query(["ALICE", "COMPLETE", "?v", "*"]).length).toBe(1);
  });

  it("should handle multiple produce patterns", () => {
    // Rule that produces multiple edges
    graph.add("MULTI-PRODUCE", "TYPE", "RULE!", "system");
    graph.add("MULTI-PRODUCE", "matches", "?p TYPE PERSON *", "MULTI-PRODUCE");
    graph.add("MULTI-PRODUCE", "produces", "?p STATUS ACTIVE *", "MULTI-PRODUCE");
    graph.add("MULTI-PRODUCE", "produces", "?p CATEGORY USER *", "MULTI-PRODUCE");
    graph.add("MULTI-PRODUCE", "produces", "?p CREATED-AT 2025 *", "MULTI-PRODUCE");
    graph.add("MULTI-PRODUCE", "memberOf", "rule", "system");

    // Add person
    graph.add("BOB", "TYPE", "PERSON", null);

    // Check all produced edges
    expect(graph.query(["BOB", "STATUS", "ACTIVE", "*"]).length).toBe(1);
    expect(graph.query(["BOB", "CATEGORY", "USER", "*"]).length).toBe(1);
    expect(graph.query(["BOB", "CREATED-AT", 2025, "*"]).length).toBe(1);
  });

  it("should handle variable resolution across patterns", () => {
    // Rule: if X likes Y and Y likes Z, then X knows Z
    graph.add("TRANSITIVE-LIKES", "TYPE", "RULE!", "system");
    graph.add("TRANSITIVE-LIKES", "matches", "?x LIKES ?y *", "TRANSITIVE-LIKES");
    graph.add("TRANSITIVE-LIKES", "matches", "?y LIKES ?z *", "TRANSITIVE-LIKES");
    graph.add("TRANSITIVE-LIKES", "produces", "?x KNOWS ?z *", "TRANSITIVE-LIKES");
    graph.add("TRANSITIVE-LIKES", "memberOf", "rule", "system");

    // Add relationships
    graph.add("ALICE", "LIKES", "BOB", null);
    graph.add("BOB", "LIKES", "CHARLIE", null);

    // Check inference
    const knows = graph.query(["ALICE", "KNOWS", "?z", "*"]);
    expect(knows.length).toBe(1);
    expect(knows[0].get("?z")).toBe("CHARLIE");
  });
});

describe("Reified Rules - Introspection", () => {
  let graph;
  let context;

  beforeEach(() => {
    graph = new Graph();
    context = createContext(graph);
    installReifiedRules(graph, context);
  });

  it("should list all rules", () => {
    // Add multiple rules
    ["RULE-A", "RULE-B", "RULE-C"].forEach(name => {
      graph.add(name, "TYPE", "RULE!", "system");
      graph.add(name, "matches", "?x FOO ?y *", name);
      graph.add(name, "produces", "?x BAR ?y *", name);
      graph.add(name, "memberOf", "rule", "system");
    });

    const activeRules = getActiveRules(graph);
    expect(activeRules).toContain("RULE-A");
    expect(activeRules).toContain("RULE-B");
    expect(activeRules).toContain("RULE-C");
    expect(activeRules.length).toBe(3);
  });

  it("should query all rules of a type", () => {
    // Add rules with TYPE marker
    graph.add("AUTH-RULE-1", "TYPE", "RULE!", "system");
    graph.add("AUTH-RULE-1", "CATEGORY", "AUTH", "system");
    graph.add("AUTH-RULE-1", "matches", "?x FOO ?y *", "AUTH-RULE-1");
    graph.add("AUTH-RULE-1", "produces", "?x BAR ?y *", "AUTH-RULE-1");
    graph.add("AUTH-RULE-1", "memberOf", "rule", "system");

    graph.add("AUTH-RULE-2", "TYPE", "RULE!", "system");
    graph.add("AUTH-RULE-2", "CATEGORY", "AUTH", "system");
    graph.add("AUTH-RULE-2", "matches", "?x BAZ ?y *", "AUTH-RULE-2");
    graph.add("AUTH-RULE-2", "produces", "?x QUX ?y *", "AUTH-RULE-2");
    graph.add("AUTH-RULE-2", "memberOf", "rule", "system");

    // Query all AUTH rules
    const authRules = graph.query(["?r", "CATEGORY", "AUTH", "system"])
      .map(b => b.get("?r"));

    expect(authRules).toContain("AUTH-RULE-1");
    expect(authRules).toContain("AUTH-RULE-2");
    expect(authRules.length).toBe(2);
  });

  it("should track rule firings", () => {
    graph.add("COUNTER", "TYPE", "RULE!", "system");
    graph.add("COUNTER", "matches", "?x FOO ?y *", "COUNTER");
    graph.add("COUNTER", "produces", "?x BAR ?y *", "COUNTER");
    graph.add("COUNTER", "memberOf", "rule", "system");

    // Should not have fired yet
    expect(getRuleFirings(graph, "COUNTER")).toBe(0);

    // Trigger once
    graph.add("A", "FOO", "B", null);
    expect(getRuleFirings(graph, "COUNTER")).toBe(1);

    // Trigger again
    graph.add("C", "FOO", "D", null);
    expect(getRuleFirings(graph, "COUNTER")).toBe(2);

    // Query firing IDs
    const firings = graph.query(["COUNTER", "FIRED", "?firingId", "system"]);
    expect(firings.length).toBe(2);
    expect(typeof firings[0].get("?firingId")).toBe("string");

    // Verify timestamps exist for each firing
    const firingId1 = firings[0].get("?firingId");
    const timestamps = graph.query([firingId1, "TIMESTAMP", "?ts", "system"]);
    expect(timestamps.length).toBe(1);
    expect(typeof timestamps[0].get("?ts")).toBe("number");
  });
});
