import React, { useState } from 'react';
import { Flame, Plus, Trash2, Check, Sparkles } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';

export const HabitsPage: React.FC = () => {
  const { habits, addHabit, toggleHabitDate, deleteHabit } = useFocusFlow();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Focus');
  const [frequency, setFrequency] = useState<'Daily' | 'Weekly'>('Daily');
  const [reminderTime, setReminderTime] = useState('08:30');

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return {
      iso: d.toISOString().slice(0, 10),
      shortLabel: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d),
      dayNum: d.getDate(),
    };
  });

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addHabit({
      title: title.trim(),
      category,
      frequency,
      reminderTime,
    });
    setTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-[#ECEDF5]">
        <h1 className="font-display text-2xl font-bold text-[#14142B]">Habit Tracker</h1>
        <p className="text-sm text-[#7A7D96] mt-0.5">
          Build durable deep-work and wellness routines with streak tracking and completion calendars.
        </p>
      </div>

      {/* Personalized Habit Recommendation Banner */}
      <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5B3FE0]">
            <Sparkles className="w-4 h-4" />
            <span>Personalized Habit Recommendation (Based on Usage Patterns)</span>
          </div>
          <p className="text-sm text-[#14142B] font-medium">
            Pair a 10-minute &quot;Pre-Coding Architecture Sketch&quot; habit at 09:00 before your peak deep-work block.
          </p>
          <p className="text-xs text-[#7A7D96]">
            Users with morning Engineering focus sessions reduce task duration overruns by 14% when starting with a written specification ritual.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            addHabit({
              title: '10-Minute Pre-Coding Architecture Sketch',
              category: 'Engineering',
              frequency: 'Daily',
              reminderTime: '09:00',
            })
          }
          className="py-2 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold whitespace-nowrap shrink-0 self-start lg:self-center"
        >
          + Adopt Recommended Habit
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Habit Completion Matrix */}
        <div className="lg:col-span-8 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#ECEDF5]">
            <h2 className="font-display text-base font-semibold text-[#14142B]">
              7-Day Completion Calendar &amp; Streaks
            </h2>
            <span className="font-mono text-xs text-[#7A7D96] tabular-nums">
              {habits.length} Active Habits
            </span>
          </div>

          <div className="divide-y divide-[#ECEDF5]">
            {habits.map((habit) => (
              <div key={habit.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#D97706] shrink-0" />
                    <h3 className="text-sm font-semibold text-[#14142B] truncate">{habit.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#7A7D96] mt-1 font-mono tabular-nums">
                    <span>{habit.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{habit.frequency}</span>
                    <span aria-hidden="true">·</span>
                    <span>Reminder {habit.reminderTime}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#D97706]">Current {habit.currentStreak}d</span>
                    <span aria-hidden="true">·</span>
                    <span>Best {habit.longestStreak}d</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {last7Days.map((day) => {
                    const completed = habit.completedDates.includes(day.iso);
                    return (
                      <button
                        key={day.iso}
                        type="button"
                        onClick={() => toggleHabitDate(habit.id, day.iso)}
                        aria-label={`Toggle "${habit.title}" on ${day.iso}`}
                        className={`w-9 h-11 rounded-lg border flex flex-col items-center justify-center transition-colors font-mono tabular-nums ${
                          completed
                            ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#16A34A]'
                            : 'bg-[#F4F5FB] border-[#ECEDF5] text-[#7A7D96] hover:border-[#C9CCE0]'
                        }`}
                      >
                        <span className="text-[10px]">{day.shortLabel.slice(0, 2)}</span>
                        {completed ? (
                          <Check className="w-3.5 h-3.5 mt-0.5" />
                        ) : (
                          <span className="text-xs mt-0.5">{day.dayNum}</span>
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => deleteHabit(habit.id)}
                    aria-label={`Delete habit "${habit.title}"`}
                    className="p-2 text-[#9A9CB3] hover:text-[#DC2626] ml-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 4 Cols: Create New Habit Form */}
        <div className="lg:col-span-4 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#14142B]">Create New Habit</h2>
          <form onSubmit={handleCreateHabit} className="space-y-4">
            <div>
              <label htmlFor="habit-title-input" className="block text-xs text-[#5A5C78] mb-1">
                Habit Title
              </label>
              <input
                id="habit-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., 45-Minute Literature Review"
                className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="habit-category-select" className="block text-xs text-[#5A5C78] mb-1">
                  Category
                </label>
                <select
                  id="habit-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                >
                  <option value="Focus">Focus</option>
                  <option value="Academic">Academic</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Planning">Planning</option>
                  <option value="Wellness">Wellness</option>
                </select>
              </div>

              <div>
                <label htmlFor="habit-freq-select" className="block text-xs text-[#5A5C78] mb-1">
                  Frequency
                </label>
                <select
                  id="habit-freq-select"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as 'Daily' | 'Weekly')}
                  className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="habit-reminder-input" className="block text-xs text-[#5A5C78] mb-1">
                Daily Reminder Time
              </label>
              <input
                id="habit-reminder-input"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Habit</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
