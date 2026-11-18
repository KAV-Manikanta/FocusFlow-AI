import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, buildDemoData, validateBackup } from './dataPortability';

test('demo dataset passes validation and round-trips', () => {
  const demo = buildDemoData();
  const res = validateBackup(JSON.parse(JSON.stringify({ tasks: demo.tasks, habits: demo.habits })));
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.tasks.length, 25);
    assert.equal(res.habits.length, 10);
  }
  assert.equal(buildBackup([], []).app, 'focusflow-ai');
});

test('bad entities are rejected with readable paths', () => {
  const res = validateBackup({
    tasks: [{ title: '', category: 'Nope', priority: 'High', deadline: 'tomorrow', estimatedMinutes: 0 }],
    habits: [{ title: 'x', frequency: 'Hourly' }],
  });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.ok(res.errors.some((e) => e.startsWith('tasks[0].category')));
    assert.ok(res.errors.some((e) => e.startsWith('tasks[0].deadline')));
    assert.ok(res.errors.some((e) => e.startsWith('habits[0].frequency')));
  }
});

test('dangling dependencies, empty files and non-objects are rejected', () => {
  const t = { title: 'A', category: 'Admin', priority: 'Low', deadline: '2026-12-01', estimatedMinutes: 30, dependencies: ['ghost'] };
  assert.equal(validateBackup({ tasks: [t] }).ok, false);
  assert.equal(validateBackup({ tasks: [], habits: [] }).ok, false);
  assert.equal(validateBackup([]).ok, false);
});
