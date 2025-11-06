/**
 * Result Formatting
 *
 * Format results from executeProgram for display
 */

/**
 * Format results for display
 * @param {*} results - Results from Runtime.eval()
 * @returns {string} Formatted string for display
 */
export function formatResults(results) {
  // Handle null/undefined
  if (results === null || results === undefined) {
    return "(no results)";
  }

  // Handle single string result (e.g., from delete command)
  if (typeof results === 'string') {
    return results;
  }

  // Handle empty array
  if (Array.isArray(results) && results.length === 0) {
    return "(no results)";
  }

  // Handle non-array results
  if (!Array.isArray(results)) {
    // Single object result (e.g., graph-info, watch)
    if (typeof results === 'object' && results !== null) {
      if (results.unwatch && typeof results.unwatch === 'function') {
        return `Watch registered`;
      }
      return JSON.stringify(results, null, 2);
    }
    // Fallback for other single values
    return String(results);
  }

  // At this point, results is a non-empty array
  const first = results[0];

  // Array of Maps (query results - variable bindings)
  if (first instanceof Map) {
    return formatBindings(results);
  }

  // Array of numbers (fact command - edge IDs - legacy)
  if (typeof first === 'number') {
    return `Added ${results.length} edge(s): ${results.join(', ')}`;
  }

  // Array of strings (could be contexts from fact command, rule/pattern names, or status messages)
  if (typeof first === 'string') {
    // Check if this looks like an array of contexts (fact command results)
    // Contexts can be explicit (user-provided) or auto-generated (edge:uuid)
    const looksLikeContexts = results.every(r =>
      typeof r === 'string' && (r.startsWith('edge:') || r.length > 0)
    );

    // If all elements look like contexts and there are multiple, format as edge results
    if (looksLikeContexts && results.length > 0) {
      return `Added ${results.length} edge(s): ${results.join(', ')}`;
    }

    // Otherwise just join as strings (rule names, etc.)
    return results.join(', ');
  }

  // Array of objects (graph-info results, or watch objects)
  if (typeof first === 'object' && first !== null) {
    // Handle watch objects specially
    if (first.unwatch && typeof first.unwatch === 'function') {
      return `Watch ${results.length > 1 ? 'es' : ''} registered`;
    }
    // Format as JSON
    return JSON.stringify(results, null, 2);
  }

  // Fallback
  return String(results);
}

/**
 * Format query bindings as a table
 * @param {Array<Map>} bindings - Array of variable binding Maps
 * @returns {string} Formatted table
 */
function formatBindings(bindings) {
  if (bindings.length === 0) {
    return "(no matches)";
  }

  // Extract all variables from all bindings
  const variables = new Set();
  bindings.forEach(b => {
    for (const key of b.keys()) {
      variables.add(key);
    }
  });

  const vars = Array.from(variables).sort();

  // If there are no variables, show the matched edges as a table
  // (This happens with queries like: query [alice age 30] or [* * *])
  if (vars.length === 0) {
    // Collect all edges from all bindings
    const allEdges = [];
    bindings.forEach(b => {
      if (b.__edges__) {
        allEdges.push(...b.__edges__);
      }
    });
    if (allEdges.length > 0) {
      return formatEdges(allEdges);
    }
    return `${bindings.length} match${bindings.length !== 1 ? 'es' : ''}`;
  }

  // Convert to rows
  const rows = bindings.map(b => {
    const row = {};
    vars.forEach(v => {
      row[v] = b.has(v) ? formatValue(b.get(v)) : '';
    });
    return row;
  });

  // Format as table
  return formatTable(vars, rows);
}

/**
 * Format a single value for display
 * @param {*} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/**
 * Format data as ASCII table
 * @param {Array<string>} headers - Column headers
 * @param {Array<Object>} rows - Row data
 * @returns {string} ASCII table
 */
function formatTable(headers, rows) {
  if (rows.length === 0) return '(no rows)';

  // Calculate column widths
  const widths = headers.map(h => h.length);
  rows.forEach(row => {
    headers.forEach((h, i) => {
      const val = row[h] || '';
      widths[i] = Math.max(widths[i], String(val).length);
    });
  });

  // Build table
  const lines = [];

  // Header row
  const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(' | ');
  lines.push(headerRow);

  // Separator
  const separator = headers.map((h, i) => '-'.repeat(widths[i])).join('-+-');
  lines.push(separator);

  // Data rows
  rows.forEach(row => {
    const rowStr = headers.map((h, i) => {
      const val = row[h] || '';
      return String(val).padEnd(widths[i]);
    }).join(' | ');
    lines.push(rowStr);
  });

  return lines.join('\n');
}

/**
 * Format edges for display
 * @param {Array<Object>} edges - Array of edge objects
 * @returns {string} Formatted edges
 */
export function formatEdges(edges) {
  if (!edges || edges.length === 0) {
    return "(no edges)";
  }

  const headers = ['source', 'attribute', 'target'];
  const rows = edges.map(e => ({
    source: formatValue(e.source),
    attribute: formatValue(e.attr),
    target: formatValue(e.target)
  }));

  return formatTable(headers, rows);
}
