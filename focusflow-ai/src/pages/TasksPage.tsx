import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Archive,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Play,
  Link2,
  Repeat,
} from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';
import {
  Task,
  PriorityLevel,
  TaskStatus,
  TaskCategory,
  RecurrencePattern,
} from '../types';

const CATEGORIES: TaskCategory[] = [
  'Engineering',
  'Academic',
  'Research',
  'Design',
  'Strategy',
  'Admin',
  'Personal',
];

const PRIORITIES: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

export const TasksPage: React.FC<{
  showNewTaskModal: boolean;
  setShowNewTaskModal: (open: boolean) => void;
}> = ({ showNewTaskModal, setShowNewTaskModal }) => {
  const {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleSubtask,
    setActiveFocusTaskId,
    startTimer,
    setActivePage,
  } = useFocusFlow();

  const { taskSearch: searchQuery, setTaskSearch: setSearchQuery } = useFocusFlow();
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | TaskCategory>('All');
  const [sortBy, setSortBy] = useState<'mlPriority' | 'deadline' | 'duration'>('mlPriority');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // New / Edit Task Modal Form State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Engineering');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('None');
  const [tagsInput, setTagsInput] = useState('ml, priority');
  const [selectedDependencyId, setSelectedDependencyId] = useState<string>('');
  const [subtasksInput, setSubtasksInput] = useState('Draft technical specification\nVerify validation suite');
  const [formError, setFormError] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (statusFilter === 'All') return t.status !== 'Archived';
        return t.status === statusFilter;
      })
      .filter((t) => (categoryFilter === 'All' ? true : t.category === categoryFilter))
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'mlPriority') return b.mlPriorityScore - a.mlPriorityScore;
        if (sortBy === 'deadline') return a.deadline.localeCompare(b.deadline);
        return b.mlPredictedMinutes - a.mlPredictedMinutes;
      });
  }, [tasks, statusFilter, categoryFilter, searchQuery, sortBy]);

  const openCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setDescription('');
    setCategory('Engineering');
    setPriority('High');
    setDeadline(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    setEstimatedMinutes(60);
    setRecurrence('None');
    setTagsInput('deep-work');
    setSelectedDependencyId('');
    setSubtasksInput('');
    setFormError('');
    setShowNewTaskModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setCategory(task.category);
    setPriority(task.priority);
    setDeadline(task.deadline);
    setEstimatedMinutes(task.estimatedMinutes);
    setRecurrence(task.recurrence);
    setTagsInput(task.tags.join(', '));
    setSelectedDependencyId(task.dependencies[0] || '');
    setSubtasksInput(task.subtasks.map((s) => s.title).join('\n'));
    setFormError('');
    setShowNewTaskModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Task title is required.');
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    const parsedSubtasks = subtasksInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((line, idx) => ({
        id: `sub_${Date.now()}_${idx}`,
        title: line,
        completed: false,
      }));

    const deps = selectedDependencyId ? [selectedDependencyId] : [];

    if (editingTask) {
      await updateTask(editingTask.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        deadline,
        estimatedMinutes: Number(estimatedMinutes) || 45,
        recurrence,
        tags: parsedTags,
        dependencies: deps,
        subtasks: parsedSubtasks.length > 0 ? parsedSubtasks : editingTask.subtasks,
      });
    } else {
      await addTask({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        status: 'Todo',
        deadline,
        estimatedMinutes: Number(estimatedMinutes) || 45,
        recurrence,
        tags: parsedTags,
        dependencies: deps,
        subtasks: parsedSubtasks,
      });
    }

    setShowNewTaskModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#ECEDF5]">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#14142B]">Smart Task Manager</h1>
          <p className="text-sm text-[#7A7D96] mt-0.5">
            Every task is automatically scored by the Gradient Boosting Priority Predictor and Random Forest Duration Regressor.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="py-2 px-4 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Smart Task</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7A7D96] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search tasks by title, description, or tag"
            placeholder="Search tasks by title, description, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F4F5FB] border border-[#ECEDF5] rounded-lg text-sm text-[#14142B] placeholder-[#9A9CB3] focus:outline-none focus:border-[#5B3FE0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Status Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[#F4F5FB] border border-[#ECEDF5] rounded-lg">
            {(['All', 'Todo', 'In Progress', 'Completed', 'Archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-[#5B3FE0] text-white'
                    : 'text-[#7A7D96] hover:text-[#14142B]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-[#F4F5FB] border border-[#ECEDF5] rounded-lg px-3 py-2 text-xs text-[#3B3D58] focus:outline-none focus:border-[#5B3FE0]"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort tasks by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#F4F5FB] border border-[#ECEDF5] rounded-lg px-3 py-2 text-xs text-[#3B3D58] focus:outline-none focus:border-[#5B3FE0]"
          >
            <option value="mlPriority">Sort: Priority</option>
            <option value="deadline">Sort: Earliest Deadline</option>
            <option value="duration">Sort: Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl divide-y divide-[#ECEDF5]">
        {filteredTasks.length === 0 ? (
          <div className="py-16 text-center px-4">
            <p className="text-base font-medium text-[#14142B]">No matching tasks found</p>
            <p className="text-xs text-[#7A7D96] mt-1">
              Adjust your search filter or create a new task to get started.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 py-2 px-4 rounded-lg bg-[#5B3FE0] text-xs font-semibold text-white"
            >
              Create New Task
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
            const depTitles = task.dependencies
              .map((depId) => tasks.find((t) => t.id === depId)?.title || depId)
              .join(', ');

            return (
              <div key={task.id} className="p-5 transition-colors hover:bg-[#F4F5FA]">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleTaskStatus(task.id)}
                      aria-label={`Toggle completion for "${task.title}"`}
                      className="mt-0.5 text-[#7A7D96] hover:text-[#16A34A] transition-colors shrink-0"
                    >
                      {task.status === 'Completed' ? (
                        <CheckSquare className="w-5 h-5 text-[#16A34A]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3
                          className={`font-display text-base font-semibold ${
                            task.status === 'Completed' ? 'line-through text-[#9A9CB3]' : 'text-[#14142B]'
                          }`}
                        >
                          {task.title}
                        </h3>
                      </div>

                      {/* Clean unboxed inline metadata per Zero-Pill rule */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7A7D96] mt-1.5 font-mono tabular-nums">
                        <span className="text-[#3B3D58]">{task.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            task.priority === 'Critical'
                              ? 'text-[#DC2626]'
                              : task.priority === 'High'
                              ? 'text-[#D97706]'
                              : 'text-[#5A5C78]'
                          }
                        >
                          {task.priority} Priority
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Status: {task.status}</span>
                        <span aria-hidden="true">·</span>
                        <span>Due {task.deadline}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Est <strong className="text-[#14142B]">{task.estimatedMinutes}m</strong>
                        </span>
                        {task.recurrence !== 'None' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#5B3FE0]">
                              <Repeat className="w-3 h-3" /> {task.recurrence}
                            </span>
                          </>
                        )}
                        {task.tags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>#{task.tags.join(' #')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side ML Telemetry & Action Controls */}
                  <div className="flex flex-wrap items-center gap-4 shrink-0 pl-8 lg:pl-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFocusTaskId(task.id);
                          startTimer();
                          setActivePage('focus');
                        }}
                        aria-label={`Focus on "${task.title}"`}
                        className="py-1.5 px-3 rounded-lg bg-[#5B3FE0]/15 hover:bg-[#5B3FE0] text-[#5B3FE0] hover:text-white text-xs font-medium transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        <span>Focus</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(task)}
                        className="py-1.5 px-2.5 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs text-[#5A5C78] hover:text-[#14142B] transition-colors whitespace-nowrap shrink-0"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleTaskStatus(task.id, task.status === 'Archived' ? 'Todo' : 'Archived')
                        }
                        aria-label={`Archive "${task.title}"`}
                        className="p-1.5 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-[#7A7D96] hover:text-[#14142B] transition-colors"
                      >
                        <Archive className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Delete "${task.title}"`}
                        className="p-1.5 rounded-lg bg-[#F4F5FA] hover:bg-[#EF4444]/20 text-[#7A7D96] hover:text-[#DC2626] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                        aria-label={isExpanded ? `Collapse details for "${task.title}"` : `Expand details for "${task.title}"`}
                        className="p-1.5 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-[#5A5C78]"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Subtasks & Dependencies */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#ECEDF5] pl-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 space-y-3">
                      {task.description && (
                        <p className="text-xs text-[#5A5C78] leading-relaxed">{task.description}</p>
                      )}

                      {task.dependencies.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-[#D97706]">
                          <Link2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Prerequisite Dependency: {depTitles}</span>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-[#5A5C78] mb-2 font-mono tabular-nums">
                          Subtasks ({completedSubtasks}/{task.subtasks.length})
                        </p>
                        {task.subtasks.length === 0 ? (
                          <p className="text-xs text-[#9A9CB3]">No subtasks configured.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {task.subtasks.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => toggleSubtask(task.id, sub.id)}
                                className="flex items-center gap-2.5 text-xs text-[#5A5C78] hover:text-[#14142B]"
                              >
                                {sub.completed ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-[#16A34A]" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-[#9A9CB3]" />
                                )}
                                <span className={sub.completed ? 'line-through text-[#9A9CB3]' : ''}>
                                  {sub.title}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-2 border-t lg:border-t-0 lg:border-l border-[#ECEDF5] pt-3 lg:pt-0 lg:pl-5">
                      <div className="pt-2 flex items-center gap-2">
                        <span className="text-xs text-[#7A7D96]">Change status:</span>
                        {(['Todo', 'In Progress', 'Completed'] as TaskStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => toggleTaskStatus(task.id, st)}
                            className={`px-2.5 py-1 rounded text-xs font-medium ${
                              task.status === st
                                ? 'bg-[#5B3FE0] text-white'
                                : 'bg-[#F4F5FA] text-[#5A5C78] hover:text-[#14142B]'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Task Modal */}
      {showNewTaskModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
          className="fixed inset-0 z-50 bg-[#14142B]/40 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white shadow-card border border-[#E2E4F0] rounded-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#ECEDF5] pb-3">
              <h2 id="task-modal-title" className="font-display text-lg font-bold text-[#14142B]">
                {editingTask ? 'Edit Smart Task' : 'New Smart Task'}
              </h2>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="text-xs text-[#7A7D96] hover:text-[#14142B]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              {formError && <p className="text-xs text-[#DC2626]">{formError}</p>}

              <div>
                <label htmlFor="task-title-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                  Task Title
                </label>
                <input
                  id="task-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Complete Deep Learning Research Paper"
                  className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] focus:outline-none focus:border-[#5B3FE0]"
                />
              </div>

              <div>
                <label htmlFor="task-desc-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                  Description
                </label>
                <textarea
                  id="task-desc-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key objectives, deliverable criteria, or notes..."
                  className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] focus:outline-none focus:border-[#5B3FE0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="task-category-select" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Category
                  </label>
                  <select
                    id="task-category-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-priority-select" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Priority
                  </label>
                  <select
                    id="task-priority-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-recurrence-select" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Recurrence
                  </label>
                  <select
                    id="task-recurrence-select"
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as RecurrencePattern)}
                    className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                  >
                    {(['None', 'Daily', 'Weekly', 'Monthly'] as RecurrencePattern[]).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-deadline-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Deadline Date
                  </label>
                  <input
                    id="task-deadline-input"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="task-duration-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Estimated Duration (Minutes)
                  </label>
                  <input
                    id="task-duration-input"
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-tags-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    id="task-tags-input"
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="ml, research, sprint"
                    className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                  />
                </div>

                <div>
                  <label htmlFor="task-dep-select" className="block text-xs font-medium text-[#5A5C78] mb-1">
                    Prerequisite Task Dependency
                  </label>
                  <select
                    id="task-dep-select"
                    value={selectedDependencyId}
                    onChange={(e) => setSelectedDependencyId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                  >
                    <option value="">None (Independent)</option>
                    {tasks
                      .filter((t) => t.id !== editingTask?.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="task-subtasks-input" className="block text-xs font-medium text-[#5A5C78] mb-1">
                  Subtasks (one per line)
                </label>
                <textarea
                  id="task-subtasks-input"
                  rows={2}
                  value={subtasksInput}
                  onChange={(e) => setSubtasksInput(e.target.value)}
                  placeholder="Step 1: Prepare dataset&#10;Step 2: Run evaluation"
                  className="w-full px-3.5 py-2 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ECEDF5]">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="py-2 px-4 rounded-lg bg-[#F4F5FA] hover:bg-[#E8E9F4] text-xs font-medium text-[#5A5C78]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-lg bg-[#5B3FE0] hover:bg-[#4B30C8] text-xs font-semibold text-white"
                >
                  {editingTask ? 'Save Changes' : 'Save & Score Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
