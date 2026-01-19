-- Blemacs Command & Event System
-- Commands, keybindings, hooks, and scheduled tasks

-- Commands table: stores command metadata discovered from borth words
CREATE TABLE IF NOT EXISTS commands (
  name TEXT PRIMARY KEY,
  doc TEXT,
  key TEXT,                    -- keybinding string (Emacs format)
  menu TEXT,                   -- menu path like "File/Save"
  icon TEXT,                   -- icon identifier
  when_condition TEXT,         -- word name for visibility condition
  category TEXT,               -- grouping category
  source_file TEXT,            -- where defined (for user scripts)
  registered_at TEXT,          -- ISO timestamp
  enabled INTEGER DEFAULT 1    -- soft disable
);

CREATE INDEX IF NOT EXISTS idx_commands_key ON commands(key);
CREATE INDEX IF NOT EXISTS idx_commands_menu ON commands(menu);
CREATE INDEX IF NOT EXISTS idx_commands_category ON commands(category);

-- Keybindings table: for complex keybinding scenarios with conditions
CREATE TABLE IF NOT EXISTS keybindings (
  key TEXT PRIMARY KEY,        -- the key combo (Emacs format)
  command TEXT NOT NULL,       -- command name
  when_condition TEXT,         -- when this binding is active
  priority INTEGER DEFAULT 50, -- lower = higher priority
  source TEXT,                 -- 'builtin', 'user', 'extension'
  FOREIGN KEY (command) REFERENCES commands(name) ON DELETE CASCADE
);

-- Hooks table: event subscriptions
CREATE TABLE IF NOT EXISTS hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,         -- event name like "buffer:save"
  command TEXT NOT NULL,       -- command/word to execute
  priority INTEGER DEFAULT 50, -- lower runs first
  enabled INTEGER DEFAULT 1,
  run_async INTEGER DEFAULT 0, -- run in background?
  debounce_ms INTEGER,         -- debounce rapid events
  throttle_ms INTEGER,         -- throttle to max frequency
  source TEXT,                 -- 'builtin', 'user', 'extension'
  registered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hooks_event ON hooks(event);

-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,
  interval_ms INTEGER NOT NULL,  -- interval in milliseconds
  last_run TEXT,                 -- ISO timestamp
  next_run TEXT,                 -- ISO timestamp
  enabled INTEGER DEFAULT 1,
  run_on_start INTEGER DEFAULT 0, -- run immediately on app start?
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled(next_run);

-- Structured settings table (replaces simple key/value for typed settings)
CREATE TABLE IF NOT EXISTS blemacs_settings (
  name TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- string, number, boolean, choice, multi, path, color, keybinding
  default_value TEXT,              -- JSON encoded
  current_value TEXT,              -- JSON encoded
  constraints TEXT,                -- JSON: {min, max, choices, etc}
  category TEXT,
  doc TEXT,
  display_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_blemacs_settings_category ON blemacs_settings(category);
