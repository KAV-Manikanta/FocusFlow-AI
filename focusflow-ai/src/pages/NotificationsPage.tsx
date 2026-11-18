import React from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import { UserProfile } from '../types';

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    userProfile,
    updateUserProfile,
  } = useFocusFlow();

  const togglePref = (key: keyof UserProfile['notificationPrefs']) => {
    updateUserProfile({
      notificationPrefs: {
        ...userProfile.notificationPrefs,
        [key]: !userProfile.notificationPrefs[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#ECEDF5]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14142B]">Smart Notifications</h1>
          <p className="text-sm text-[#7A7D96] mt-0.5">
            Proactive alerts for approaching deadlines, schedule conflicts, daily planning, and habit streaks.
          </p>
        </div>

        <button
          type="button"
          onClick={markAllNotificationsRead}
          className="py-2 px-4 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs font-semibold text-[#14142B] flex items-center gap-2 self-start sm:self-auto"
        >
          <CheckCheck className="w-4 h-4 text-[#16A34A]" />
          <span>Mark All as Read</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Notification Feed */}
        <div className="lg:col-span-8 bg-white shadow-card border border-[#ECEDF5] rounded-2xl divide-y divide-[#ECEDF5]">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-8 h-8 text-[#9A9CB3] mx-auto mb-2" />
              <p className="text-sm text-[#5A5C78]">You&apos;re all caught up. Zero pending alerts.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  n.read ? 'opacity-65' : 'bg-[#FAFAFD]'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <span
                      className={
                        n.type === 'deadline' || n.type === 'overdue'
                          ? 'text-[#DC2626] font-semibold uppercase'
                          : n.type === 'conflict'
                          ? 'text-[#D97706] font-semibold uppercase'
                          : 'text-[#5B3FE0] font-semibold uppercase'
                      }
                    >
                      {n.type}
                    </span>
                    <span>·</span>
                    <span className="text-[#7A7D96]">{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    {!n.read && (
                      <>
                        <span>·</span>
                        <span className="text-[#16A34A]">UNREAD</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-[#14142B]">{n.title}</h3>
                  <p className="text-xs text-[#5A5C78] leading-relaxed">{n.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(n.id)}
                      className="py-1 px-2.5 rounded bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#3B3D58]"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteNotification(n.id)}
                    aria-label={`Delete notification "${n.title}"`}
                    className="p-1.5 text-[#7A7D96] hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right 4 Cols: User-Configurable Preferences */}
        <div className="lg:col-span-4 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#14142B]">Alert Preferences</h2>
          <p className="text-xs text-[#7A7D96]">
            Configure which intelligent triggers generate real-time notifications:
          </p>

          <div className="divide-y divide-[#ECEDF5]">
            {(
              [
                { key: 'deadlines', label: 'Upcoming Deadline Reminders' },
                { key: 'overdue', label: 'Overdue Task Escalation Alerts' },
                { key: 'dailyPlanning', label: 'Morning Schedule & Planning Prompts' },
                { key: 'habits', label: 'Daily Habit Streak Reminders' },
                { key: 'focus', label: 'Focus Session & Peak Window Alerts' },
                { key: 'conflicts', label: 'Schedule Conflict Warnings' },
              ] as const
            ).map((item) => {
              const enabled = userProfile.notificationPrefs[item.key];
              return (
                <div key={item.key} className="py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#3B3D58]">{item.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => togglePref(item.key)}
                    className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                      enabled ? 'bg-[#22C55E]/20 text-[#16A34A]' : 'bg-[#F4F5FA] text-[#7A7D96]'
                    }`}
                  >
                    {enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
