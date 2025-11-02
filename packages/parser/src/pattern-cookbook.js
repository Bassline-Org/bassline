/**
 * Pattern Cookbook - A library of useful patterns
 *
 * These patterns show how to implement "missing" features using just
 * our basic primitives. Everything here is built from patterns!
 */

/**
 * Install common patterns into a graph with DSL
 */
export function installCookbookPatterns(dsl, graph) {
  const patterns = {};

  // ============================================================================
  // DELETION PATTERNS - Soft delete via tombstones
  // ============================================================================

  patterns.deletion = () => {
    // When something is marked for deletion, add a tombstone
    dsl.rule('add-tombstone',
      '?entity', 'DELETE_REQUEST', 'true', '->',
      '?entity', 'DELETED_AT', Date.now().toString(),
      '?entity', 'TOMBSTONE', 'true'
    );

    // Pattern to find non-deleted entities
    dsl.pattern('active-entities',
      '?entity', '?attr', '?value'
      // Note: We'd need NOT support to check for absence of TOMBSTONE
    );

    return "Deletion patterns installed";
  };

  // ============================================================================
  // COUNTING PATTERNS - Incremental aggregation
  // ============================================================================

  patterns.counter = (patternName, counterName) => {
    // Create a counter that increments when pattern matches
    let count = 0;

    // Watch for the pattern and increment
    const spec = graph.query([`pattern:${patternName}`, "SPEC", "?spec"])[0];
    if (!spec) {
      throw new Error(`Pattern ${patternName} not found`);
    }

    const patternSpec = JSON.parse(spec.get("?spec"));
    graph.watch(patternSpec, () => {
      count++;
      graph.add(`counter:${counterName}`, "VALUE", count);
      graph.add(`counter:${counterName}`, "UPDATED", Date.now());
    });

    return `Counter ${counterName} installed`;
  };

  // ============================================================================
  // INDEXING PATTERNS - Build indexes as patterns
  // ============================================================================

  patterns.index = (attribute) => {
    // Create an index on a specific attribute
    dsl.rule(`index-${attribute}`,
      '?source', attribute, '?target', '->',
      `index:${attribute}:?target`, 'CONTAINS', '?source',
      `index:${attribute}:?target`, 'COUNT', '1'  // We'd increment this
    );

    // Pattern to use the index
    dsl.pattern(`indexed-${attribute}`,
      `index:${attribute}:?value`, 'CONTAINS', '?entity'
    );

    return `Index on ${attribute} installed`;
  };

  // ============================================================================
  // NEGATION PATTERNS - Check for absence
  // ============================================================================

  patterns.negation = () => {
    // Mark things that DO have certain attributes
    dsl.rule('mark-typed',
      '?entity', 'TYPE?', '?type', '->',
      '?entity', 'HAS_TYPE', 'true',
      `type:${Date.now()}:?entity`, 'IS', '?type'
    );

    // Find entities WITHOUT types (check for absence of marker)
    // This is a hack - we'd need proper NOT support
    dsl.pattern('untyped-entities',
      '?entity', 'NAME', '?name'
      // AND NOT: ?entity HAS_TYPE true
    );

    return "Negation patterns installed";
  };

  // ============================================================================
  // EPOCH/VERSION PATTERNS - Temporal data
  // ============================================================================

  patterns.versioning = () => {
    let currentEpoch = 1;

    // Add epoch to all new facts
    const originalAdd = graph.add.bind(graph);
    graph.add = function(source, attr, target) {
      const id = originalAdd(source, attr, target);
      originalAdd(`edge:${id}`, "EPOCH", currentEpoch);
      return id;
    };

    // Function to advance epoch
    dsl['advance-epoch'] = () => {
      currentEpoch++;
      graph.add("SYSTEM", "CURRENT_EPOCH", currentEpoch);
      return `Epoch advanced to ${currentEpoch}`;
    };

    // Pattern for current epoch data only
    dsl.pattern('current-epoch',
      '?edge', 'EPOCH', currentEpoch.toString()
    );

    return "Versioning patterns installed";
  };

  // ============================================================================
  // STRATIFICATION PATTERNS - Control rule execution order
  // ============================================================================

  patterns.stratification = () => {
    let currentStratum = 0;
    const stratifiedRules = new Map();

    // Modified rule creation that respects strata
    dsl['stratified-rule'] = (stratum, name, ...parts) => {
      stratifiedRules.set(name, { stratum, parts });

      // Only activate if in current stratum
      if (stratum === currentStratum) {
        dsl.rule(name, ...parts);
      }

      graph.add(`rule:${name}`, "STRATUM", stratum);
      return `Stratified rule ${name} at stratum ${stratum}`;
    };

    // Advance to next stratum
    dsl['next-stratum'] = () => {
      currentStratum++;
      graph.add("SYSTEM", "CURRENT_STRATUM", currentStratum);

      // Activate rules for new stratum
      stratifiedRules.forEach(({ stratum, parts }, name) => {
        if (stratum === currentStratum) {
          dsl.rule(name, ...parts);
        }
      });

      return `Advanced to stratum ${currentStratum}`;
    };

    return "Stratification patterns installed";
  };

  // ============================================================================
  // META-PATTERNS - Patterns that create patterns
  // ============================================================================

  patterns.metaPatterns = () => {
    // Pattern that watches for pattern definitions in the graph
    dsl.rule('pattern-creator',
      '?def', 'TYPE', 'PATTERN_DEF',
      '?def', 'SPEC', '?spec', '->',
      `created:${Date.now()}`, 'PATTERN', '?spec'
    );

    // Watch for pattern creation requests
    graph.watch([["?def", "TYPE", "PATTERN_DEF"]], (bindings) => {
      const def = bindings.get("?def");
      const specResults = graph.query([def, "SPEC", "?spec"]);

      if (specResults.length > 0) {
        const spec = JSON.parse(specResults[0].get("?spec"));
        // Create the actual pattern
        graph.watch(spec, (matchBindings) => {
          graph.add(`meta-pattern:${def}`, "MATCHED", Date.now());
        });
      }
    });

    return "Meta-patterns installed";
  };

  // ============================================================================
  // CONSTRAINT PATTERNS - Patterns that enforce invariants
  // ============================================================================

  patterns.constraints = () => {
    // No duplicate names constraint
    const names = new Set();

    dsl['unique-name-constraint'] = () => {
      graph.watch([["?entity", "NAME", "?name"]], (bindings) => {
        const name = bindings.get("?name");
        if (names.has(name)) {
          // Mark as constraint violation
          graph.add("CONSTRAINT_VIOLATION", "DUPLICATE_NAME", name);
          graph.add("CONSTRAINT_VIOLATION", "TIME", Date.now());
          throw new Error(`Duplicate name: ${name}`);
        }
        names.add(name);
      });
      return "Unique name constraint installed";
    };

    // Age must be positive constraint
    dsl['positive-age-constraint'] = () => {
      graph.watch([["?entity", "AGE", "?age"]], (bindings) => {
        const age = bindings.get("?age");
        if (age < 0) {
          graph.add("CONSTRAINT_VIOLATION", "NEGATIVE_AGE", age);
          throw new Error(`Age cannot be negative: ${age}`);
        }
      });
      return "Positive age constraint installed";
    };

    return "Constraint patterns installed";
  };

  // ============================================================================
  // AGGREGATION PATTERNS - Sum, average, etc.
  // ============================================================================

  patterns.aggregation = () => {
    // Sum aggregator
    dsl['create-sum'] = (name, pattern, field) => {
      let sum = 0;
      const spec = JSON.parse(graph.query([`pattern:${pattern}`, "SPEC", "?s"])[0]?.get("?s") || "[]");

      graph.watch(spec, (bindings) => {
        const value = bindings.get(field);
        if (typeof value === 'number') {
          sum += value;
          graph.add(`sum:${name}`, "VALUE", sum);
          graph.add(`sum:${name}`, "UPDATED", Date.now());
        }
      });

      return `Sum ${name} created`;
    };

    // Average aggregator
    dsl['create-average'] = (name, pattern, field) => {
      let sum = 0;
      let count = 0;
      const spec = JSON.parse(graph.query([`pattern:${pattern}`, "SPEC", "?s"])[0]?.get("?s") || "[]");

      graph.watch(spec, (bindings) => {
        const value = bindings.get(field);
        if (typeof value === 'number') {
          sum += value;
          count++;
          const avg = sum / count;
          graph.add(`avg:${name}`, "VALUE", avg);
          graph.add(`avg:${name}`, "COUNT", count);
          graph.add(`avg:${name}`, "SUM", sum);
        }
      });

      return `Average ${name} created`;
    };

    return "Aggregation patterns installed";
  };

  // ============================================================================
  // CASCADE PATTERNS - Rules triggering rules
  // ============================================================================

  patterns.cascades = () => {
    // Example: Evaluation cascade
    dsl.rule('mark-for-eval',
      '?expr', 'TYPE', 'EXPRESSION',
      '?expr', 'READY', 'true', '->',
      '?expr', 'NEEDS_EVAL', 'true'
    );

    dsl.rule('eval-expression',
      '?expr', 'NEEDS_EVAL', 'true', '->',
      '?expr', 'EVALUATING', 'true',
      '?expr', 'EVAL_START', Date.now().toString()
    );

    dsl.rule('complete-eval',
      '?expr', 'EVALUATING', 'true',
      '?expr', 'RESULT', '?result', '->',
      '?expr', 'EVALUATED', 'true',
      '?expr', 'NEEDS_EVAL', 'false'
    );

    return "Cascade patterns installed";
  };

  // Install all patterns
  patterns.installAll = () => {
    const results = [];
    for (const [name, installer] of Object.entries(patterns)) {
      if (name !== 'installAll') {
        try {
          results.push(installer());
        } catch (e) {
          results.push(`Failed to install ${name}: ${e.message}`);
        }
      }
    }
    return results;
  };

  return patterns;
}

/**
 * Common pattern specifications as data
 */
export const commonPatterns = {
  // Find all entities of a type
  byType: (type) => [["?entity", "TYPE?", type]],

  // Find entities with specific attribute
  withAttribute: (attr) => [["?entity", attr, "?value"]],

  // Find related entities
  related: (relation) => [["?source", relation, "?target"]],

  // Find entity properties
  properties: (entity) => [[entity, "?attr", "?value"]],

  // Find bidirectional relationships
  bidirectional: (relation) => [
    ["?a", relation, "?b"],
    ["?b", relation, "?a"]
  ],

  // Find transitive relationships (would need multiple patterns)
  transitive: (relation) => [
    ["?x", relation, "?y"],
    ["?y", relation, "?z"]
    // This gives us x->y->z chains
  ],

  // Find orphaned entities (no incoming edges)
  // This would need NOT support
  orphaned: () => [
    ["?entity", "?attr", "?value"]
    // AND NOT: ["?other", "?rel", "?entity"]
  ],

  // Find hubs (many outgoing edges)
  hubs: (threshold) => [
    ["?hub", "?rel1", "?target1"],
    ["?hub", "?rel2", "?target2"],
    ["?hub", "?rel3", "?target3"]
    // Would need aggregation to count properly
  ]
};

export default installCookbookPatterns;