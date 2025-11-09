/**
 * Reified Rules - Graph-Native Rule Storage & Activation
 *
 * Rules are stored as edges in the graph and activated via "memberOf" pattern.
 * Supports full pattern syntax including multi-quad patterns and NAC.
 *
 * @example
 * import { installReifiedRules } from '@bassline/parser/algebra/reified-rules';
 * import { WatchedGraph } from '@bassline/parser/algebra/watch';
 * import { quad as q } from '@bassline/parser/algebra/quad';
 * import { word as w } from '@bassline/parser/types';
 *
 * const g = new WatchedGraph();
 * installReifiedRules(g);
 *
 * // Define rule structure
 * g.add(q(w("VERIFY"), w("TYPE"), w("RULE!"), w("system")));
 * g.add(q(w("VERIFY"), w("matches"), w("?p type person *"), w("VERIFY")));
 * g.add(q(w("VERIFY"), w("nac"), w("?p deleted true *"), w("VERIFY")));
 * g.add(q(w("VERIFY"), w("produces"), w("?p verified true *"), w("VERIFY")));
 *
 * // Activate rule
 * g.add(q(w("VERIFY"), w("memberOf"), w("rule"), w("system")));
 */

import { pattern, patternQuad, matchGraph } from "./pattern.js";
import { quad as q } from "./quad.js";
import { word as w, variable as v, WC, isWildcard } from "../types.js";
import { parsePatterns } from "../pattern-parser.js";

/**
 * Install reified rules system on a WatchedGraph
 *
 * Sets up watchers for rule activation/deactivation patterns.
 * Rules activate when [ruleId, "memberOf", "rule", "system"] is added.
 * Rules deactivate when [ruleId, "memberOf", "rule", "tombstone"] is added.
 *
 * @param {WatchedGraph} graph - Graph to install rules system on
 * @returns {Map<string, Function>} Map of active rules (ruleId → unwatch function)
 */
export function installReifiedRules(graph) {
    const activeRules = new Map(); // ruleId spelling → unwatch function

    // Watch for rule activation: [?rule, "memberOf", "rule", "system"]
    const activationPattern = pattern(
        patternQuad(v("rule"), w("memberOf"), w("rule"), w("system")),
    );

    graph.watch({
        pattern: activationPattern,
        production: (match) => {
            const ruleId = match.get("rule");
            activateRule(graph, ruleId, activeRules);
            return [];
        },
    });

    // Watch for rule deactivation: [?rule, "memberOf", "rule", "tombstone"]
    const deactivationPattern = pattern(
        patternQuad(v("rule"), w("memberOf"), w("rule"), w("tombstone")),
    );

    graph.watch({
        pattern: deactivationPattern,
        production: (match) => {
            const ruleId = match.get("rule");
            deactivateRule(ruleId, activeRules);
            return [];
        },
    });

    return activeRules;
}

/**
 * Extract string value from Word or other value
 */
function getString(val) {
    return val?.spelling?.description || String(val);
}

/**
 * Convert array to PatternQuad
 */
function toPatternQuad([e, a, v, c]) {
    return patternQuad(e, a, v, c ?? WC);
}

/**
 * Activate a rule by querying its structure and installing watchers
 */
function activateRule(graph, ruleId, activeRules) {
    // Query rule definition edges
    const matches = matchGraph(graph, pattern(patternQuad(ruleId, w("matches"), v("p"), WC)));
    const nacs = matchGraph(graph, pattern(patternQuad(ruleId, w("nac"), v("n"), WC)));
    const produces = matchGraph(graph, pattern(patternQuad(ruleId, w("produces"), v("p"), WC)));

    // Extract pattern strings
    const matchStr = matches.map(m => getString(m.get("p"))).join(" ");
    const produceStr = getString(produces[0]?.get("p"));

    // Validate
    if (!matchStr) {
        console.warn(`Rule ${getString(ruleId)} has no match patterns`);
        return;
    }
    if (!produceStr || produceStr === "undefined") {
        console.warn(`Rule ${getString(ruleId)} has no production template`);
        return;
    }

    try {
        // Parse patterns
        const matchQuads = parsePatterns(matchStr);
        const produceQuads = parsePatterns(produceStr);

        if (matchQuads.length === 0) {
            console.warn(`Rule ${getString(ruleId)} has invalid match pattern: ${matchStr}`);
            return;
        }

        // Build pattern with NAC
        const rulePattern = pattern(...matchQuads.map(toPatternQuad));
        if (nacs.length > 0) {
            const nacStr = nacs.map(n => getString(n.get("n"))).join(" ");
            const nacQuads = parsePatterns(nacStr);
            rulePattern.setNAC(...nacQuads.map(toPatternQuad));
        }

        // Build production function
        const production = (match) => produceQuads.map(([e, a, v, c]) =>
            q(substitute(e, match), substitute(a, match), substitute(v, match), substitute(c, match))
        );

        // Install watcher
        const unwatch = graph.watch({ pattern: rulePattern, production });
        activeRules.set(getString(ruleId), unwatch);
    } catch (error) {
        console.error(`Failed to parse rule ${getString(ruleId)}:`, error);
    }
}

/**
 * Deactivate a rule by calling its unwatch function
 */
function deactivateRule(ruleId, activeRules) {
    const unwatch = activeRules.get(getString(ruleId));
    if (unwatch) {
        unwatch();
        activeRules.delete(getString(ruleId));
    }
}

/**
 * Substitute a value with match binding if it's a variable
 */
function substitute(val, match) {
    if (val?.constructor?.name === "PatternVar") {
        return match.get(val.name) ?? val;
    }
    if (isWildcard(val)) {
        return undefined;
    }
    return val;
}

/**
 * Get list of active rule IDs
 */
export function getActiveRules(graph) {
    const pat = pattern(patternQuad(v("rule"), w("memberOf"), w("rule"), w("system")));
    pat.setNAC(patternQuad(v("rule"), w("memberOf"), w("rule"), w("tombstone")));
    return matchGraph(graph, pat).map(m => getString(m.get("rule")));
}

/**
 * Get full definition of a rule
 */
export function getRuleDefinition(graph, ruleId) {
    const results = matchGraph(graph, pattern(patternQuad(w(ruleId), v("prop"), v("val"), WC)));
    return results.reduce((def, m) => {
        const propKey = getString(m.get("prop"));
        const valStr = getString(m.get("val"));
        if (!def[propKey]) def[propKey] = [];
        def[propKey].push(valStr);
        return def;
    }, {});
}

