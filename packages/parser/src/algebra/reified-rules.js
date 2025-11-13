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

import { matchGraph, pattern, patternQuad } from "./pattern.js";
import { quad as q } from "./quad.js";
import { isWildcard, variable as v, WC, word as w } from "../types.js";
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

    const activationPattern = pattern(
        patternQuad(w("meta"), w("type"), w("rule!"), v("ctx")),
        patternQuad(w("meta"), w("nac"), v("nac"), v("ctx")),
    );

    graph.watch({
        pattern: activationPattern,
        production: (match) => {
            const ctx = match.get("ctx");
            const hasNac = match.get("nac").toString() === "TRUE"
                ? true
                : false;
            activateRule(graph, ctx, activeRules, hasNac);
        },
    });

    return activeRules;
}

/**
 * Extract string value from Word or other value
 */
export function getString(val) {
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
 * @example
 * ;; TO ENABLE
 * in some-rule {
 *   rule {
 *     where "?p age ?a *"
 *     produce "?p has-age true *"
 *   }
 *   meta {
 *     type rule!
 *     nac false
 *   }
 * }
 *
 * ;; TO DISABLE
 * in some-rule {
 *   meta disable rule
 * }
 */
function activateRule(graph, ruleId, activeRules, hasNac) {
    const rulePatterns = [
        patternQuad(w("rule"), w("where"), v("where"), ruleId),
        patternQuad(w("rule"), w("produce"), v("produce"), ruleId),
    ];
    if (hasNac) {
        rulePatterns.push(patternQuad(w("rule"), w("not"), v("not"), ruleId));
    }
    let unwatchDefinition;
    unwatchDefinition = graph.watch({
        pattern: pattern(
            ...rulePatterns,
        ),
        production: (match) => {
            const rule = buildRule(
                match.get("where"),
                match.get("produce"),
                match.get("not"),
            );
            if (!rule) {
                console.warn(`Missing rule: ${ruleId}`);
                return [];
            }
            // The unwatch function for the defined rule
            const unwatchRule = graph.watch(rule);
            // The unwatch function to deactive the newly defined rule
            const unwatchDisableRule = graph.watch({
                pattern: pattern(
                    patternQuad(w("meta"), w("disable"), w("rule"), ruleId),
                ),
                production: (_match) => {
                    console.log("Deactivating rule", ruleId);
                    unwatchRule();
                    unwatchDisableRule();
                    return [];
                },
            });
            // When we match and define the rule, we uninstall the definition watcher
            unwatchDefinition?.();
            activeRules.set(getString(ruleId), unwatchRule);
            return [];
        },
    });
    return [];
}

function buildRule(whereStr, produceStr, notStr) {
    const where = parsePatterns(whereStr).map(toPatternQuad);
    // NOTE: We don't need to convert to PatternQuads here, because we will use substitute to
    // convert the variables to their actual values
    const produce = parsePatterns(produceStr);

    if (where.length === 0) {
        console.warn(`Missing WHERE pattern: ${whereStr}`);
        return null;
    }
    if (produce.length === 0) {
        console.warn(`Missing PRODUCE pattern: ${produceStr}`);
        return null;
    }

    const rulePattern = pattern(...where);
    if (notStr) {
        const not = parsePatterns(notStr).map(toPatternQuad);
        if (not.length === 0) {
            console.warn(`Missing NOT pattern: ${notStr}`);
            return null;
        }
        rulePattern.setNAC(...not);
    }

    return {
        pattern: rulePattern,
        production: (match) => {
            const produced = produce.map(([e, a, v, c]) =>
                q(
                    substitute(e, match),
                    substitute(a, match),
                    substitute(v, match),
                    substitute(c, match),
                )
            );
            return produced;
        },
    };
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
    const pat = pattern(
        patternQuad(w("meta"), w("type"), w("rule!"), v("ctx")),
    );
    pat.setNAC(
        patternQuad(w("meta"), w("disable"), w("rule"), v("ctx")),
    );
    return matchGraph(graph, pat).map((m) => getString(m.get("ctx")));
}

/**
 * Get full definition of a rule
 */
export function getRuleDefinition(graph, ruleId) {
    const results = matchGraph(
        graph,
        pattern(patternQuad(w("rule"), v("prop"), v("val"), ruleId)),
    );
    return results.reduce((def, m) => {
        const propKey = getString(m.get("prop"));
        const valStr = getString(m.get("val"));
        if (!def[propKey]) def[propKey] = [];
        def[propKey].push(valStr);
        return def;
    }, {});
}
