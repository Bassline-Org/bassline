# Bassline Query Explorer

Interactive web interface for visualizing and exploring Bassline pattern matching queries.

## Features

- **Query Input** - Text area for entering facts, queries, and rules
- **Table View** - Query results displayed in interactive tables
- **Right-Click Actions** - Context menu on table cells to:
  - Query all facts about a value (as subject)
  - Query all facts with a value (as object)
  - Copy value to clipboard
- **Real-time Execution** - Execute queries with Enter key or Execute button
- **Example Data** - Preloaded with sample facts for exploration

## Running

Since this uses ES modules, you need a local web server. You can use any of these:

### Option 1: npm script (recommended)
```bash
npm run web-example
# Opens: http://localhost:8000/examples/web/
```

### Option 2: Direct Node.js
```bash
node examples/web/server.js
# Opens: http://localhost:8000/examples/web/
```

### Option 3: VS Code Live Server
Install the "Live Server" extension and right-click `index.html` → "Open with Live Server"

## Usage

1. **Execute Queries**:
   - Type a query in the input area
   - Press Enter or click "Execute"
   - Results appear in the table view

2. **Interactive Exploration**:
   - Right-click any cell value in the results table
   - Select "Query as subject" to find all facts about that value
   - Select "Query as object" to find all facts pointing to that value
   - New query is automatically populated and executed

3. **Example Queries**:
   ```
   query [?x likes ?y]
   query [alice ?attr ?value]
   fact [dave likes eve]
   rule FRIENDS [?x likes ?y] [?y likes ?x] -> [?x friends-with ?y]
   ```

## Architecture

- **app.js** - Main application logic, Runtime integration, table rendering
- **index.html** - UI structure
- **style.css** - Visual styling

The app imports the Runtime directly from `../../src/interactive-runtime.js`, demonstrating how to use Bassline in browser environments.

## Browser Compatibility

Works with all core Bassline features including:
- Pattern matching and queries
- Rules and watchers
- Effects (LOG, HTTP_GET, HTTP_POST)

Note: Filesystem effects (READ_FILE, WRITE_FILE) are not available in the browser.
