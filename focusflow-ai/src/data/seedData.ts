import {
  Task,
  Habit,
  FocusSession,
  ProductivityLog,
  AppNotification,
  UserProfile,
  FixedCommitment,
  AIMessage,
} from '../types';

/**
 * A brand-new workspace starts completely empty: no demo tasks, habits,
 * sessions, logs, notifications or commitments. Only a neutral profile
 * (replaced by the Google account after sign-in) and a help message exist.
 */
export const INITIAL_USER_PROFILE: UserProfile = {
  userId: 'local_user',
  email: '',
  displayName: 'FocusFlow User',
  roleTitle: 'Professional',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  workStartHour: 9,
  workEndHour: 18,
  dailyFocusGoalMinutes: 180,
  mlConsent: true,
  notificationPrefs: {
    deadlines: true,
    overdue: true,
    dailyPlanning: true,
    habits: true,
    focus: true,
    conflicts: true,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_TASKS: Task[] = [];
export const INITIAL_FIXED_COMMITMENTS: FixedCommitment[] = [];
export const INITIAL_HABITS: Habit[] = [];
export const INITIAL_FOCUS_SESSIONS: FocusSession[] = [];
export const INITIAL_PRODUCTIVITY_LOGS: ProductivityLog[] = [];
export const INITIAL_NOTIFICATIONS: AppNotification[] = [];

export const INITIAL_AI_MESSAGES: AIMessage[] = [
  {
    id: 'msg_welcome',
    userId: 'local_user',
    conversationId: 'conv_main',
    role: 'assistant',
    content:
      'Welcome to **FocusFlow AI**. Add your first task and I will prioritize it, forecast its duration and plan your day.\n\nTry asking me:\n- *"Add a Python assignment due tomorrow"*\n- *"Plan my day"*\n- *"What should I work on next?"*\n- *"I have only 3 hours available today"*',
    createdAt: new Date().toISOString(),
  },
];
