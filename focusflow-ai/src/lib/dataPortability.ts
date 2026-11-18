import { Habit, PriorityLevel, RecurrencePattern, Subtask, Task, TaskCategory, TaskStatus } from '../types';

export const BACKUP_APP = 'focusflow-ai';
export const BACKUP_VERSION = 1;
const MAX_TASKS = 1000;
const MAX_HABITS = 200;

const CATEGORIES: TaskCategory[] = ['Engineering', 'Academic', 'Research', 'Design', 'Strategy', 'Admin', 'Personal'];
const PRIORITIES: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES: TaskStatus[] = ['Todo', 'In Progress', 'Completed', 'Archived'];
const RECURRENCES: RecurrencePattern[] = ['None', 'Daily', 'Weekly', 'Monthly'];

/** A task as stored in a backup: everything the ML engine recomputes is left out. */
export interface ImportableTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  tags: string[];
  priority: PriorityLevel;
  status: TaskStatus;
  deadline: string; // YYYY-MM-DD
  estimatedMinutes: number;
  actualMinutes?: number;
  recurrence: RecurrencePattern;
  dependencies: string[];
  subtasks: Subtask[];
  completedAt?: string;
}

export interface BackupPayload {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tasks: Task[];
  habits: Habit[];
}

export type ValidationResult =
  | { ok: true; tasks: ImportableTask[]; habits: Habit[] }
  | { ok: false; errors: string[] };

export const buildBackup = (tasks: Task[], habits: Habit[]): BackupPayload => ({
  app: BACKUP_APP,
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  tasks,
  habits,
});

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const validYmd = (s: string) => YMD.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const toYmd = (d: Date) => d.toISOString().slice(0, 10);
const isoOrUndef = (v: unknown) => (isStr(v) && !Number.isNaN(Date.parse(v)) ? v : undefined);

const oneOf = <T extends string>(v: unknown, list: T[]): v is T => isStr(v) && (list as string[]).includes(v);

/**
 * Validates every task and habit in a backup. Nothing is accepted unless all
 * entities pass, so a bad file can never half-overwrite the workspace.
 */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['The JSON must be an object like {"tasks":[...],"habits":[...]}.'] };

  const rawTasks = raw.tasks ?? [];
  const rawHabits = raw.habits ?? [];
  if (!Array.isArray(rawTasks)) errors.push('"tasks" must be an array.');
  if (!Array.isArray(rawHabits)) errors.push('"habits" must be an array.');
  if (errors.length) return { ok: false, errors };
  if (rawTasks.length === 0 && rawHabits.length === 0) {
    return { ok: false, errors: ['The file has no tasks or habits to import.'] };
  }
  if (rawTasks.length > MAX_TASKS) errors.push(`Too many tasks (${rawTasks.length}). The limit is ${MAX_TASKS}.`);
  if (rawHabits.length > MAX_HABITS) errors.push(`Too many habits (${rawHabits.length}). The limit is ${MAX_HABITS}.`);
  if (errors.length) return { ok: false, errors };

  const tasks: ImportableTask[] = [];
  rawTasks.forEach((t: unknown, i: number) => {
    const at = `tasks[${i}]`;
    if (!isObj(t)) return errors.push(`${at}: must be an object.`);
    const before = errors.length;

    if (!isStr(t.title) || !t.title.trim()) errors.push(`${at}.title: required text.`);
    else if (t.title.length > 200) errors.push(`${at}.title: max 200 characters.`);
    if (!oneOf(t.category, CATEGORIES)) errors.push(`${at}.category: must be one of ${CATEGORIES.join(', ')}.`);
    if (!oneOf(t.priority, PRIORITIES)) errors.push(`${at}.priority: must be one of ${PRIORITIES.join(', ')}.`);
    if (t.status !== undefined && !oneOf(t.status, STATUSES)) errors.push(`${at}.status: must be one of ${STATUSES.join(', ')}.`);
    if (t.recurrence !== undefined && !oneOf(t.recurrence, RECURRENCES)) errors.push(`${at}.recurrence: must be one of ${RECURRENCES.join(', ')}.`);

    const deadline = isStr(t.deadline) ? t.deadline.slice(0, 10) : '';
    if (!validYmd(deadline)) errors.push(`${at}.deadline: must be a date like 2026-12-31.`);

    if (typeof t.estimatedMinutes !== 'number' || !Number.isFinite(t.estimatedMinutes) || t.estimatedMinutes < 1 || t.estimatedMinutes > 1440)
      errors.push(`${at}.estimatedMinutes: must be a number from 1 to 1440.`);
    if (t.description !== undefined && (!isStr(t.description) || t.description.length > 2000))
      errors.push(`${at}.description: must be text up to 2000 characters.`);
    if (t.tags !== undefined && (!Array.isArray(t.tags) || t.tags.length > 10 || t.tags.some((x: unknown) => !isStr(x))))
      errors.push(`${at}.tags: must be a list of up to 10 text values.`);
    if (t.dependencies !== undefined && (!Array.isArray(t.dependencies) || t.dependencies.length > 10 || t.dependencies.some((x: unknown) => !isStr(x))))
      errors.push(`${at}.dependencies: must be a list of up to 10 task ids.`);
    if (t.actualMinutes !== undefined && (typeof t.actualMinutes !== 'number' || t.actualMinutes < 0))
      errors.push(`${at}.actualMinutes: must be a non-negative number.`);

    let subtasks: Subtask[] = [];
    if (t.subtasks !== undefined) {
      if (!Array.isArray(t.subtasks) || t.subtasks.length > 20) errors.push(`${at}.subtasks: must be a list of up to 20 items.`);
      else {
        t.subtasks.forEach((s: unknown, j: number) => {
          if (!isObj(s) || !isStr(s.title) || !s.title.trim()) errors.push(`${at}.subtasks[${j}]: needs a "title".`);
          else subtasks.push({ id: isStr(s.id) && s.id ? s.id : `sub_${i}_${j}`, title: s.title.slice(0, 200), completed: s.completed === true });
        });
      }
    }
    if (errors.length > before) return;

    const status: TaskStatus = t.status ?? 'Todo';
    tasks.push({
      id: isStr(t.id) && t.id ? t.id : `import_${i}`,
      title: t.title.trim(),
      description: t.description ?? '',
      category: t.category,
      tags: t.tags ?? [],
      priority: t.priority,
      status,
      deadline,
      estimatedMinutes: Math.round(t.estimatedMinutes),
      actualMinutes: t.actualMinutes,
      recurrence: t.recurrence ?? 'None',
      dependencies: t.dependencies ?? [],
      subtasks,
      completedAt: status === 'Completed' ? isoOrUndef(t.completedAt) ?? new Date().toISOString() : undefined,
    });
  });

  const habits: Habit[] = [];
  const nowIso = new Date().toISOString();
  rawHabits.forEach((h: unknown, i: number) => {
    const at = `habits[${i}]`;
    if (!isObj(h)) return errors.push(`${at}: must be an object.`);
    const before = errors.length;

    if (!isStr(h.title) || !h.title.trim()) errors.push(`${at}.title: required text.`);
    else if (h.title.length > 120) errors.push(`${at}.title: max 120 characters.`);
    if (h.category !== undefined && !isStr(h.category)) errors.push(`${at}.category: must be text.`);
    if (!oneOf(h.frequency, ['Daily', 'Weekly'])) errors.push(`${at}.frequency: must be Daily or Weekly.`);
    if (h.reminderTime !== undefined && !(isStr(h.reminderTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(h.reminderTime)))
      errors.push(`${at}.reminderTime: must be HH:MM, e.g. 08:30.`);
    if (h.targetCount !== undefined && (!Number.isInteger(h.targetCount) || h.targetCount < 1 || h.targetCount > 50))
      errors.push(`${at}.targetCount: must be a whole number from 1 to 50.`);
    if (h.completedDates !== undefined && (!Array.isArray(h.completedDates) || h.completedDates.some((d: unknown) => !isStr(d) || !validYmd(d))))
      errors.push(`${at}.completedDates: must be a list of dates like 2026-11-14.`);
    for (const k of ['currentStreak', 'longestStreak'] as const) {
      if (h[k] !== undefined && (!Number.isInteger(h[k]) || h[k] < 0)) errors.push(`${at}.${k}: must be a whole number, 0 or more.`);
    }
    if (errors.length > before) return;

    const completedDates: string[] = Array.from(new Set<string>(h.completedDates ?? [])).sort().reverse();
    const currentStreak = h.currentStreak ?? 0;
    habits.push({
      id: isStr(h.id) && h.id ? h.id : `import_h_${i}`,
      userId: '',
      title: h.title.trim(),
      category: h.category ?? 'General',
      frequency: h.frequency,
      targetCount: h.targetCount ?? (h.frequency === 'Daily' ? 1 : 4),
      reminderTime: h.reminderTime ?? '09:00',
      currentStreak,
      longestStreak: Math.max(h.longestStreak ?? 0, currentStreak),
      completedDates,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  });

  // Dependencies must point at tasks inside the same file.
  const ids = new Set(tasks.map((t) => t.id));
  tasks.forEach((t, i) => {
    t.dependencies.forEach((d) => {
      if (!ids.has(d)) errors.push(`tasks[${i}].dependencies: "${d}" is not a task in this file.`);
    });
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, tasks, habits };
}

/** Demo data anchored to today so deadlines and streaks always look current. */
export function buildDemoData(): { tasks: ImportableTask[]; habits: Habit[] } {
  const day = 86400000;
  const now = Date.now();
  const ymd = (offset: number) => toYmd(new Date(now + offset * day));
  const mk = (
    n: number,
    title: string,
    category: TaskCategory,
    priority: PriorityLevel,
    offset: number,
    estimatedMinutes: number,
    extra: Partial<ImportableTask> = {}
  ): ImportableTask => ({
    id: `demo_t${n}`,
    title,
    description: '',
    category,
    tags: [],
    priority,
    status: 'Todo',
    deadline: ymd(offset),
    estimatedMinutes,
    recurrence: 'None',
    dependencies: [],
    subtasks: [],
    ...extra,
  });

  const st = (n: number, title: string, completed = false) => ({ id: `demo_s${n}_${title.length}`, title, completed });
  const tasks: ImportableTask[] = [
    mk(1, 'Finish Python assignment', 'Academic', 'Critical', 1, 180, {
      tags: ['python', 'uni'],
      subtasks: [st(1, 'Solve questions 1-5', true), st(2, 'Write test cases'), st(3, 'Record explanation video')],
    }),
    mk(2, 'Prepare sprint review slides', 'Strategy', 'High', 2, 90, { status: 'In Progress', tags: ['meeting'] }),
    mk(3, 'Fix login page bug', 'Engineering', 'High', 3, 120, { tags: ['bug', 'frontend'] }),
    mk(4, 'Read research paper on transformers', 'Research', 'Medium', 5, 75, { tags: ['ml', 'reading'] }),
    mk(5, 'Redesign onboarding screens', 'Design', 'Medium', 7, 240, { tags: ['figma'] }),
    mk(6, 'Submit expense report', 'Admin', 'Low', 4, 30),
    mk(7, 'Plan weekend trip', 'Personal', 'Low', 6, 45),
    mk(8, 'Weekly review', 'Admin', 'Medium', -1, 40, {
      status: 'Completed',
      recurrence: 'Weekly',
      completedAt: new Date(now - day).toISOString(),
    }),
    mk(9, 'Database exam revision', 'Academic', 'Critical', 2, 210, {
      tags: ['exam', 'sql'],
      subtasks: [st(4, 'Normalization practice', true), st(5, 'Transactions & indexing'), st(6, 'Past paper')],
    }),
    mk(10, 'Write API documentation', 'Engineering', 'Medium', 8, 150, { tags: ['docs'] }),
    mk(11, 'Review pull requests', 'Engineering', 'High', 0, 60, { status: 'In Progress', recurrence: 'Daily' }),
    mk(12, 'Literature review draft', 'Research', 'High', 10, 300, { tags: ['thesis'] }),
    mk(13, 'Quarterly roadmap proposal', 'Strategy', 'High', 9, 180),
    mk(14, 'Competitor analysis summary', 'Strategy', 'Medium', 12, 120),
    mk(15, 'Create app icon variations', 'Design', 'Low', 11, 90, { tags: ['branding'] }),
    mk(16, 'Update portfolio website', 'Design', 'Medium', 14, 200),
    mk(17, 'Pay electricity bill', 'Admin', 'High', 1, 10, { tags: ['bills'] }),
    mk(18, 'Renew library membership', 'Admin', 'Low', 13, 15),
    mk(19, 'Book dentist appointment', 'Personal', 'Medium', 5, 15),
    mk(20, 'Grocery shopping', 'Personal', 'Low', 0, 60, { recurrence: 'Weekly' }),
    mk(21, 'Set up CI pipeline', 'Engineering', 'Medium', -2, 140, { status: 'Completed', completedAt: new Date(now - 2 * day).toISOString() }),
    mk(22, 'Team standup notes', 'Admin', 'Low', -1, 20, { status: 'Completed', recurrence: 'Daily', completedAt: new Date(now - day).toISOString() }),
    mk(23, 'Overdue: send project feedback', 'Strategy', 'High', -1, 45, { tags: ['overdue'] }),
    mk(24, 'Learn Docker basics', 'Engineering', 'Medium', 15, 180, { tags: ['devops'] }),
    mk(25, 'Prepare conference talk outline', 'Research', 'Medium', 18, 120),
  ];

  const nowIso = new Date().toISOString();
  const streakDates = (n: number) => Array.from({ length: n }, (_, i) => ymd(-i));
  const hab = (n: number, title: string, category: string, frequency: 'Daily' | 'Weekly', reminderTime: string, streak: number): Habit => ({
    id: `demo_h${n}`,
    userId: '',
    title,
    category,
    frequency,
    targetCount: frequency === 'Daily' ? 1 : 4,
    reminderTime,
    currentStreak: streak,
    longestStreak: streak + 3,
    completedDates: streakDates(streak),
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  const habits: Habit[] = [
    hab(1, 'Morning workout', 'Health', 'Daily', '07:00', 5),
    hab(2, 'Read 20 pages', 'Learning', 'Daily', '21:00', 3),
    hab(3, 'Meditate', 'Wellness', 'Daily', '06:30', 7),
    hab(4, 'Practice coding problems', 'Learning', 'Weekly', '19:00', 2),
    hab(5, 'Drink 2L of water', 'Health', 'Daily', '09:00', 0),
    hab(6, 'Journal before bed', 'Wellness', 'Daily', '22:00', 4),
    hab(7, 'Review flashcards', 'Learning', 'Daily', '18:00', 9),
    hab(8, 'Weekly planning session', 'Productivity', 'Weekly', '10:00', 3),
    hab(9, 'Evening walk', 'Health', 'Daily', '19:30', 2),
    hab(10, 'No phone first hour', 'Wellness', 'Daily', '07:00', 6),
  ];
    return { tasks, habits };
}
