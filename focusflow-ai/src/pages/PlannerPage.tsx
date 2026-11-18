import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Clock,
} from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { formatMinutesToTime } from '../ml/productivityEngine';

export const PlannerPage: React.FC = () => {
  const {
    userProfile,
    updateUserProfile,
    tasks,
    fixedCommitments,
    addFixedCommitment,
    removeFixedCommitment,
    currentSchedule,
    regenerateSchedule,
    approveSchedule,
    removeScheduleBlock,
  } = useFocusFlow();

  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [workStart, setWorkStart] = useState(userProfile.workStartHour);
  const [workEnd, setWorkEnd] = useState(userProfile.workEndHour);

  // New Fixed Commitment form state
  const [commitTitle, setCommitTitle] = useState('');
  const [commitStart, setCommitStart] = useState('13:00');
  const [commitEnd, setCommitEnd] = useState('14:00');

  const parseTimeStr = (str: string) => {
    const [h, m] = str.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const handleAddCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitTitle.trim()) return;
    const s = parseTimeStr(commitStart);
    const end = parseTimeStr(commitEnd);
    if (end <= s) return;
    addFixedCommitment({
      title: commitTitle.trim(),
      startMinute: s,
      endMinute: end,
      category: 'Commitment',
    });
    setCommitTitle('');
  };

  const handleGenerate = async () => {
    await updateUserProfile({ workStartHour: workStart, workEndHour: workEnd });
    await regenerateSchedule({ start: workStart, end: workEnd });
  };

  const weekDays = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(Date.now() + idx * 86400000);
    return {
      iso: d.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(d),
    };
  });

  const monthDays = Array.from({ length: 28 }, (_, idx) => {
    const d = new Date(Date.now() + (idx - 3) * 86400000);
    return {
      iso: d.toISOString().slice(0, 10),
      dayNum: d.getDate(),
    };
  });

  return (
    <div className="space-y-6">
      {/* Header & View Mode Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#ECEDF5]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14142B]">AI Smart Scheduler</h1>
          <p className="text-sm text-[#7A7D96] mt-0.5">
            Constraint-based optimization allocating tasks across your working hours, dependencies, peak cognitive windows, and recovery breaks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-white shadow-card border border-[#ECEDF5] rounded-lg">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCalendarView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                  calendarView === v ? 'bg-[#5B3FE0] text-white' : 'text-[#7A7D96] hover:text-[#14142B]'
                }`}
              >
                {v} View
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="py-2 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate AI Schedule</span>
          </button>

          {currentSchedule.status !== 'approved' && (
            <button
              type="button"
              onClick={approveSchedule}
              className="py-2 px-4 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 12-Col Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Active Calendar View */}
        <div className="lg:col-span-8 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#ECEDF5]">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-4 h-4 text-[#5B3FE0]" />
              <h2 className="font-display text-base font-semibold text-[#14142B]">
                {calendarView === 'day'
                  ? `Daily Time-Block Schedule (${currentSchedule.date})`
                  : calendarView === 'week'
                  ? '7-Day Horizon Workload Distribution'
                  : 'Monthly Deliverable Calendar'}
              </h2>
            </div>
            <span className="font-mono text-xs text-[#7A7D96] tabular-nums">
              Status:{' '}
              <strong className={currentSchedule.status === 'approved' ? 'text-[#16A34A]' : 'text-[#D97706]'}>
                {currentSchedule.status.toUpperCase()}
              </strong>{' '}
              · Efficiency {currentSchedule.efficiencyScore}%
            </span>
          </div>

          {calendarView === 'day' && (
            <div className="divide-y divide-[#ECEDF5]">
              {currentSchedule.blocks.map((block) => (
                <div
                  key={block.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <span className="font-mono text-xs text-[#5A5C78] tabular-nums w-28 shrink-0 pt-0.5">
                      {formatMinutesToTime(block.startMinute)} – {formatMinutesToTime(block.endMinute)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#14142B] truncate">{block.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7A7D96] mt-0.5 font-mono tabular-nums">
                        <span>
                          {block.type === 'task'
                            ? 'AI Task Allocation'
                            : block.type === 'commitment'
                            ? 'Fixed Commitment'
                            : 'Cognitive Recovery Break'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{block.endMinute - block.startMinute}m</span>
                        {block.isPeakWindow && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#16A34A]">Peak Cognitive Slot</span>
                          </>
                        )}
                      </div>
                      {block.conflictWarning && (
                        <p className="text-xs text-[#DC2626] mt-1">{block.conflictWarning}</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeScheduleBlock(block.id)}
                    aria-label={`Remove "${block.title}" from schedule`}
                    className="text-xs text-[#9A9CB3] hover:text-[#DC2626] self-end sm:self-center"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {calendarView === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {weekDays.map((wd) => {
                const dayTasks = tasks.filter((t) => t.deadline === wd.iso && t.status !== 'Archived');
                return (
                  <div key={wd.iso} className="p-3.5 rounded-lg bg-[#F4F5FB] border border-[#ECEDF5] space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="text-[#14142B] font-semibold">{wd.label}</span>
                      <span className="text-[#7A7D96]">{dayTasks.length} due</span>
                    </div>
                    {dayTasks.length === 0 ? (
                      <p className="text-xs text-[#9A9CB3] py-2">Open focus capacity</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayTasks.map((t) => (
                          <div key={t.id} className="text-xs text-[#3B3D58] truncate">
                            • {t.title} ({t.estimatedMinutes}m)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {calendarView === 'month' && (
            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((md) => {
                const dueCount = tasks.filter((t) => t.deadline === md.iso && t.status !== 'Archived').length;
                return (
                  <div
                    key={md.iso}
                    className="p-2.5 rounded-lg bg-[#F4F5FB] border border-[#ECEDF5] min-h-[72px] flex flex-col justify-between"
                  >
                    <span className="font-mono text-xs text-[#7A7D96] tabular-nums">{md.dayNum}</span>
                    {dueCount > 0 && (
                      <span className="font-mono text-xs text-[#5B3FE0] tabular-nums">
                        {dueCount} task{dueCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Unscheduled Overflow Queue (Zero Silent Dropping Guarantee) */}
          {currentSchedule.unscheduledTaskIds.length > 0 && (
            <div className="pt-4 border-t border-[#ECEDF5] space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#D97706]">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  Unscheduled Overflow Queue ({currentSchedule.unscheduledTaskIds.length} Task
                  {currentSchedule.unscheduledTaskIds.length > 1 ? 's' : ''} Held Safely)
                </span>
              </div>
              <p className="text-xs text-[#7A7D96]">
                FocusFlow AI never silently discards tasks that exceed your daily working window or have unmet dependencies:
              </p>
              <div className="space-y-1.5">
                {currentSchedule.unscheduledTaskIds.map((id) => {
                  const taskObj = tasks.find((t) => t.id === id);
                  return (
                    <div key={id} className="text-xs text-[#3B3D58] flex items-center justify-between gap-2 font-mono">
                      <span>• {taskObj?.title || id}</span>
                      <span className="text-[#D97706]">
                        {currentSchedule.unscheduledReasons[id] || 'Capacity exceeded'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Availability Window & Fixed Commitments */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#5B3FE0]" />
              <h2 className="font-display text-sm font-semibold text-[#14142B]">Working Hours Availability</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="planner-start-hour" className="block text-xs text-[#7A7D96] mb-1">
                  Start Hour (0–22)
                </label>
                <input
                  id="planner-start-hour"
                  type="number"
                  min={0}
                  max={22}
                  value={workStart}
                  onChange={(e) => setWorkStart(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
                />
              </div>
              <div>
                <label htmlFor="planner-end-hour" className="block text-xs text-[#7A7D96] mb-1">
                  End Hour (1–24)
                </label>
                <input
                  id="planner-end-hour"
                  type="number"
                  min={1}
                  max={24}
                  value={workEnd}
                  onChange={(e) => setWorkEnd(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              className="w-full py-2 px-4 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs font-semibold text-[#14142B] transition-colors"
            >
              Apply Window &amp; Re-Solve Schedule
            </button>
          </div>

          <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-[#14142B]">Fixed Commitments</h2>
            <div className="divide-y divide-[#ECEDF5]">
              {fixedCommitments.map((fc) => (
                <div key={fc.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#14142B] truncate">{fc.title}</p>
                    <p className="font-mono text-xs text-[#7A7D96] tabular-nums">
                      {formatMinutesToTime(fc.startMinute)} – {formatMinutesToTime(fc.endMinute)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFixedCommitment(fc.id)}
                    aria-label={`Remove commitment "${fc.title}"`}
                    className="p-1 text-[#7A7D96] hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCommitment} className="space-y-3 pt-3 border-t border-[#ECEDF5]">
              <div>
                <label htmlFor="commit-title-input" className="block text-xs text-[#7A7D96] mb-1">
                  New Commitment Title
                </label>
                <input
                  id="commit-title-input"
                  type="text"
                  value={commitTitle}
                  onChange={(e) => setCommitTitle(e.target.value)}
                  placeholder="e.g., Team Design Review"
                  className="w-full px-3 py-1.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-xs text-[#14142B]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="commit-start-input" className="block text-xs text-[#7A7D96] mb-1">
                    Start Time
                  </label>
                  <input
                    id="commit-start-input"
                    type="time"
                    value={commitStart}
                    onChange={(e) => setCommitStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-xs text-[#14142B] font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="commit-end-input" className="block text-xs text-[#7A7D96] mb-1">
                    End Time
                  </label>
                  <input
                    id="commit-end-input"
                    type="time"
                    value={commitEnd}
                    onChange={(e) => setCommitEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-xs text-[#14142B] font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-[#5B3FE0]/20 hover:bg-[#5B3FE0] text-xs font-semibold text-[#14142B] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Fixed Commitment</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
