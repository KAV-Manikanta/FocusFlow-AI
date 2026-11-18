import React, { useState } from 'react';
import { CheckSquare, Timer, Flame, BarChart3, Plus, Sparkles, Play, Pause, Check } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { formatMinutesToTime, evaluateMLModels } from '../ml/productivityEngine';
import type { PriorityLevel } from '../types';

const PRIORITY_STYLE: Record<PriorityLevel, { box: string; pill: string }> = {
  Critical: { box: 'border-[#EF4444]', pill: 'bg-[#FEE2E2] text-[#B91C1C]' },
  High: { box: 'border-[#F59E0B]', pill: 'bg-[#FEF3C7] text-[#B45309]' },
  Medium: { box: 'border-[#5B3FE0]', pill: 'bg-[#EDE9FE] text-[#5B3FE0]' },
  Low: { box: 'border-[#22B8E6]', pill: 'bg-[#DDF4FC] text-[#0E7AA3]' },
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;

const Delta: React.FC<{ value: number; unit?: string; suffix: string; tone?: string }> = ({ value, unit = '', suffix, tone }) => (
  <p className={`text-[11px] font-bold mt-2 ${tone ?? (value >= 0 ? 'text-[#5B3FE0]' : 'text-[#DC2626]')}`}>
    {value >= 0 ? '▲' : '▼'} {Math.abs(value)}
    {unit} {suffix}
  </p>
);

export const DashboardPage: React.FC<{ onOpenNewTaskModal: () => void }> = ({ onOpenNewTaskModal }) => {
  const {
    userProfile,
    tasks,
    habits,
    focusSessions,
    currentSchedule,
    setActivePage,
    toggleTaskStatus,
    toggleHabitDate,
    regenerateSchedule,
    timerMode,
    timerRunning,
    timerSecondsLeft,
    timerTotalSeconds,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useFocusFlow();

  const [insightDismissed, setInsightDismissed] = useState(false);

  const todayIso = isoDaysAgo(0);
  const activeTasks = tasks
    .filter((t) => t.status === 'Todo' || t.status === 'In Progress')
    .sort((a, b) => b.mlPriorityScore - a.mlPriorityScore);
  const completedTasks = tasks.filter((t) => t.status === 'Completed');

  // ---- Stat cards -------------------------------------------------------
  const last7 = new Set(Array.from({ length: 7 }, (_, i) => isoDaysAgo(i)));
  const prev7 = new Set(Array.from({ length: 7 }, (_, i) => isoDaysAgo(i + 7)));
  const doneThisWeek = completedTasks.filter((t) => t.completedAt && last7.has(t.completedAt.slice(0, 10))).length;

  const focusMinIn = (days: Set<string>) =>
    focusSessions.filter((s) => s.completed && days.has(s.startedAt.slice(0, 10))).reduce((a, s) => a + s.actualMinutes, 0);
  const focusHoursNow = focusMinIn(last7) / 60;
  const focusHoursDelta = Math.round((focusHoursNow - focusMinIn(prev7) / 60) * 10) / 10;

  const topStreak = Math.max(0, ...habits.map((h) => h.currentStreak));
  const bestStreak = Math.max(0, ...habits.map((h) => h.longestStreak));

  const todayFocusMinutes = focusMinIn(new Set([todayIso]));
  const completionRatio = tasks.length > 0 ? completedTasks.length / tasks.length : 0;
  const focusRatio = Math.min(1, todayFocusMinutes / Math.max(60, userProfile.dailyFocusGoalMinutes));
  const productivity = Math.round(completionRatio * 60 + focusRatio * 40);

  // ---- Weekly productivity chart (Mon..Sun of this week) ---------------------
  const mondayOffset = (new Date().getDay() + 6) % 7;
  const dayScore = (iso: string) => {
    const mins = focusSessions.filter((s) => s.completed && s.startedAt.startsWith(iso)).reduce((a, s) => a + s.actualMinutes, 0);
    const done = completedTasks.filter((t) => t.completedAt?.startsWith(iso)).length;
    return Math.min(100, Math.round((mins / Math.max(60, userProfile.dailyFocusGoalMinutes)) * 60 + done * 15));
  };
  const weekScores = DAY_LABELS.map((_, i) => dayScore(isoDaysAgo(mondayOffset - i)));
  const lastWeekTotal = DAY_LABELS.reduce((a, _, i) => a + dayScore(isoDaysAgo(mondayOffset - i + 7)), 0);
  const thisWeekTotal = weekScores.reduce((a, b) => a + b, 0);
  const weekDelta = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : 0;
  const maxScore = Math.max(...weekScores);
  const highlightIdx = maxScore > 0 ? weekScores.indexOf(maxScore) : mondayOffset;

  // ---- Today's tasks ----------------------------------------------------
  const completedToday = completedTasks.filter((t) => t.completedAt?.startsWith(todayIso));
  const listTasks = [...completedToday, ...activeTasks].slice(0, 4);
  const timeFor = (taskId: string, deadline: string) => {
    const b = currentSchedule.blocks.find((x) => x.taskId === taskId);
    return b ? `${formatMinutesToTime(b.startMinute)} – ${formatMinutesToTime(b.endMinute)}` : `Due ${deadline}`;
  };

  // ---- AI insight -------------------------------------------------------
  const ml = evaluateMLModels(tasks, focusSessions, userProfile.mlConsent);
  const peak = ml.patternAnalysis.peakHours;
  const peakStart = peak.length ? Math.min(...peak) : 9;
  const peakEnd = peak.length ? Math.max(...peak) + 1 : 11;
  const samePeriod = peakStart < 12 === peakEnd <= 12;
  const peakLabel = samePeriod
    ? `${peakStart % 12 === 0 ? 12 : peakStart % 12}–${fmtHour(peakEnd)}`
    : `${fmtHour(peakStart)}–${fmtHour(peakEnd)}`;
  const topTask = activeTasks[0];

  // ---- Focus session ring ----------------------------------------------
  const R = 62;
  const C = 2 * Math.PI * R;
  const remainingFrac = timerTotalSeconds > 0 ? timerSecondsLeft / timerTotalSeconds : 1;
  const mm = String(Math.floor(timerSecondsLeft / 60)).padStart(2, '0');
  const ss = String(timerSecondsLeft % 60).padStart(2, '0');
  const pomosToday = focusSessions.filter((s) => s.completed && s.mode === 'pomodoro' && s.startedAt.startsWith(todayIso)).length;
  const timerLabel =
    timerMode === 'pomodoro'
      ? `Pomodoro ${(pomosToday % 4) + 1}/4`
      : timerMode === 'short_break'
      ? 'Short break'
      : timerMode === 'long_break'
      ? 'Long break'
      : 'Custom session';
  const started = timerSecondsLeft < timerTotalSeconds;

  const card = 'bg-white rounded-2xl shadow-card border border-[#F0F1F8]';

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Weekly metrics">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#4F3BD9] to-[#7A3FEA] shadow-[0_12px_28px_rgba(91,63,224,0.3)]">
          <span className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="relative flex items-center justify-between text-xs font-medium text-white/85">
            <span>Tasks done</span>
            <CheckSquare className="w-4 h-4" />
          </div>
          <p className="relative text-4xl font-extrabold mt-3 tracking-tight">{completedTasks.length}</p>
          <p className="relative text-[11px] font-bold mt-2 text-white/90">▲ {doneThisWeek} this week</p>
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between text-xs font-medium text-[#7A7D96]">
            <span>Focus hours</span>
            <span className="w-8 h-8 rounded-lg bg-[#EDE9FE] text-[#5B3FE0] flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </span>
          </div>
          <p className="text-4xl font-extrabold mt-1 tracking-tight text-[#14142B]">{focusHoursNow.toFixed(1)}h</p>
          <Delta value={focusHoursDelta} unit="h" suffix="vs last" />
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between text-xs font-medium text-[#7A7D96]">
            <span>Streak</span>
            <span className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#F59E0B] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <p className="text-4xl font-extrabold mt-1 tracking-tight text-[#14142B]">
            {topStreak} {topStreak === 1 ? 'day' : 'days'}
          </p>
          <p className="text-[11px] font-bold mt-2 text-[#D97706]">
            {topStreak > 0 && topStreak >= bestStreak ? 'Personal best' : `Best ${bestStreak} days`}
          </p>
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between text-xs font-medium text-[#7A7D96]">
            <span>Productivity</span>
            <span className="w-8 h-8 rounded-lg bg-[#DDF4FC] text-[#22B8E6] flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-4xl font-extrabold mt-1 tracking-tight text-[#14142B]">{productivity}%</p>
          <Delta value={weekDelta} unit="%" suffix="" tone={weekDelta >= 0 ? 'text-[#0E9AC4]' : 'text-[#DC2626]'} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left column */}
        <div className="lg:col-span-7 space-y-5">
          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-[#14142B]">Today&apos;s Tasks</h2>
              <button
                type="button"
                onClick={onOpenNewTaskModal}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-gradient-to-r from-[#4F3BD9] to-[#6D3FE6] text-white text-xs font-bold shadow-[0_6px_14px_rgba(91,63,224,0.3)] hover:brightness-110 transition"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>

            {listTasks.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#7A7D96]">Nothing on the list. Add a task to get started.</p>
            ) : (
              <ul className="space-y-2.5">
                {listTasks.map((task) => {
                  const done = task.status === 'Completed';
                  const style = PRIORITY_STYLE[task.priority];
                  return (
                    <li key={task.id} className="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#F6F6FA]">
                      <button
                        type="button"
                        onClick={() => toggleTaskStatus(task.id)}
                        aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" as completed`}
                        className={`w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                          done ? 'bg-[#5B3FE0] border-[#5B3FE0]' : `bg-white ${style.box}`
                        }`}
                      >
                        {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-semibold truncate ${done ? 'line-through text-[#9A9CB3]' : 'text-[#14142B]'}`}>
                          {task.title}
                        </p>
                        <p className="text-[11px] text-[#7A7D96] mt-0.5">{timeFor(task.id, task.deadline)}</p>
                      </div>
                      <span className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full shrink-0 ${style.pill}`}>{task.priority}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={`${card} p-6`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[#14142B]">Weekly Productivity</h2>
                <p className="text-[11px] text-[#7A7D96] mt-0.5">
                  Score by day · {weekDelta >= 0 ? '+' : ''}
                  {weekDelta}% vs last week
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#7A7D96] bg-[#F1F1F6] rounded-full px-3 py-1.5">This week</span>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-3 h-[150px] items-end">
              {weekScores.map((score, i) => (
                <div
                  key={DAY_LABELS[i]}
                  title={`${DAY_LABELS[i]}: ${score}`}
                  className={`rounded-xl transition-all ${
                    i === highlightIdx ? 'bg-gradient-to-b from-[#4F3BD9] to-[#7A3FEA] shadow-[0_8px_18px_rgba(91,63,224,0.3)]' : 'bg-[#F0F0F0]'
                  }`}
                  style={{ height: `${Math.max(18, score)}%` }}
                />
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-7 gap-3">
              {DAY_LABELS.map((d) => (
                <span key={d} className="text-center text-[11px] text-[#7A7D96] font-medium">
                  {d}
                </span>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 space-y-5">
          {!insightDismissed && (
            <section className="rounded-2xl p-6 text-white bg-gradient-to-br from-[#4F3BD9] to-[#7A3FEA] shadow-[0_12px_28px_rgba(91,63,224,0.3)]">
              <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.12em] text-white/80">
                <Sparkles className="w-3.5 h-3.5" /> AI INSIGHT
              </p>
              <p className="mt-3 text-[17px] leading-snug font-extrabold">
                You focus best between {peakLabel}.
                {topTask ? (
                  <> Move &ldquo;{topTask.title}&rdquo; to your peak window and get it done faster.</>
                ) : (
                  <> Keep your deep work inside that window.</>
                )}
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => regenerateSchedule()}
                  className="h-8 px-3.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => setInsightDismissed(true)}
                  className="h-8 px-3.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </section>
          )}

          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-[#14142B]">Focus Session</h2>
              <span className="text-[11px] text-[#7A7D96] font-medium">{timerLabel}</span>
            </div>

            <div className="relative w-[170px] h-[170px] mx-auto mt-4">
              <svg viewBox="0 0 150 150" className="w-full h-full -rotate-90">
                <defs>
                  <linearGradient id="ffRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#4F3BD9" />
                    <stop offset="100%" stopColor="#7A3FEA" />
                  </linearGradient>
                </defs>
                <circle cx="75" cy="75" r={R} fill="none" stroke="#ECEDF5" strokeWidth="11" />
                <circle
                  cx="75"
                  cy="75"
                  r={R}
                  fill="none"
                  stroke="url(#ffRing)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - remainingFrac)}
                  style={{ transition: 'stroke-dashoffset 0.6s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[30px] font-extrabold text-[#14142B] tabular-nums tracking-tight leading-none">
                  {mm}:{ss}
                </span>
                <span className="text-[11px] text-[#7A7D96] mt-1.5">remaining</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => (timerRunning ? pauseTimer() : startTimer())}
                className="flex items-center gap-1.5 h-9 px-5 rounded-full bg-gradient-to-r from-[#4F3BD9] to-[#6D3FE6] text-white text-xs font-bold shadow-[0_6px_14px_rgba(91,63,224,0.3)] hover:brightness-110 transition"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {timerRunning ? 'Pause' : started ? 'Resume' : 'Start'}
              </button>
              <button
                type="button"
                onClick={resetTimer}
                className="h-9 px-5 rounded-full bg-[#F1F1F6] hover:bg-[#E8E9F4] text-[#3B3D58] text-xs font-bold transition-colors"
              >
                Skip
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Habit check-in */}
      {habits.length > 0 && (
        <section className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-[#14142B]">Today&apos;s Habits</h2>
              <p className="text-[11px] text-[#7A7D96] mt-0.5">Tap a habit to log today</p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('habits')}
              className="text-xs font-bold text-[#5B3FE0] hover:text-[#4B30C8] transition-colors"
            >
              Manage
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {habits.map((habit) => {
              const doneToday = habit.completedDates.includes(todayIso);
              return (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => toggleHabitDate(habit.id, todayIso)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    doneToday ? 'bg-[#EDE9FE] border-[#D9D0FB]' : 'bg-[#F6F6FA] border-transparent hover:bg-[#EFEFF6]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10.5px] font-bold mb-1.5">
                    <span className={doneToday ? 'text-[#5B3FE0]' : 'text-[#7A7D96]'}>
                      {doneToday ? 'DONE TODAY' : `AT ${habit.reminderTime}`}
                    </span>
                    <span className="text-[#D97706]">{habit.currentStreak}d streak</span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#14142B] line-clamp-1">{habit.title}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
