export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Todo' | 'In Progress' | 'Completed' | 'Archived';
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';
export type RecurrencePattern = 'None' | 'Daily' | 'Weekly' | 'Monthly';
export type TaskCategory = 'Engineering' | 'Academic' | 'Research' | 'Design' | 'Strategy' | 'Admin' | 'Personal';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: TaskCategory;
  tags: string[];
  priority: PriorityLevel;
  status: TaskStatus;
  deadline: string; // ISO date or datetime string
  estimatedMinutes: number;
  actualMinutes?: number;
  mlPredictedMinutes: number;
  mlPriorityScore: number;
  mlRiskScore: number;
  mlRiskLevel: RiskLevel;
  mlRiskReasons?: string[];
  mlConfidence?: number;
  recurrence: RecurrencePattern;
  dependencies: string[]; // Task IDs
  subtasks: Subtask[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FixedCommitment {
  id: string;
  title: string;
  startMinute: number; // Minutes from midnight, e.g. 9*60 = 540
  endMinute: number;
  category?: string;
}

export interface ScheduleBlock {
  id: string;
  taskId?: string;
  title: string;
  type: 'task' | 'commitment' | 'break';
  priority?: PriorityLevel;
  category?: string;
  startMinute: number; // Minutes from midnight
  endMinute: number;
  mlPriorityScore?: number;
  isPeakWindow?: boolean;
  conflictWarning?: string;
}

export interface DailySchedule {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: 'draft' | 'approved';
  blocks: ScheduleBlock[];
  unscheduledTaskIds: string[];
  unscheduledReasons: Record<string, string>;
  conflicts: string[];
  efficiencyScore: number;
  totalFocusedMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  category: string;
  frequency: 'Daily' | 'Weekly';
  targetCount: number;
  reminderTime: string; // e.g. "08:30"
  currentStreak: number;
  longestStreak: number;
  completedDates: string[]; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string;
  taskTitle?: string;
  mode: 'pomodoro' | 'custom' | 'short_break' | 'long_break';
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  startedAt: string;
  endedAt?: string;
  createdAt: string;
}

export interface ProductivityLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  productivityScore: number;
  tasksCompleted: number;
  plannedMinutes: number;
  actualMinutes: number;
  focusMinutes: number;
  delayedTasks: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedAIAction {
  type: 'CREATE_TASK' | 'RESCHEDULE_TASKS' | 'COMPLETE_TASK' | 'UPDATE_AVAILABILITY';
  summary: string;
  payload: Record<string, any>;
  status?: 'pending' | 'confirmed' | 'rejected';
}

export interface AIMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  proposedAction?: ProposedAIAction;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'deadline' | 'overdue' | 'planning' | 'habit' | 'focus' | 'conflict';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  roleTitle: string;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  dailyFocusGoalMinutes: number;
  mlConsent: boolean;
  notificationPrefs: {
    deadlines: boolean;
    overdue: boolean;
    dailyPlanning: boolean;
    habits: boolean;
    focus: boolean;
    conflicts: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MLModelEvaluation {
  modelVersion: string;
  isPersonalized: boolean;
  consentedUserSamples: number;
  calibrationSamples: number;
  priorityModel: {
    name: string;
    r2Score: number;
    mae: number;
    featureImportances: { feature: string; weight: number }[];
  };
  durationModel: {
    name: string;
    r2Score: number;
    maeMinutes: number;
    categoryMultipliers: Record<string, number>;
  };
  riskModel: {
    name: string;
    accuracy: number;
    f1Score: number;
    highRiskCount: number;
  };
  patternAnalysis: {
    algorithm: string;
    peakHours: number[];
    dipHours: number[];
    chronotype: string;
    hourlyScores: { hour: string; hourNum: number; score: number; cluster: 'Peak' | 'Steady' | 'Recovery' }[];
  };
}
