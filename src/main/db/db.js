const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const dataDir = app.getPath('userData');
  return path.join(dataDir, 'nexus.db');
}

function initDB() {
  try {
    const Database = require('better-sqlite3');
    const dbPath = getDbPath();
    const schemaPath = path.join(__dirname, 'schema.sql');

    db = new Database(dbPath, { verbose: null });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    console.log('[DB] SQLite initialized at:', dbPath);
    return db;
  } catch (err) {
    console.error('[DB] Init error:', err);
    // Use in-memory fallback
    const Database = require('better-sqlite3');
    db = new Database(':memory:');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema);
    return db;
  }
}

function getDB() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// === TASKS ===

function getTasks(filters = {}) {
  const d = getDB();
  let query = 'SELECT * FROM tasks';
  const conditions = [];
  const params = [];

  if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }
  if (filters.priority) { conditions.push('priority = ?'); params.push(filters.priority); }
  if (filters.project) { conditions.push('project = ?'); params.push(filters.project); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += " ORDER BY CASE priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END, created_at DESC";

  const tasks = d.prepare(query).all(...params);

  // Attach subtasks
  const subtaskStmt = d.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id');
  return tasks.map(t => ({
    ...t,
    subtasks: subtaskStmt.all(t.id),
    tags: t.tags ? t.tags.split(',').filter(Boolean) : [],
  }));
}

function createTask(task) {
  const d = getDB();
  const stmt = d.prepare(`
    INSERT INTO tasks (title, description, status, priority, tags, deadline, project, estimated_pomodoros)
    VALUES (@title, @description, @status, @priority, @tags, @deadline, @project, @estimated_pomodoros)
  `);
  const result = stmt.run({
    title: task.title,
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'P2',
    tags: Array.isArray(task.tags) ? task.tags.join(',') : (task.tags || ''),
    deadline: task.deadline || null,
    project: task.project || '',
    estimated_pomodoros: task.estimated_pomodoros || 1,
  });
  return { id: result.lastInsertRowid, ...task };
}

function updateTask(task) {
  const d = getDB();
  const updates = [];
  const params = {};

  const fields = ['title', 'description', 'status', 'priority', 'tags', 'deadline', 'project'];
  for (const field of fields) {
    if (task[field] !== undefined) {
      updates.push(`${field} = @${field}`);
      params[field] = field === 'tags' && Array.isArray(task[field]) ? task[field].join(',') : task[field];
    }
  }

  if (task.status === 'done' && !task.completed_at) {
    updates.push('completed_at = datetime("now")');
  }

  updates.push('updated_at = datetime("now")');
  params.id = task.id;

  d.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = @id`).run(params);
  return { success: true };
}

function deleteTask(id) {
  getDB().prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return { success: true };
}

// === HABITS ===

function getHabits() {
  const d = getDB();
  const today = new Date().toISOString().split('T')[0];
  const habits = d.prepare('SELECT * FROM habits WHERE active = 1 ORDER BY id').all();

  const entryStmt = d.prepare('SELECT * FROM habit_entries WHERE habit_id = ? AND date = ?');
  const streakStmt = d.prepare(`
    SELECT COUNT(*) as streak FROM habit_entries
    WHERE habit_id = ? AND done = 1 AND date >= date('now', '-30 days')
    ORDER BY date DESC
  `);

  return habits.map(h => {
    const todayEntry = entryStmt.get(h.id, today);
    const streakData = streakStmt.get(h.id);
    return {
      ...h,
      todayDone: todayEntry?.done === 1,
      todayValue: todayEntry?.value || 0,
      streak: streakData?.streak || 0,
    };
  });
}

function createHabit(habit) {
  const d = getDB();
  const result = d.prepare(`
    INSERT INTO habits (name, description, icon, color, type, target_value, unit)
    VALUES (@name, @description, @icon, @color, @type, @target_value, @unit)
  `).run({
    name: habit.name,
    description: habit.description || '',
    icon: habit.icon || '✓',
    color: habit.color || '#00f5ff',
    type: habit.type || 'binary',
    target_value: habit.target_value || 1,
    unit: habit.unit || '',
  });
  return { id: result.lastInsertRowid, ...habit };
}

function toggleHabitEntry(habitId, date) {
  const d = getDB();
  const existing = d.prepare('SELECT * FROM habit_entries WHERE habit_id = ? AND date = ?').get(habitId, date);

  if (existing) {
    const newDone = existing.done === 1 ? 0 : 1;
    d.prepare('UPDATE habit_entries SET done = ? WHERE habit_id = ? AND date = ?').run(newDone, habitId, date);
    return { done: newDone === 1 };
  } else {
    d.prepare('INSERT INTO habit_entries (habit_id, date, done, value) VALUES (?, ?, 1, 1)').run(habitId, date);
    return { done: true };
  }
}

function getHabitHeatmap(habitId, year) {
  const d = getDB();
  const entries = d.prepare(`
    SELECT date, done, value FROM habit_entries
    WHERE habit_id = ? AND date LIKE '${year}%'
    ORDER BY date
  `).all(habitId);
  return entries;
}

// === MESSAGES ===

function getChatHistory(limit = 50) {
  return getDB()
    .prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ?')
    .all(limit)
    .reverse();
}

function saveMessage(message) {
  const result = getDB().prepare(`
    INSERT INTO messages (role, content, model, is_local, tools_used)
    VALUES (@role, @content, @model, @is_local, @tools_used)
  `).run({
    role: message.role,
    content: message.content,
    model: message.model || '',
    is_local: message.isLocal ? 1 : 0,
    tools_used: JSON.stringify(message.toolsUsed || []),
  });
  return { id: result.lastInsertRowid };
}

// === STATS ===

function getStats(period = 'week') {
  const d = getDB();
  const dateFilter = period === 'week' ? "date >= date('now', '-7 days')"
    : period === 'month' ? "date >= date('now', '-30 days')"
    : "date >= date('now', '-1 day')";

  const focusHours = d.prepare(`
    SELECT SUM(duration_minutes) / 60.0 as hours, date(started_at) as date
    FROM pomodoro_sessions
    WHERE completed = 1 AND ${dateFilter.replace('date', 'date(started_at)')}
    GROUP BY date(started_at)
  `).all();

  const tasksDone = d.prepare(`
    SELECT COUNT(*) as count, date(completed_at) as date
    FROM tasks WHERE status = 'done' AND ${dateFilter.replace('date', 'date(completed_at)')}
    GROUP BY date(completed_at)
  `).all();

  const habitsCompleted = d.prepare(`
    SELECT COUNT(*) as count, date FROM habit_entries
    WHERE done = 1 AND ${dateFilter}
    GROUP BY date
  `).all();

  const pomodorosDone = d.prepare(`
    SELECT COUNT(*) as count FROM pomodoro_sessions
    WHERE completed = 1 AND ${dateFilter.replace('date', 'date(started_at)')}
  `).get();

  const pomodorosByDay = d.prepare(`
    SELECT COUNT(*) as count, date(started_at) as date
    FROM pomodoro_sessions
    WHERE completed = 1 AND ${dateFilter.replace('date', 'date(started_at)')}
    GROUP BY date(started_at)
  `).all();

  return { focusHours, tasksDone, habitsCompleted, pomodorosDone, pomodorosByDay };
}

function logFocusSession(minutes, taskId = null, mode = '') {
  const now = new Date().toISOString();
  const result = getDB().prepare(`
    INSERT INTO pomodoro_sessions (task_id, mode, duration_minutes, started_at, completed_at, completed)
    VALUES (?, ?, ?, datetime('now', ?), ?, 1)
  `).run(taskId, mode, minutes, `-${minutes} minutes`, now);
  return { id: result.lastInsertRowid };
}

// === PRODUCTIVITY SCORE ===

function getProductivityScore() {
  const d = getDB();
  const today = new Date().toISOString().split('T')[0];

  const focusToday = d.prepare(`
    SELECT SUM(duration_minutes) as total FROM pomodoro_sessions
    WHERE completed = 1 AND date(started_at) = ?
  `).get(today);

  const tasksToday = d.prepare(`
    SELECT COUNT(*) as done FROM tasks WHERE status = 'done' AND date(completed_at) = ?
  `).get(today);

  const habitsToday = d.prepare(`
    SELECT COUNT(*) as done FROM habit_entries WHERE done = 1 AND date = ?
  `).get(today);

  const totalHabits = d.prepare('SELECT COUNT(*) as total FROM habits WHERE active = 1').get();

  const focusScore = Math.min(100, ((focusToday?.total || 0) / 240) * 100) * 0.30;
  const taskScore = Math.min(100, ((tasksToday?.done || 0) / 5) * 100) * 0.25;
  const habitScore = totalHabits?.total > 0
    ? ((habitsToday?.done || 0) / totalHabits.total) * 100 * 0.20
    : 0;

  const total = Math.round(focusScore + taskScore + habitScore);
  return { score: Math.min(100, total), focusMinutes: focusToday?.total || 0, tasksDone: tasksToday?.done || 0, habitsDone: habitsToday?.done || 0 };
}

// === XP / GAMIFICATION ===

function addXP(amount, reason = '') {
  const d = getDB();
  d.prepare('INSERT INTO xp_log (amount, reason) VALUES (?, ?)').run(amount, reason);
  return getXPTotal();
}

function getXPTotal() {
  const d = getDB();
  const row = d.prepare('SELECT SUM(amount) as total FROM xp_log').get();
  const total = row?.total || 0;
  const level = Math.floor(Math.sqrt(total / 100)) + 1;
  const xpForCurrentLevel = (level - 1) * (level - 1) * 100;
  const xpForNextLevel = level * level * 100;
  return {
    total,
    level,
    xpInLevel: total - xpForCurrentLevel,
    xpNeeded: xpForNextLevel - xpForCurrentLevel,
    progress: Math.round(((total - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100),
  };
}

function getXPToday() {
  const d = getDB();
  const today = new Date().toISOString().split('T')[0];
  const row = d.prepare("SELECT SUM(amount) as total FROM xp_log WHERE date = ?").get(today);
  return row?.total || 0;
}

// === BADGES ===

const BADGE_DEFINITIONS = {
  first_task:      { name: 'Première tâche',   description: 'Créer sa première tâche',     icon: '📋' },
  task_10:         { name: 'Productif',         description: '10 tâches complétées',         icon: '✅' },
  task_50:         { name: 'Machine',           description: '50 tâches complétées',         icon: '⚡' },
  task_100:        { name: 'Légende',           description: '100 tâches complétées',        icon: '👑' },
  first_pomodoro:  { name: 'Premier Focus',     description: 'Premier pomodoro complété',    icon: '🍅' },
  pomodoro_10:     { name: 'Focalisé',          description: '10 pomodoros complétés',       icon: '🎯' },
  pomodoro_50:     { name: 'Focus Elite',       description: '50 pomodoros complétés',       icon: '🏆' },
  habit_streak_3:  { name: 'Habitude prise',    description: '3 jours consécutifs',          icon: '🔥' },
  habit_streak_7:  { name: 'Semaine parfaite',  description: '7 jours consécutifs',          icon: '🌟' },
  habit_streak_30: { name: 'Mois de feu',       description: '30 jours consécutifs',         icon: '💥' },
  early_bird:      { name: 'Lève-tôt',          description: 'Pomodoro avant 8h',            icon: '🌅' },
  night_owl:       { name: 'Hibou',             description: 'Travail après 22h',            icon: '🦉' },
  level_5:         { name: 'Vétéran',           description: 'Atteindre le niveau 5',        icon: '🎖️' },
  level_10:        { name: 'Expert',            description: 'Atteindre le niveau 10',       icon: '💎' },
  level_20:        { name: 'Maître',            description: 'Atteindre le niveau 20',       icon: '🔮' },
};

function getBadges() {
  const d = getDB();
  const earned = d.prepare('SELECT * FROM badges ORDER BY earned_at DESC').all();
  return {
    earned,
    all: Object.entries(BADGE_DEFINITIONS).map(([id, def]) => {
      const earnedEntry = earned.find(b => b.id === id);
      return { id, ...def, earned: !!earnedEntry, earnedAt: earnedEntry?.earned_at || null };
    }),
  };
}

function awardBadge(id) {
  const def = BADGE_DEFINITIONS[id];
  if (!def) return { error: 'unknown' };
  const d = getDB();
  const existing = d.prepare('SELECT id FROM badges WHERE id = ?').get(id);
  if (existing) return { alreadyEarned: true };
  d.prepare('INSERT OR IGNORE INTO badges (id, name, description, icon) VALUES (?, ?, ?, ?)').run(id, def.name, def.description, def.icon);
  return { newBadge: true, badge: { id, ...def } };
}

function checkAndAwardBadges(trigger) {
  const d = getDB();
  const newBadges = [];
  const award = (id) => {
    const r = awardBadge(id);
    if (r.newBadge) newBadges.push(r.badge);
  };

  if (trigger === 'task_created' || trigger === 'task_done') {
    const total = d.prepare("SELECT COUNT(*) as c FROM tasks").get();
    if (total.c >= 1) award('first_task');
    const done = d.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'done'").get();
    if (done.c >= 10) award('task_10');
    if (done.c >= 50) award('task_50');
    if (done.c >= 100) award('task_100');
  }

  if (trigger === 'pomodoro_done') {
    const count = d.prepare('SELECT COUNT(*) as c FROM pomodoro_sessions WHERE completed = 1').get();
    if (count.c >= 1) award('first_pomodoro');
    if (count.c >= 10) award('pomodoro_10');
    if (count.c >= 50) award('pomodoro_50');
    const hour = new Date().getHours();
    if (hour < 8) award('early_bird');
    if (hour >= 22) award('night_owl');
  }

  if (trigger === 'habit_done') {
    const habits = d.prepare('SELECT id FROM habits WHERE active = 1').all();
    for (const h of habits) {
      const streak = d.prepare(`SELECT COUNT(*) as c FROM habit_entries WHERE habit_id = ? AND done = 1 AND date >= date('now', '-30 days')`).get(h.id);
      if ((streak?.c || 0) >= 3) award('habit_streak_3');
      if ((streak?.c || 0) >= 7) award('habit_streak_7');
      if ((streak?.c || 0) >= 30) award('habit_streak_30');
    }
  }

  if (trigger === 'xp_gained') {
    const xp = getXPTotal();
    if (xp.level >= 5) award('level_5');
    if (xp.level >= 10) award('level_10');
    if (xp.level >= 20) award('level_20');
  }

  return newBadges;
}

// === MEMORY ===

function saveMemory(key, value) {
  getDB().prepare('INSERT OR REPLACE INTO memory (key, value, updated_at) VALUES (?, ?, datetime("now"))').run(key, JSON.stringify(value));
  return { success: true };
}

function getMemory(key) {
  const row = getDB().prepare('SELECT value FROM memory WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

function getAllMemories() {
  return getDB().prepare('SELECT key, value, updated_at FROM memory ORDER BY updated_at DESC').all()
    .map(r => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updated_at }));
}

function deleteMemory(key) {
  getDB().prepare('DELETE FROM memory WHERE key = ?').run(key);
  return { success: true };
}

function saveConversationSummary(summary) {
  getDB().prepare('INSERT INTO conversation_summaries (summary) VALUES (?)').run(summary);
  return { success: true };
}

function getRecentSummaries(limit = 5) {
  return getDB().prepare('SELECT * FROM conversation_summaries ORDER BY created_at DESC LIMIT ?').all(limit).reverse();
}

// === MODE SCHEDULES ===

function getModeSchedules() {
  return getDB().prepare('SELECT * FROM mode_schedules ORDER BY start_hour').all();
}

function saveModeSchedule(modeId, startHour, endHour, days, enabled) {
  const d = getDB();
  const existing = d.prepare('SELECT id FROM mode_schedules WHERE mode_id = ?').get(modeId);
  if (existing) {
    d.prepare('UPDATE mode_schedules SET start_hour=?, end_hour=?, days=?, enabled=? WHERE mode_id=?')
      .run(startHour, endHour, days || '1,2,3,4,5', enabled ? 1 : 0, modeId);
    return { updated: true };
  } else {
    d.prepare('INSERT INTO mode_schedules (mode_id, start_hour, end_hour, days, enabled) VALUES (?,?,?,?,?)')
      .run(modeId, startHour, endHour, days || '1,2,3,4,5', enabled ? 1 : 0);
    return { created: true };
  }
}

function deleteModeSchedule(modeId) {
  getDB().prepare('DELETE FROM mode_schedules WHERE mode_id = ?').run(modeId);
  return { success: true };
}

module.exports = {
  initDB, getDB,
  getTasks, createTask, updateTask, deleteTask,
  getHabits, createHabit, toggleHabitEntry, getHabitHeatmap,
  getChatHistory, saveMessage,
  getStats, logFocusSession,
  getProductivityScore,
  addXP, getXPTotal, getXPToday,
  getBadges, awardBadge, checkAndAwardBadges,
  saveMemory, getMemory, getAllMemories, deleteMemory,
  saveConversationSummary, getRecentSummaries,
  getModeSchedules, saveModeSchedule, deleteModeSchedule,
};
