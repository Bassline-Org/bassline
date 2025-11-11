import { useMemo } from "react";
import { useQuery } from "./useQuery.js";
import { pattern, patternQuad as pq } from "@bassline/parser/algebra";
import { variable as v, word as w } from "@bassline/parser/types";
import { serialize } from "@bassline/parser/types";

/**
 * Hook for querying active reified rules in the graph
 *
 * Returns structured data about all active rules including their patterns,
 * production rules, and metadata. Rules are considered active if they have
 * the edge: rule-name memberOf rule system
 *
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Array<Object>} Array of rule objects with:
 *   - name: Rule name (Word)
 *   - nameStr: Serialized rule name (string)
 *   - matchPattern: Pattern string for matching
 *   - producePattern: Pattern string for production
 *   - isActive: Boolean indicating if rule is active
 *
 * @example
 * ```jsx
 * import { useActiveRules } from '@bassline/parser-react/hooks';
 *
 * function RuleList({ events }) {
 *   const rules = useActiveRules(events);
 *
 *   return (
 *     <div>
 *       <h2>Active Rules ({rules.filter(r => r.isActive).length})</h2>
 *       {rules.map(rule => (
 *         <div key={rule.nameStr}>
 *           <h3>{rule.nameStr}</h3>
 *           <p>Matches: {rule.matchPattern}</p>
 *           <p>Produces: {rule.producePattern}</p>
 *           <span>{rule.isActive ? 'Active' : 'Inactive'}</span>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useActiveRules(events) {
    // Query for all rules (entities with TYPE RULE!)
    const ruleTypePattern = useMemo(() => {
        return pattern(
            pq(v("rule"), w("type"), w("rule!"), w("system")),
        );
    }, []);

    const ruleMatches = useQuery(ruleTypePattern, events);

    // For each rule, get its metadata
    const rules = useMemo(() => {
        return ruleMatches.map((match) => {
            return match.get("rule");
        });
    }, [ruleMatches]);

    return rules;
}

/**
 * Hook for querying detailed metadata about a specific rule
 *
 * Returns all metadata for a single rule including match pattern,
 * produce pattern, and active status.
 *
 * @param {Word} rule - Rule to query
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Object|null} Rule details or null if not found
 *
 * @example
 * ```jsx
 * function RuleDetails({ ruleName, events }) {
 *   const rule = useRuleDetails(ruleName, events);
 *
 *   if (!rule) return <div>Rule not found</div>;
 *
 *   return (
 *     <div>
 *       <h2>{rule.nameStr}</h2>
 *       <pre>Matches: {rule.matchPattern}</pre>
 *       <pre>Produces: {rule.producePattern}</pre>
 *       <span>Status: {rule.isActive ? 'Active' : 'Inactive'}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRuleDetails(rule, events) {
    const metadataPattern = useMemo(() => {
        return pattern(
            pq(rule, w("matches"), v("matchPattern"), rule),
            pq(rule, w("produces"), v("producePattern"), rule),
        );
    }, [rule]);

    const metadata = useQuery(metadataPattern, events);
    const activeQuery = useQuery(
        pattern(pq(rule, w("memberOf"), w("rule"), w("system")))
            .setNAC(pq(rule, w("memberOf"), w("rule"), w("tombstone"))),
        events,
    );
    const isActive = activeQuery.length > 0;

    const ruleDetails = useMemo(() => {
        if (!metadata.length) return null;

        let details = {
            isActive,
        };

        metadata.forEach((match) => {
            const matchPattern = match.get("matchPattern");
            const producePattern = match.get("producePattern");
            details["matchPattern"] = matchPattern;
            details["producePattern"] = producePattern;
        });
        console.log("Details", details);

        return details;
    }, [metadata, rule]);

    return ruleDetails;
}
