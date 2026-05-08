-- NEXUS Database Schema

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog', -- backlog, todo, in_progress, done
  priority TEXT DEFAULT 'P2',   -- P1, P2, P3
  tags TEXT DEFAULT '',
  deadline TEXT,
  estimated_pomodoros INTEGER DEFAULT 1,
  completed_pomodoros INTEGER DEFAULT 0,
  project TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '✓',
  color TEXT DEFAULT '#00f5ff',
  type TEXT DEFAULT 'binary',  -- binary or quantified
  target_value REAL DEFAULT 1,
  unit TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  value REAL DEFAULT 1,
  done INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(habit_id, date)
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER REFERENCES tasks(id),
  mode TEXT DEFAULT '',
  duration_minutes INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  completed INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,  -- user, assistant
  content TEXT NOT NULL,
  model TEXT DEFAULT '',
  is_local INTEGER DEFAULT 0,
  tools_used TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mode_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode_id TEXT NOT NULL,
  activated_at TEXT DEFAULT (datetime('now')),
  deactivated_at TEXT,
  duration_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS daily_focus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
  focus_text TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  hour INTEGER NOT NULL, -- 0-23
  activity_type TEXT NOT NULL, -- focus, task_complete, habit, mode_change
  value REAL DEFAULT 1,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (date('now')),
  amount INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏆',
  earned_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mode_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode_id TEXT NOT NULL UNIQUE,
  start_hour INTEGER NOT NULL,
  end_hour INTEGER NOT NULL,
  days TEXT DEFAULT '1,2,3,4,5',
  enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS memory (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (date('now')),
  summary TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Default habits
INSERT OR IGNORE INTO habits (id, name, icon, color, type) VALUES
  (1, 'Boire 2L d''eau', '💧', '#00f5ff', 'binary'),
  (2, '30 min de sport', '💪', '#39ff14', 'binary'),
  (3, '30 min de lecture', '📚', '#b026ff', 'binary'),
  (4, 'Pas de réseaux avant midi', '🚫', '#ff006e', 'binary'),
  (5, 'Méditation 10 min', '🧘', '#ffd60a', 'binary'),
  (6, 'Coucher avant minuit', '🌙', '#94a3b8', 'binary');
