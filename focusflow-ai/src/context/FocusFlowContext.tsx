import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import { detachGeminiAccount } from '../services/gemini';
import {
  Task,
  Habit,
  FocusSession,
  ProductivityLog,
  AppNotification,
  UserProfile,
  FixedCommitment,
  DailySchedule,
  AIMessage,
  ProposedAIAction,
  TaskStatus,
} from '../types';
import {
  INITIAL_USER_PROFILE,
  INITIAL_TASKS,
  INITIAL_HABITS,
  INITIAL_FOCUS_SESSIONS,
  INITIAL_PRODUCTIVITY_LOGS,
  INITIAL_NOTIFICATIONS,
  INITIAL_FIXED_COMMITMENTS,
  INITIAL_AI_MESSAGES,
} from '../data/seedData';
import {
  predictTaskIntelligence,
  generateConstraintSchedule,
  evaluateMLModels,
} from '../ml/productivityEngine';
import { assistantChat, validateProposedAction } from '../services/geminiClient';
import type { ImportableTask } from '../lib/dataPortability';

export type ActivePage =
  | 'dashboard'
  | 'tasks'
  | 'planner'
  | 'assistant'
  | 'analytics'
  | 'habits'
  | 'focus'
  | 'insights'
  | 'notifications'
  | 'settings'
  | 'auth';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'warning' | 'danger';
}

interface FocusFlowContextValue {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  firebaseUser: FirebaseUser | null;
  isAuthReady: boolean;
  userProfile: UserProfile;
  updateUserProfile: (patch: Partial<UserProfile>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;

  tasks: Task[];
  addTask: (input: Omit<Task, 'id' | 'userId' | 'mlPredictedMinutes' | 'mlPriorityScore' | 'mlRiskScore' | 'mlRiskLevel' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleTaskStatus: (id: string, status?: TaskStatus) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  fixedCommitments: FixedCommitment[];
  addFixedCommitment: (fc: Omit<FixedCommitment, 'id'>) => void;
  removeFixedCommitment: (id: string) => void;
  currentSchedule: DailySchedule;
  regenerateSchedule: (customWorkHours?: { start: number; end: number }) => Promise<DailySchedule>;
  approveSchedule: () => Promise<void>;
  removeScheduleBlock: (blockId: string) => void;

  habits: Habit[];
  importWorkspaceData: (
    data: { tasks: ImportableTask[]; habits: Habit[] },
    mode: 'merge' | 'replace'
  ) => Promise<{ tasks: number; habits: number; cloudFailed: boolean }>;
  addHabit: (input: { title: string; category: string; frequency: 'Daily' | 'Weekly'; reminderTime: string }) => Promise<void>;
  toggleHabitDate: (habitId: string, dateStr: string) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;

  focusSessions: FocusSession[];
  deleteFocusSession: (id: string) => Promise<void>;
  clearFocusSessions: () => Promise<void>;
  timerMode: 'pomodoro' | 'custom' | 'short_break' | 'long_break';
  setTimerMode: (mode: 'pomodoro' | 'custom' | 'short_break' | 'long_break', customMinutes?: number) => void;
  timerSecondsLeft: number;
  timerTotalSeconds: number;
  timerRunning: boolean;
  taskSearch: string;
  setTaskSearch: (q: string) => void;
  activeFocusTaskId: string;
  setActiveFocusTaskId: (taskId: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  completeFocusSessionEarly: () => Promise<void>;

  productivityLogs: ProductivityLog[];
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;

  aiMessages: AIMessage[];
  isAssistantThinking: boolean;
  sendAssistantMessage: (text: string) => Promise<void>;
  confirmProposedAction: (messageId: string, action: ProposedAIAction) => Promise<void>;
  rejectProposedAction: (messageId: string) => void;

  toasts: ToastItem[];
  addToast: (title: string, description?: string, variant?: ToastItem['variant']) => void;
  dismissToast: (id: string) => void;
  resetAllData: () => Promise<void>;
}

/**
 * Task fields a client may change on an existing document. Keep in sync with the
 * `affectedKeys().hasOnly([...])` list in the tasks `update` rule of firestore.rules.
 * The ML scores and updatedAt are written separately by updateTask.
 */
const SYNCED_TASK_FIELDS = [
  'title',
  'description',
  'category',
  'tags',
  'priority',
  'status',
  'deadline',
  'estimatedMinutes',
  'actualMinutes',
  'recurrence',
  'dependencies',
  'subtasks',
  'completedAt',
] as const satisfies readonly (keyof Task)[];

const FocusFlowContext = createContext<FocusFlowContextValue | undefined>(undefined);

const STORAGE_KEY = 'focusflow_ai_workspace_v2';

export const FocusFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER_PROFILE);

  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  // Always the newest task list, so updates fired back to back build on each other
  // instead of on a stale render, and updateTask can read it outside a state updater.
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  const [fixedCommitments, setFixedCommitments] = useState<FixedCommitment[]>(INITIAL_FIXED_COMMITMENTS);

  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);

  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(INITIAL_FOCUS_SESSIONS);

  const [productivityLogs, setProductivityLogs] = useState<ProductivityLog[]>(INITIAL_PRODUCTIVITY_LOGS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>(INITIAL_AI_MESSAGES);
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);

  const [currentSchedule, setCurrentSchedule] = useState<DailySchedule>(() =>
    generateConstraintSchedule({
      userId: INITIAL_USER_PROFILE.userId,
      date: new Date().toISOString().slice(0, 10),
      tasks: INITIAL_TASKS,
      workStartHour: INITIAL_USER_PROFILE.workStartHour,
      workEndHour: INITIAL_USER_PROFILE.workEndHour,
      fixedCommitments: INITIAL_FIXED_COMMITMENTS,
    })
  );

  // Persistent Cross-Page Focus Timer
  const [timerMode, setTimerModeState] = useState<'pomodoro' | 'custom' | 'short_break' | 'long_break'>('pomodoro');
  const [timerTotalSeconds, setTimerTotalSeconds] = useState<number>(25 * 60);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string>('');
  const timerStartRef = useRef<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (title: string, description?: string, variant: ToastItem['variant'] = 'default') => {
      const id = `tst_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Which signed-in user the in-memory data currently belongs to.
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);

  // Persist to localStorage, namespaced per Google account (never before hydration).
  useEffect(() => {
    if (!firebaseUser || hydratedUid !== firebaseUser.uid) return;
    try {
      const ns = `${STORAGE_KEY}_${firebaseUser.uid}`;
      localStorage.setItem(`${ns}_profile`, JSON.stringify(userProfile));
      localStorage.setItem(`${ns}_tasks`, JSON.stringify(tasks));
      localStorage.setItem(`${ns}_commitments`, JSON.stringify(fixedCommitments));
      localStorage.setItem(`${ns}_habits`, JSON.stringify(habits));
      localStorage.setItem(`${ns}_sessions`, JSON.stringify(focusSessions));
    } catch {
      // ignore storage quota errors
    }
  }, [firebaseUser, hydratedUid, userProfile, tasks, fixedCommitments, habits, focusSessions]);

  // Firebase Auth listener & Firestore hydration
  useEffect(() => {
    const readLocal = <T,>(uid: string, key: string, fallback: T): T => {
      try {
        const saved = localStorage.getItem(`${STORAGE_KEY}_${uid}_${key}`);
        return saved ? (JSON.parse(saved) as T) : fallback;
      } catch {
        return fallback;
      }
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || !user.emailVerified) {
        // Signed out: wipe in-memory data so the next account never sees it.
        setHydratedUid(null);
        setUserProfile(INITIAL_USER_PROFILE);
        setTasks(INITIAL_TASKS);
        setFixedCommitments(INITIAL_FIXED_COMMITMENTS);
        setHabits(INITIAL_HABITS);
        setFocusSessions(INITIAL_FOCUS_SESSIONS);
        setProductivityLogs(INITIAL_PRODUCTIVITY_LOGS);
        setNotifications(INITIAL_NOTIFICATIONS);
        setAiMessages(INITIAL_AI_MESSAGES);
        setIsAuthReady(true);
        return;
      }

      // Load this account's saved local data, then overlay the Google identity.
      const localProfile = readLocal<UserProfile>(user.uid, 'profile', INITIAL_USER_PROFILE);
      const localTasks = readLocal<Task[]>(user.uid, 'tasks', INITIAL_TASKS);
      setUserProfile({
        ...localProfile,
        userId: user.uid,
        email: user.email || localProfile.email,
        displayName: user.displayName || localProfile.displayName,
      });
      setTasks(localTasks);
      setFixedCommitments(readLocal<FixedCommitment[]>(user.uid, 'commitments', INITIAL_FIXED_COMMITMENTS));
      setHabits(readLocal<Habit[]>(user.uid, 'habits', INITIAL_HABITS));
      setFocusSessions(readLocal<FocusSession[]>(user.uid, 'sessions', INITIAL_FOCUS_SESSIONS));
      setHydratedUid(user.uid);

      try {
        const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const loadedTasks: Task[] = [];
          snap.forEach((d) => {
            const data = d.data() as any;
            loadedTasks.push({
              ...data,
              id: d.id,
              createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : String(data.createdAt || new Date().toISOString()),
              updatedAt: typeof data.updatedAt?.toDate === 'function' ? data.updatedAt.toDate().toISOString() : String(data.updatedAt || new Date().toISOString()),
            });
          });
          setTasks(loadedTasks);
        }
      } catch (err) {
        // If Firestore rules or network error occurs during initial sync, log via handler
        try {
          handleFirestoreError(err, OperationType.LIST, 'tasks');
        } catch {
          // Handled
        }
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Build today's draft schedule from the user's own tasks once their data has loaded.
  useEffect(() => {
    if (!isAuthReady || !hydratedUid) return;
    setCurrentSchedule(
      generateConstraintSchedule({
        userId: hydratedUid,
        date: new Date().toISOString().slice(0, 10),
        tasks,
        workStartHour: userProfile.workStartHour,
        workEndHour: userProfile.workEndHour,
        fixedCommitments,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, hydratedUid]);

  // Record Focus Session helper
  const recordCompletedSession = useCallback(
    async (actualMinutes: number) => {
      const nowIso = new Date().toISOString();
      const linkedTask = tasks.find((t) => t.id === activeFocusTaskId);
      const newSession: FocusSession = {
        id: `fcs_${Date.now()}`,
        userId: userProfile.userId,
        taskId: linkedTask?.id,
        taskTitle: linkedTask?.title || 'Deep Work Session',
        mode: timerMode,
        plannedMinutes: Math.round(timerTotalSeconds / 60),
        actualMinutes: Math.max(1, actualMinutes),
        completed: true,
        startedAt: timerStartRef.current || nowIso,
        endedAt: nowIso,
        createdAt: nowIso,
      };

      setFocusSessions((prev) => [newSession, ...prev]);

      // Update today's productivity log
      const todayStr = nowIso.slice(0, 10);
      setProductivityLogs((prev) => {
        if (prev.some((log) => log.date === todayStr)) {
          return prev.map((log) =>
            log.date === todayStr
              ? {
                  ...log,
                  focusMinutes: log.focusMinutes + newSession.actualMinutes,
                  productivityScore: Math.min(99, log.productivityScore + 2),
                }
              : log
          );
        }
        return [
          ...prev,
          {
            id: `plog_${todayStr}`,
            userId: userProfile.userId,
            date: todayStr,
            productivityScore: 50,
            tasksCompleted: 0,
            plannedMinutes: 0,
            actualMinutes: newSession.actualMinutes,
            focusMinutes: newSession.actualMinutes,
            delayedTasks: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];
      });

      // Sync to Firestore if authenticated
      if (firebaseUser?.emailVerified) {
        try {
          await setDoc(doc(db, 'focus_sessions', newSession.id), {
            userId: firebaseUser.uid,
            taskId: newSession.taskId || 'none',
            taskTitle: (newSession.taskTitle || 'Deep Work').slice(0, 200),
            mode: newSession.mode,
            plannedMinutes: newSession.plannedMinutes,
            actualMinutes: newSession.actualMinutes,
            completed: true,
            startedAt: newSession.startedAt,
            endedAt: newSession.endedAt,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.CREATE, `focus_sessions/${newSession.id}`);
          } catch {
            // logged
          }
        }
      }

      addToast(
        'Focus Session Logged',
        `Recorded ${newSession.actualMinutes}m on "${newSession.taskTitle}".`,
        'success'
      );
    },
    [activeFocusTaskId, addToast, firebaseUser, tasks, timerMode, timerTotalSeconds, userProfile.userId]
  );

  // Global cross-page countdown interval
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          recordCompletedSession(Math.round(timerTotalSeconds / 60));
          return timerTotalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerTotalSeconds, recordCompletedSession]);

  const setTimerMode = (mode: 'pomodoro' | 'custom' | 'short_break' | 'long_break', customMinutes?: number) => {
    setTimerRunning(false);
    setTimerModeState(mode);
    const mins =
      mode === 'pomodoro'
        ? 25
        : mode === 'short_break'
        ? 5
        : mode === 'long_break'
        ? 15
        : Math.max(5, Math.min(180, customMinutes || 45));
    setTimerTotalSeconds(mins * 60);
    setTimerSecondsLeft(mins * 60);
  };

  const startTimer = () => {
    if (!timerRunning) {
      timerStartRef.current = new Date().toISOString();
      setTimerRunning(true);
    }
  };

  const pauseTimer = () => {
    setTimerRunning(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSecondsLeft(timerTotalSeconds);
  };

  const completeFocusSessionEarly = async () => {
    const elapsedMinutes = Math.max(1, Math.round((timerTotalSeconds - timerSecondsLeft) / 60) || Math.round(timerTotalSeconds / 60));
    setTimerRunning(false);
    setTimerSecondsLeft(timerTotalSeconds);
    await recordCompletedSession(elapsedMinutes);
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        addToast('Signed in with Google', `Welcome back, ${result.user.displayName || result.user.email}`, 'success');
        setActivePage('dashboard');
      }
    } catch (error: any) {
      addToast('Google Sign-In Notice', error?.message || 'Continuing in local authenticated workspace.', 'warning');
    }
  };

  const signOutUser = async () => {
    try {
      await fbSignOut(auth);
      detachGeminiAccount();
      addToast('Signed Out', 'Switched to local workspace session.', 'default');
    } catch (error: any) {
      addToast('Sign Out Error', error?.message, 'danger');
    }
  };

  const updateUserProfile = async (patch: Partial<UserProfile>) => {
    const nowIso = new Date().toISOString();
    const updated: UserProfile = {
      ...userProfile,
      ...patch,
      updatedAt: nowIso,
    };
    setUserProfile(updated);

    if (firebaseUser?.emailVerified) {
      try {
        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            userId: firebaseUser.uid,
            email: updated.email.slice(0, 256),
            displayName: updated.displayName.slice(0, 100),
            roleTitle: (updated.roleTitle || 'Professional').slice(0, 100),
            timezone: updated.timezone.slice(0, 64),
            workStartHour: updated.workStartHour,
            workEndHour: updated.workEndHour,
            dailyFocusGoalMinutes: updated.dailyFocusGoalMinutes,
            mlConsent: updated.mlConsent,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
        } catch {
          // logged
        }
      }
    }
    addToast('Settings Saved', 'Your workspace preferences and ML parameters have been updated.', 'success');
  };

  const addTask = async (
    input: Omit<Task, 'id' | 'userId' | 'mlPredictedMinutes' | 'mlPriorityScore' | 'mlRiskScore' | 'mlRiskLevel' | 'createdAt' | 'updatedAt'>
  ): Promise<Task> => {
    const mlPrediction = predictTaskIntelligence({
      title: input.title,
      category: input.category,
      priority: input.priority,
      deadline: `${input.deadline}T18:00:00Z`,
      estimatedMinutes: input.estimatedMinutes,
      dependencies: input.dependencies,
      subtaskCount: input.subtasks?.length || 0,
      historicalTasks: tasks,
      mlConsent: userProfile.mlConsent,
    });

    const nowIso = new Date().toISOString();
    const newTask: Task = {
      ...input,
      id: `tsk_${Date.now()}`,
      userId: firebaseUser?.uid || userProfile.userId,
      title: input.title.trim().slice(0, 200),
      description: (input.description || '').slice(0, 2000),
      tags: (input.tags || []).slice(0, 10),
      dependencies: (input.dependencies || []).slice(0, 10),
      subtasks: (input.subtasks || []).slice(0, 20),
      mlPredictedMinutes: mlPrediction.mlPredictedMinutes,
      mlPriorityScore: mlPrediction.mlPriorityScore,
      mlRiskScore: mlPrediction.mlRiskScore,
      mlRiskLevel: mlPrediction.mlRiskLevel,
      mlRiskReasons: mlPrediction.mlRiskReasons,
      mlConfidence: mlPrediction.confidence,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const nextTasks = [newTask, ...tasks];
    setTasks(nextTasks);

    // Automatically refresh draft schedule
    setCurrentSchedule(
      generateConstraintSchedule({
        userId: userProfile.userId,
        date: nowIso.slice(0, 10),
        tasks: nextTasks,
        workStartHour: userProfile.workStartHour,
        workEndHour: userProfile.workEndHour,
        fixedCommitments,
      })
    );

    if (firebaseUser?.emailVerified) {
      try {
        await setDoc(doc(db, 'tasks', newTask.id), {
          userId: firebaseUser.uid,
          title: newTask.title,
          description: newTask.description || '',
          category: newTask.category,
          tags: newTask.tags,
          priority: newTask.priority,
          status: newTask.status,
          deadline: newTask.deadline,
          estimatedMinutes: newTask.estimatedMinutes,
          mlPredictedMinutes: newTask.mlPredictedMinutes,
          mlPriorityScore: newTask.mlPriorityScore,
          mlRiskScore: newTask.mlRiskScore,
          mlRiskLevel: newTask.mlRiskLevel,
          recurrence: newTask.recurrence,
          dependencies: newTask.dependencies,
          subtasks: newTask.subtasks,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.CREATE, `tasks/${newTask.id}`);
        } catch {
          // logged
        }
      }
    }

    addToast(
      'Task Added & Scored by ML',
      `"${newTask.title}" · Priority Score ${newTask.mlPriorityScore}/100 · Est. ${newTask.mlPredictedMinutes}m`,
      'success'
    );
    return newTask;
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const current = tasksRef.current;
    const existing = current.find((t) => t.id === id);
    if (!existing) return;

    // Apply the same limits addTask uses, which are also what firestore.rules enforce.
    const safePatch: Partial<Task> = { ...patch };
    if (safePatch.title !== undefined) safePatch.title = safePatch.title.trim().slice(0, 200);
    if (safePatch.description !== undefined) safePatch.description = safePatch.description.slice(0, 2000);
    if (safePatch.tags !== undefined) safePatch.tags = safePatch.tags.slice(0, 10);
    if (safePatch.dependencies !== undefined) safePatch.dependencies = safePatch.dependencies.slice(0, 10);
    if (safePatch.subtasks !== undefined) safePatch.subtasks = safePatch.subtasks.slice(0, 20);

    const nowIso = new Date().toISOString();
    const merged: Task = { ...existing, ...safePatch, updatedAt: nowIso };
    const mlPred = predictTaskIntelligence({
      title: merged.title,
      category: merged.category,
      priority: merged.priority,
      deadline: `${merged.deadline}T18:00:00Z`,
      estimatedMinutes: merged.estimatedMinutes,
      dependencies: merged.dependencies,
      subtaskCount: merged.subtasks.length,
      historicalTasks: current,
      mlConsent: userProfile.mlConsent,
    });
    const updated: Task = {
      ...merged,
      mlPredictedMinutes: mlPred.mlPredictedMinutes,
      mlPriorityScore: mlPred.mlPriorityScore,
      mlRiskScore: mlPred.mlRiskScore,
      mlRiskLevel: mlPred.mlRiskLevel,
      mlRiskReasons: mlPred.mlRiskReasons,
    };

    const next = current.map((t) => (t.id === id ? updated : t));
    tasksRef.current = next;
    setTasks(next);

    if (!firebaseUser?.emailVerified) return;

    // Send only the fields that changed, limited to what firestore.rules allow a client to
    // update (so never userId, createdAt, mlRiskReasons or mlConfidence). A field set to
    // undefined, such as completedAt when a task is reopened, is removed from the document.
    const cloudPatch: Record<string, unknown> = {};
    for (const key of SYNCED_TASK_FIELDS) {
      if (!(key in safePatch)) continue;
      const value = safePatch[key];
      cloudPatch[key] = value === undefined ? deleteField() : value;
    }

    try {
      await updateDoc(doc(db, 'tasks', id), {
        ...cloudPatch,
        mlPredictedMinutes: updated.mlPredictedMinutes,
        mlPriorityScore: updated.mlPriorityScore,
        mlRiskScore: updated.mlRiskScore,
        mlRiskLevel: updated.mlRiskLevel,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
      } catch {
        // logged
      }
      addToast('Change not synced', 'Your edit is saved in this browser but could not be saved to the cloud.', 'warning');
    }
  };

  const deleteTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (firebaseUser?.emailVerified) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
        } catch {
          // logged
        }
      }
    }
    if (target) {
      addToast('Task Removed', `"${target.title}" was deleted.`, 'default');
    }
  };

  const toggleTaskStatus = async (id: string, explicitStatus?: TaskStatus) => {
    const nowIso = new Date().toISOString();
    const target = tasks.find((t) => t.id === id);
    if (!target) return;

    const nextStatus: TaskStatus =
      explicitStatus || (target.status === 'Completed' ? 'Todo' : 'Completed');

    const actualMins =
      nextStatus === 'Completed'
        ? target.actualMinutes || target.mlPredictedMinutes || target.estimatedMinutes
        : target.actualMinutes;

    await updateTask(id, {
      status: nextStatus,
      actualMinutes: actualMins,
      completedAt: nextStatus === 'Completed' ? nowIso : undefined,
    });

    if (nextStatus === 'Completed') {
      addToast('Task Completed', `"${target.title}" marked as complete.`, 'success');
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextSubtasks = target.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await updateTask(taskId, { subtasks: nextSubtasks });
  };

  const addFixedCommitment = (fc: Omit<FixedCommitment, 'id'>) => {
    const newFc: FixedCommitment = { ...fc, id: `fc_${Date.now()}` };
    const next = [...fixedCommitments, newFc];
    setFixedCommitments(next);
    addToast('Commitment Added', `"${fc.title}" blocked on your calendar.`, 'default');
  };

  const removeFixedCommitment = (id: string) => {
    setFixedCommitments((prev) => prev.filter((c) => c.id !== id));
  };

  const regenerateSchedule = async (customWorkHours?: { start: number; end: number }): Promise<DailySchedule> => {
    const startH = customWorkHours?.start ?? userProfile.workStartHour;
    const endH = customWorkHours?.end ?? userProfile.workEndHour;
    const evalMetrics = evaluateMLModels(tasks, focusSessions, userProfile.mlConsent);

    const generated = generateConstraintSchedule({
      userId: userProfile.userId,
      date: new Date().toISOString().slice(0, 10),
      tasks,
      workStartHour: startH,
      workEndHour: endH,
      fixedCommitments,
      peakHours: evalMetrics.patternAnalysis.peakHours,
    });

    setCurrentSchedule(generated);
    addToast(
      'AI Schedule Generated',
      `Allocated ${generated.blocks.filter((b) => b.type === 'task').length} tasks (${generated.totalFocusedMinutes}m focus). ${
        generated.unscheduledTaskIds.length > 0
          ? `${generated.unscheduledTaskIds.length} overflow task(s) flagged for review.`
          : 'Zero schedule conflicts.'
      }`,
      generated.unscheduledTaskIds.length > 0 ? 'warning' : 'success'
    );
    return generated;
  };

  const approveSchedule = async () => {
    const approved: DailySchedule = {
      ...currentSchedule,
      status: 'approved',
      updatedAt: new Date().toISOString(),
    };
    setCurrentSchedule(approved);

    if (firebaseUser?.emailVerified) {
      try {
        await setDoc(doc(db, 'schedules', approved.id), {
          userId: firebaseUser.uid,
          date: approved.date,
          status: 'approved',
          blocks: approved.blocks.slice(0, 50),
          unscheduledTaskIds: approved.unscheduledTaskIds.slice(0, 50),
          efficiencyScore: approved.efficiencyScore,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `schedules/${approved.id}`);
        } catch {
          // logged
        }
      }
    }

    addToast('Schedule Approved', 'Your daily plan is locked and active on the Dashboard.', 'success');
  };

  const removeScheduleBlock = (blockId: string) => {
    setCurrentSchedule((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== blockId),
    }));
  };

  /**
   * Imports validated tasks and habits. 'replace' wipes the current tasks and habits first
   * (in the cloud too when signed in); 'merge' adds to what is already there.
   * ML scores are recomputed, and ids are regenerated so nothing can collide.
   */
  const importWorkspaceData = async (
    data: { tasks: ImportableTask[]; habits: Habit[] },
    mode: 'merge' | 'replace'
  ): Promise<{ tasks: number; habits: number; cloudFailed: boolean }> => {
    const uid = firebaseUser?.uid || userProfile.userId;
    const nowIso = new Date().toISOString();
    const stamp = Date.now();
    let cloudFailed = false;
    const cloud = Boolean(firebaseUser?.emailVerified);

    const baseTasks = mode === 'replace' ? [] : tasks;
    const idMap = new Map<string, string>();
    data.tasks.forEach((t, i) => idMap.set(t.id, `tsk_${stamp}_${i}`));

    const imported: Task[] = data.tasks.map((t) => {
      const ml = predictTaskIntelligence({
        title: t.title,
        category: t.category,
        priority: t.priority,
        deadline: `${t.deadline}T18:00:00Z`,
        estimatedMinutes: t.estimatedMinutes,
        dependencies: [],
        subtaskCount: t.subtasks.length,
        historicalTasks: baseTasks,
        mlConsent: userProfile.mlConsent,
      });
      return {
        ...t,
        id: idMap.get(t.id)!,
        userId: uid,
        dependencies: t.dependencies.map((d) => idMap.get(d)!).filter(Boolean),
        mlPredictedMinutes: ml.mlPredictedMinutes,
        mlPriorityScore: ml.mlPriorityScore,
        mlRiskScore: ml.mlRiskScore,
        mlRiskLevel: ml.mlRiskLevel,
        mlRiskReasons: ml.mlRiskReasons,
        mlConfidence: ml.confidence,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    const importedHabits: Habit[] = data.habits.map((h, i) => ({
      ...h,
      id: `hab_${stamp}_${i}`,
      userId: userProfile.userId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));

    if (cloud && firebaseUser) {
      if (mode === 'replace') {
        try {
          const snap = await getDocs(query(collection(db, 'tasks'), where('userId', '==', firebaseUser.uid)));
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        } catch (err) {
          cloudFailed = true;
          console.error('Import: could not clear existing tasks', err);
        }
      }
      for (const t of imported) {
        try {
          const doc_: Record<string, unknown> = {
            userId: firebaseUser.uid,
            title: t.title,
            description: t.description || '',
            category: t.category,
            tags: t.tags,
            priority: t.priority,
            status: t.status,
            deadline: t.deadline,
            estimatedMinutes: t.estimatedMinutes,
            mlPredictedMinutes: t.mlPredictedMinutes,
            mlPriorityScore: t.mlPriorityScore,
            mlRiskScore: t.mlRiskScore,
            mlRiskLevel: t.mlRiskLevel,
            recurrence: t.recurrence,
            dependencies: t.dependencies,
            subtasks: t.subtasks,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (t.actualMinutes !== undefined) doc_.actualMinutes = t.actualMinutes;
          if (t.completedAt) doc_.completedAt = t.completedAt;
          await setDoc(doc(db, 'tasks', t.id), doc_);
        } catch (err) {
          cloudFailed = true;
          console.error(`Import: could not save task "${t.title}"`, err);
        }
      }
    }

    const nextTasks = [...imported, ...baseTasks];
    setTasks(nextTasks);
    setHabits(mode === 'replace' ? importedHabits : [...importedHabits, ...habits]);
    setCurrentSchedule(
      generateConstraintSchedule({
        userId: userProfile.userId,
        date: nowIso.slice(0, 10),
        tasks: nextTasks,
        workStartHour: userProfile.workStartHour,
        workEndHour: userProfile.workEndHour,
        fixedCommitments,
      })
    );

    if (cloudFailed) {
      addToast('Imported locally', 'Some tasks could not be saved to the cloud. They are safe in this browser.', 'warning');
    } else {
      addToast('Import complete', `${imported.length} tasks and ${importedHabits.length} habits imported.`, 'success');
    }
    return { tasks: imported.length, habits: importedHabits.length, cloudFailed };
  };

  const deleteFocusSession = async (id: string) => {
    setFocusSessions((prev) => prev.filter((s) => s.id !== id));
    if (firebaseUser?.emailVerified) {
      try {
        await deleteDoc(doc(db, 'focus_sessions', id));
      } catch (err) {
        console.error('Could not delete focus session from the cloud', err);
      }
    }
    addToast('Session deleted', 'The focus session was removed from your log.', 'default');
  };

  const clearFocusSessions = async () => {
    setFocusSessions([]);
    let failed = false;
    if (firebaseUser?.emailVerified) {
      try {
        const snap = await getDocs(query(collection(db, 'focus_sessions'), where('userId', '==', firebaseUser.uid)));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      } catch (err) {
        failed = true;
        console.error('Could not clear focus sessions from the cloud', err);
      }
    }
    if (failed) addToast('Log cleared locally', 'Some cloud entries could not be deleted. Try again.', 'warning');
    else addToast('Focus log cleared', 'All focus sessions were deleted.', 'success');
  };

  const addHabit = async (input: { title: string; category: string; frequency: 'Daily' | 'Weekly'; reminderTime: string }) => {
    const nowIso = new Date().toISOString();
    const newHabit: Habit = {
      id: `hab_${Date.now()}`,
      userId: userProfile.userId,
      title: input.title.trim().slice(0, 120),
      category: input.category,
      frequency: input.frequency,
      targetCount: input.frequency === 'Daily' ? 1 : 4,
      reminderTime: input.reminderTime,
      currentStreak: 0,
      longestStreak: 0,
      completedDates: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setHabits((prev) => [newHabit, ...prev]);
    addToast('Habit Created', `"${newHabit.title}" added to your Habit Tracker.`, 'success');
  };

  const toggleHabitDate = async (habitId: string, dateStr: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const exists = h.completedDates.includes(dateStr);
        const nextDates = exists
          ? h.completedDates.filter((d) => d !== dateStr)
          : [...h.completedDates, dateStr].sort().reverse();
        const nextStreak = exists ? Math.max(0, h.currentStreak - 1) : h.currentStreak + 1;
        const nextLongest = Math.max(h.longestStreak, nextStreak);
        return {
          ...h,
          completedDates: nextDates,
          currentStreak: nextStreak,
          longestStreak: nextLongest,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const deleteHabit = async (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    addToast('Habit Deleted', 'Habit removed from tracker.', 'default');
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('Notifications Cleared', 'All notifications marked as read.', 'default');
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const sendAssistantMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: AIMessage = {
      id: `msg_${Date.now()}_u`,
      userId: userProfile.userId,
      conversationId: 'conv_main',
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setIsAssistantThinking(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayLog = productivityLogs.find((l) => l.date === todayStr);

      const data = await assistantChat({
        message: trimmed,
        tasks,
        workStartHour: userProfile.workStartHour,
        workEndHour: userProfile.workEndHour,
        focusMinutesToday: todayLog?.focusMinutes || 95,
      });

      const assistantMsg: AIMessage = {
        id: `msg_${Date.now()}_a`,
        userId: userProfile.userId,
        conversationId: 'conv_main',
        role: 'assistant',
        content: data.reply || 'I analyzed your tasks and schedule.',
        proposedAction: data.proposedAction,
        createdAt: new Date().toISOString(),
      };
      setAiMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const fallbackMsg: AIMessage = {
        id: `msg_${Date.now()}_err`,
        userId: userProfile.userId,
        conversationId: 'conv_main',
        role: 'assistant',
        content: 'I could not complete that request. Please check your connection and try again.',
        createdAt: new Date().toISOString(),
      };
      setAiMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  const confirmProposedAction = async (messageId: string, action: ProposedAIAction) => {
    try {
      const valData = validateProposedAction(action);
      if (!valData.valid) {
        addToast('Action Validation Failed', valData.error, 'danger');
        return;
      }

      if (action.type === 'CREATE_TASK') {
        const p = action.payload;
        await addTask({
          title: p.title || 'New AI Task',
          description: 'Created via FocusFlow AI Assistant',
          category: p.category || 'Academic',
          tags: ['ai-created'],
          priority: p.priority || 'High',
          status: 'Todo',
          deadline: p.deadline || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          estimatedMinutes: Number(p.estimatedMinutes) || 60,
          recurrence: 'None',
          dependencies: [],
          subtasks: [],
        });
      } else if (action.type === 'RESCHEDULE_TASKS' || action.type === 'UPDATE_AVAILABILITY') {
        const p = action.payload;
        await regenerateSchedule({
          start: Number(p.workStartHour) || userProfile.workStartHour,
          end: Number(p.workEndHour) || userProfile.workEndHour,
        });
      } else if (action.type === 'COMPLETE_TASK' && action.payload?.taskId) {
        await toggleTaskStatus(action.payload.taskId, 'Completed');
      }

      setAiMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.proposedAction
            ? { ...m, proposedAction: { ...m.proposedAction, status: 'confirmed' } }
            : m
        )
      );
    } catch (err: any) {
      addToast('Execution Error', err?.message || 'Could not execute action.', 'danger');
    }
  };

  const rejectProposedAction = (messageId: string) => {
    setAiMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.proposedAction
          ? { ...m, proposedAction: { ...m.proposedAction, status: 'rejected' } }
          : m
      )
    );
    addToast('Action Cancelled', 'Proposed AI change was dismissed.', 'default');
  };

  /**
   * Deletes ALL of this user's tasks, sessions, schedules, habits and related data,
   * both in Firestore (when signed in) and in this browser. Profile and Gemini key are kept.
   */
  const resetAllData = async (): Promise<void> => {
    const uid = firebaseUser?.uid;
    let cloudFailed = false;

    if (uid && firebaseUser?.emailVerified) {
      const collections = ['tasks', 'focus_sessions', 'schedules', 'habits', 'habit_logs', 'notifications'];
      for (const name of collections) {
        try {
          const snap = await getDocs(query(collection(db, name), where('userId', '==', uid)));
          await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        } catch (err) {
          cloudFailed = true;
          console.error(`Reset: could not clear "${name}"`, err);
        }
      }
      try {
        const ns = `${STORAGE_KEY}_${uid}`;
        ['tasks', 'commitments', 'habits', 'sessions'].forEach((k) => localStorage.removeItem(`${ns}_${k}`));
      } catch {
        /* ignore */
      }
    }

    setTasks(INITIAL_TASKS);
    setFixedCommitments(INITIAL_FIXED_COMMITMENTS);
    setHabits(INITIAL_HABITS);
    setFocusSessions(INITIAL_FOCUS_SESSIONS);
    setProductivityLogs(INITIAL_PRODUCTIVITY_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setAiMessages(INITIAL_AI_MESSAGES);
    setActiveFocusTaskId('');
    setCurrentSchedule(
      generateConstraintSchedule({
        userId: userProfile.userId,
        date: new Date().toISOString().slice(0, 10),
        tasks: [],
        workStartHour: userProfile.workStartHour,
        workEndHour: userProfile.workEndHour,
        fixedCommitments: [],
      })
    );

    if (cloudFailed) {
      addToast('Reset partly done', 'Local data was cleared, but some cloud data could not be deleted. Try again.', 'warning');
    } else {
      addToast('All data deleted', 'Your tasks, sessions, habits and schedules were permanently removed.', 'success');
    }
  };

  return (
    <FocusFlowContext.Provider
      value={{
        activePage,
        setActivePage,
        firebaseUser,
        isAuthReady,
        userProfile,
        updateUserProfile,
        signInWithGoogle,
        signOutUser,
        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskStatus,
        toggleSubtask,
        fixedCommitments,
        addFixedCommitment,
        removeFixedCommitment,
        currentSchedule,
        regenerateSchedule,
        approveSchedule,
        removeScheduleBlock,
        habits,
        importWorkspaceData,
        addHabit,
        toggleHabitDate,
        deleteHabit,
        focusSessions,
        deleteFocusSession,
        clearFocusSessions,
        timerMode,
        setTimerMode,
        timerSecondsLeft,
        timerTotalSeconds,
        timerRunning,
        taskSearch,
        setTaskSearch,
        activeFocusTaskId,
        setActiveFocusTaskId,
        startTimer,
        pauseTimer,
        resetTimer,
        completeFocusSessionEarly,
        productivityLogs,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        aiMessages,
        isAssistantThinking,
        sendAssistantMessage,
        confirmProposedAction,
        rejectProposedAction,
        toasts,
        addToast,
        dismissToast,
        resetAllData,
      }}
    >
      {children}
    </FocusFlowContext.Provider>
  );
};

export function useFocusFlow(): FocusFlowContextValue {
  const ctx = useContext(FocusFlowContext);
  if (!ctx) {
    throw new Error('useFocusFlow must be used within a FocusFlowProvider');
  }
  return ctx;
}
