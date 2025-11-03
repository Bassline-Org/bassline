/**
 * Bassline Query Explorer
 *
 * Interactive web interface for pattern matching queries
 */

import { Runtime } from "../../src/interactive-runtime.js";
import { formatResults } from "../../src/format-results.js";

// Initialize runtime
const runtime = new Runtime();

// DOM elements
const queryInput = document.getElementById("query-input");
const executeBtn = document.getElementById("execute-btn");
const clearBtn = document.getElementById("clear-btn");
const resultsContainer = document.getElementById("results-container");
const contextMenu = document.getElementById("context-menu");

// State
let currentClickedValue = null;

/**
 * Execute the input query/pattern
 */
function executeQuery() {
  const input = queryInput.value.trim();
  if (!input) return;

  try {
    const result = runtime.eval(input);
    displayResults(input, result);
  } catch (error) {
    displayError(error.message);
  }
}

/**
 * Display query results
 */
function displayResults(query, result) {
  // Clear empty state
  resultsContainer.innerHTML = "";

  // Create result block
  const resultBlock = document.createElement("div");
  resultBlock.className = "result-block";

  // Query header
  const queryHeader = document.createElement("div");
  queryHeader.className = "query-header";
  queryHeader.textContent = `> ${query}`;
  resultBlock.appendChild(queryHeader);

  // Results content
  const resultsContent = document.createElement("div");
  resultsContent.className = "results-content";

  if (!result || (Array.isArray(result) && result.length === 0)) {
    resultsContent.innerHTML = '<p class="no-results">No results</p>';
  } else if (Array.isArray(result)) {
    // Query results (array of bindings)
    resultsContent.appendChild(createResultsTable(result));
  } else {
    // Other results (formatted as text)
    const pre = document.createElement("pre");
    pre.textContent = formatResults(result);
    resultsContent.appendChild(pre);
  }

  resultBlock.appendChild(resultsContent);
  resultsContainer.appendChild(resultBlock);
}

/**
 * Create HTML table from query results (array of Bindings)
 */
function createResultsTable(bindings) {
  if (bindings.length === 0) {
    const p = document.createElement("p");
    p.className = "no-results";
    p.textContent = "No results";
    return p;
  }

  // Get all unique variable names across all bindings
  const variables = new Set();
  bindings.forEach((binding) => {
    binding.forEach((value, variable) => {
      variables.add(variable);
    });
  });

  const sortedVars = Array.from(variables).sort();

  // Create table
  const table = document.createElement("table");
  table.className = "results-table";

  // Create header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  sortedVars.forEach((variable) => {
    const th = document.createElement("th");
    th.textContent = variable;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement("tbody");
  bindings.forEach((binding) => {
    const row = document.createElement("tr");
    sortedVars.forEach((variable) => {
      const td = document.createElement("td");
      const value = binding.get(variable);

      if (value !== undefined) {
        td.textContent = formatValue(value);
        td.dataset.value = String(value);
        td.className = "cell-value";

        // Add right-click handler
        td.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showContextMenu(e, value);
        });
      } else {
        td.textContent = "-";
        td.className = "cell-empty";
      }

      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return table;
}

/**
 * Format a value for display
 */
function formatValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Show context menu for a cell value
 */
function showContextMenu(event, value) {
  currentClickedValue = value;

  contextMenu.style.left = `${event.pageX}px`;
  contextMenu.style.top = `${event.pageY}px`;
  contextMenu.classList.remove("hidden");
}

/**
 * Hide context menu
 */
function hideContextMenu() {
  contextMenu.classList.add("hidden");
  currentClickedValue = null;
}

/**
 * Handle context menu action
 */
function handleContextMenuAction(action) {
  if (!currentClickedValue) return;

  const value = currentClickedValue;
  let query = "";

  switch (action) {
    case "query-subject":
      // Query all facts where value is the subject
      query = `query [${formatValueForQuery(value)} ?attr ?val]`;
      break;
    case "query-object":
      // Query all facts where value is the object
      query = `query [?subj ?attr ${formatValueForQuery(value)}]`;
      break;
    case "copy-value":
      navigator.clipboard.writeText(String(value));
      hideContextMenu();
      return;
  }

  if (query) {
    queryInput.value = query;
    executeQuery();
  }

  hideContextMenu();
}

/**
 * Format value for use in query
 */
function formatValueForQuery(value) {
  if (typeof value === "string" && !value.startsWith("?")) {
    return value;
  }
  return String(value);
}

/**
 * Display error message
 */
function displayError(message) {
  resultsContainer.innerHTML = "";

  const errorBlock = document.createElement("div");
  errorBlock.className = "error-block";
  errorBlock.textContent = `Error: ${message}`;

  resultsContainer.appendChild(errorBlock);
}

/**
 * Clear all results
 */
function clearResults() {
  resultsContainer.innerHTML =
    '<p class="empty-state">No results yet. Execute a query to see results.</p>';
}

// Event listeners
executeBtn.addEventListener("click", executeQuery);
clearBtn.addEventListener("click", clearResults);

// Execute on Enter (with Shift+Enter for newline)
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    executeQuery();
  }
});

// Context menu event listeners
contextMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".context-menu-item");
  if (item) {
    const action = item.dataset.action;
    handleContextMenuAction(action);
  }
});

// Hide context menu on click outside
document.addEventListener("click", (e) => {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

// Example definitions - these are bootstrapped into the graph as facts
const EXAMPLES = [
  // Discovery
  {
    id: "ex-discovery-1",
    title: "✨ All Effects",
    query: "query [?e TYPE EFFECT!]",
    category: "discovery",
  },
  {
    id: "ex-discovery-2",
    title: "🔢 All Operations",
    query: "query [?op TYPE OPERATION!]",
    category: "discovery",
  },
  {
    id: "ex-discovery-3",
    title: "📋 All Rules",
    query: "query [?r TYPE RULE!]",
    category: "discovery",
  },
  {
    id: "ex-discovery-4",
    title: "🏷️  All Types",
    query: "query [?t TYPE TYPE!]",
    category: "discovery",
  },

  // Exploration
  {
    id: "ex-explore-1",
    title: "📊 All Facts",
    query: "query [?s ?a ?v]",
    category: "exploration",
  },
  {
    id: "ex-explore-2",
    title: "🔍 Find by Subject",
    query: "query [alice ?attr ?value]",
    category: "exploration",
  },
  {
    id: "ex-explore-3",
    title: "📈 Effect Results",
    query: "query [?e { result ?r status ?s}]",
    category: "exploration",
  },

  // System
  {
    id: "ex-system-1",
    title: "ℹ️  Effect Docs",
    query: "query [LOG DOCS ?doc]",
    category: "system",
  },
  {
    id: "ex-system-2",
    title: "📦 HTTP Effects",
    query: "query [?e CATEGORY http]",
    category: "system",
  },
  {
    id: "ex-system-3",
    title: "🎯 Aggregations",
    query: "query [?agg TYPE AGGREGATION!]",
    category: "system",
  },
];

/**
 * Bootstrap Examples as Facts (including queries)
 */
function bootstrapExamples() {
  EXAMPLES.forEach((ex) => {
    // Store all metadata in graph, including queries
    runtime.eval(`fact [${ex.id} TYPE example!]`);
    runtime.eval(`fact [${ex.id} title "${ex.title}"]`);
    runtime.eval(`fact [${ex.id} category "${ex.category}"]`);
    runtime.eval(`fact [${ex.id} query "${ex.query}"]`);
  });
}

/**
 * Render sidebar section with items
 */
function renderSidebarSection(containerId, title, items, clickHandler) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No items</p>';
    return;
  }

  items.forEach((item) => {
    const itemEl = document.createElement("div");
    itemEl.className = "sidebar-item";
    itemEl.textContent = item;
    itemEl.addEventListener("click", () => clickHandler(item));
    container.appendChild(itemEl);
  });
}

/**
 * Populate Discovery Section
 */
function populateDiscoverySection() {
  // Query for effects, operations, rules, types
  const effects = runtime.eval("query [?e TYPE EFFECT!]");
  const operations = runtime.eval("query [?op TYPE OPERATION!]");
  const rules = runtime.eval("query [?r TYPE RULE!]");
  const types = runtime.eval("query [?t TYPE TYPE!]");

  const discoveryContainer = document.getElementById("discovery-section");
  discoveryContainer.innerHTML = "";

  // Create collapsible subsections
  const sections = [
    { title: "Effects", items: effects, icon: "✨" },
    { title: "Operations", items: operations, icon: "🔢" },
    { title: "Rules", items: rules, icon: "📋" },
    { title: "Types", items: types, icon: "🏷️" },
  ];

  sections.forEach((section) => {
    if (!section.items || section.items.length === 0) return;

    const subsection = document.createElement("div");
    subsection.className = "sidebar-subsection";

    const header = document.createElement("div");
    header.className = "sidebar-subsection-header";
    header.textContent =
      `${section.icon} ${section.title} (${section.items.length})`;
    subsection.appendChild(header);

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "sidebar-subsection-items";

    section.items.forEach((binding) => {
      const value = binding.get(Object.keys(Object.fromEntries(binding))[0]);
      const item = document.createElement("div");
      item.className = "sidebar-item";
      item.textContent = String(value);
      item.addEventListener("click", () => {
        queryInput.value = `query [${value} ?attr ?value]`;
        executeQuery();
      });
      itemsContainer.appendChild(item);
    });

    subsection.appendChild(itemsContainer);
    discoveryContainer.appendChild(subsection);
  });
}

/**
 * Populate Examples Section
 */
function populateExamplesSection() {
  const examples = runtime.eval(
    "query [?ex { TYPE example! title ?t query ?q}]",
  );

  const examplesContainer = document.getElementById("examples-section");
  examplesContainer.innerHTML = "";

  if (!examples || examples.length === 0) {
    examplesContainer.innerHTML = '<p class="sidebar-empty">No examples</p>';
    return;
  }

  examples.forEach((binding) => {
    const title = binding.get("?T"); // Variables are uppercased
    const query = binding.get("?Q"); // Variables are uppercased

    const exampleCard = document.createElement("div");
    exampleCard.className = "example-card";
    exampleCard.textContent = title;
    exampleCard.addEventListener("click", () => {
      queryInput.value = query; // Use query from graph
      executeQuery();
    });
    examplesContainer.appendChild(exampleCard);
  });
}

/**
 * Populate System Section
 */
function populateSystemSection() {
  // Get system stats
  const allFacts = runtime.eval("query [?s ?a ?v]");
  const edgeCount = allFacts ? allFacts.length : 0;

  const rules = runtime.eval("query [?r TYPE RULE!]");
  const ruleCount = rules ? rules.length : 0;

  const effects = runtime.eval("query [?e TYPE EFFECT!]");
  const effectCount = effects ? effects.length : 0;

  const systemContainer = document.getElementById("system-section");
  systemContainer.innerHTML = `
    <div class="system-stat">
      <span class="stat-label">Edges:</span>
      <span class="stat-value">${edgeCount}</span>
    </div>
    <div class="system-stat">
      <span class="stat-label">Rules:</span>
      <span class="stat-value">${ruleCount}</span>
    </div>
    <div class="system-stat">
      <span class="stat-label">Effects:</span>
      <span class="stat-value">${effectCount}</span>
    </div>
  `;
}

/**
 * Setup watchers for live updates
 */
function setupWatchers() {
  // Watch for new effects
  runtime.graph.watch([["?e", "TYPE", "EFFECT!"]], () => {
    populateDiscoverySection();
    populateSystemSection();
  });

  // Watch for new rules
  runtime.graph.watch([["?r", "TYPE", "RULE!"]], () => {
    populateDiscoverySection();
    populateSystemSection();
  });

  // Watch for new examples
  runtime.graph.watch([["?ex", "TYPE", "example!"]], () => {
    populateExamplesSection();
  });
}

/**
 * Initialize the sidebar
 */
function initializeSidebar() {
  bootstrapExamples();
  populateDiscoverySection();
  populateExamplesSection();
  populateSystemSection();
  setupWatchers();
}

// Load some example data on startup
runtime.eval("fact [alice likes bob]");
runtime.eval("fact [bob likes carol]");
runtime.eval("fact [alice age 30]");
runtime.eval("fact [bob age 25]");
runtime.eval("fact [carol age 28]");

// Initialize sidebar
initializeSidebar();

console.log("Bassline Query Explorer loaded");
console.log("Try: query [?x likes ?y]");
