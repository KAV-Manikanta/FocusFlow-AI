import test from 'node:test';
import assert from 'node:assert/strict';
import {
  predictTaskIntelligence,
  generateConstraintSchedule,
  analyzeProductivityPatterns,
  formatMinutesToTime,
} from './productivityEngine';
import { Task } from '../types';

test('ML Task Priority & Duration Prediction ranks critical near-deadline tasks higher than low distant tasks', () => {
  const refNow = new Date('2026-11-13T10:00:00Z');

  const urgentCritical = predictTaskIntelligence({
    title: 'Deploy Neural Network Microservice',
    category: 'Engineering',
    priority: 'Critical',
    deadline: '2026-11-13T18:00:00Z', // 8h left
    estimatedMinutes: 90,
    dependencies: ['dep_1'],
    referenceNow: refNow,
  });

  const relaxedLow = predictTaskIntelligence({
    title: 'Organize Desktop Bookmarks',
    category: 'Personal',
    priority: 'Low',
    deadline: '2026-11-20T18:00:00Z', // 7 days left
    estimatedMinutes: 30,
    dependencies: [],
    referenceNow: refNow,
  });

  assert.ok(
    urgentCritical.mlPriorityScore > relaxedLow.mlPriorityScore,
    `Expected urgent critical score (${urgentCritical.mlPriorityScore}) > relaxed low score (${relaxedLow.mlPriorityScore})`
  );
  assert.ok(urgentCritical.mlPredictedMinutes >= 90, 'Engineering tasks should account for complexity overhead');
  assert.ok(urgentCritical.mlRiskScore > relaxedLow.mlRiskScore, 'Tight deadline should have higher risk score');
  assert.ok(urgentCritical.mlRiskReasons.length > 0, 'Should provide human-understandable risk reasons');
});

test('Constraint Smart Scheduler respects dependencies, injects breaks, and never silently drops overflow tasks', () => {
  const baseTasks: Task[] = [
    {
      id: 'task_prereq',
      userId: 'u1',
      title: 'Prepare Dataset Schema',
      category: 'Engineering',
      tags: ['ml'],
      priority: 'High',
      status: 'Todo',
      deadline: '2026-11-14',
      estimatedMinutes: 60,
      mlPredictedMinutes: 60,
      mlPriorityScore: 85,
      mlRiskScore: 30,
      mlRiskLevel: 'Moderate',
      recurrence: 'None',
      dependencies: [],
      subtasks: [],
      createdAt: '2026-11-13T08:00:00Z',
      updatedAt: '2026-11-13T08:00:00Z',
    },
    {
      id: 'task_dependent',
      userId: 'u1',
      title: 'Train Random Forest Model',
      category: 'Engineering',
      tags: ['ml'],
      priority: 'Critical',
      status: 'Todo',
      deadline: '2026-11-14',
      estimatedMinutes: 60,
      mlPredictedMinutes: 60,
      mlPriorityScore: 95,
      mlRiskScore: 45,
      mlRiskLevel: 'Moderate',
      recurrence: 'None',
      dependencies: ['task_prereq'],
      subtasks: [],
      createdAt: '2026-11-13T08:00:00Z',
      updatedAt: '2026-11-13T08:00:00Z',
    },
    {
      id: 'task_overflow',
      userId: 'u1',
      title: 'Write 150-Page Documentation',
      category: 'Academic',
      tags: ['docs'],
      priority: 'Low',
      status: 'Todo',
      deadline: '2026-11-18',
      estimatedMinutes: 180,
      mlPredictedMinutes: 180,
      mlPriorityScore: 30,
      mlRiskScore: 10,
      mlRiskLevel: 'Low',
      recurrence: 'None',
      dependencies: [],
      subtasks: [],
      createdAt: '2026-11-13T08:00:00Z',
      updatedAt: '2026-11-13T08:00:00Z',
    },
  ];

  // Give a 3-hour window (09:00 to 12:00 = 180 mins)
  const schedule = generateConstraintSchedule({
    userId: 'u1',
    date: '2026-11-13',
    tasks: baseTasks,
    workStartHour: 9,
    workEndHour: 12,
    fixedCommitments: [],
  });

  const prereqBlock = schedule.blocks.find((b) => b.taskId === 'task_prereq');
  const depBlock = schedule.blocks.find((b) => b.taskId === 'task_dependent');
  const breakBlock = schedule.blocks.find((b) => b.type === 'break');

  assert.ok(prereqBlock, 'Prerequisite task must be scheduled');
  assert.ok(depBlock, 'Dependent task must be scheduled');
  assert.notEqual(schedule.blocks[0]?.type, 'break', 'First block of the workday must never be a recovery break');
  assert.ok(
    prereqBlock.endMinute <= depBlock.startMinute,
    'Prerequisite must finish before dependent task starts'
  );
  assert.ok(breakBlock, 'Should inject a 15-min cognitive break when continuous work exceeds 90m');
  assert.ok(
    schedule.unscheduledTaskIds.includes('task_overflow'),
    'Task that cannot fit must be explicitly listed in unscheduledTaskIds, never silently dropped'
  );
  assert.ok(schedule.unscheduledReasons['task_overflow'], 'Must record explicit reason for unscheduled task');
});

test('Productivity Pattern K-Means clustering identifies Peak, Steady, and Recovery hours', () => {
  const analysis = analyzeProductivityPatterns([], [], true);
  assert.ok(analysis.peakHours.length > 0);
  assert.equal(analysis.hourlyScores.length, 14);
  assert.equal(formatMinutesToTime(570), '09:30');
});
