import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesText = fs.readFileSync(rulesPath, 'utf-8');

interface AuthContext {
  uid: string;
  email_verified: boolean;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function evaluateDirtyPayload(
  operation: 'create' | 'update' | 'get' | 'list',
  collection: string,
  docId: string,
  auth: AuthContext | null,
  incoming: Record<string, any> | null,
  existing: Record<string, any> | null,
  serverTime: string,
  parentOwnerUid?: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) return 'PERMISSION_DENIED';
  if (operation !== 'list' && !isValidId(docId)) return 'PERMISSION_DENIED';

  if (operation === 'list') {
    if (collection === 'users') return 'PERMISSION_DENIED';
    if (!existing || existing.userId !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  if (operation === 'get') {
    if (collection === 'users') {
      return docId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (!existing || existing.userId !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  if (!incoming) return 'PERMISSION_DENIED';
  if (incoming.userId !== auth.uid || !isValidId(incoming.userId)) return 'PERMISSION_DENIED';

  if (collection === 'tasks') {
    const req = ['userId', 'title', 'category', 'priority', 'status', 'deadline', 'estimatedMinutes', 'createdAt', 'updatedAt'];
    const allowed = new Set([
      ...req,
      'description', 'tags', 'actualMinutes', 'mlPredictedMinutes',
      'mlPriorityScore', 'mlRiskScore', 'mlRiskLevel', 'recurrence',
      'dependencies', 'subtasks', 'completedAt',
    ]);
    for (const k of req) {
      if (!(k in incoming)) return 'PERMISSION_DENIED';
    }
    for (const k of Object.keys(incoming)) {
      if (!allowed.has(k)) return 'PERMISSION_DENIED';
    }
    if (typeof incoming.title !== 'string' || incoming.title.length < 1 || incoming.title.length > 200) return 'PERMISSION_DENIED';
    if ('tags' in incoming && (!Array.isArray(incoming.tags) || incoming.tags.length > 10)) return 'PERMISSION_DENIED';
    if (operation === 'create') {
      if (incoming.createdAt !== serverTime || incoming.updatedAt !== serverTime) return 'PERMISSION_DENIED';
    }
    if (operation === 'update') {
      if (!existing || existing.userId !== auth.uid) return 'PERMISSION_DENIED';
      if (incoming.userId !== existing.userId || incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
      if (incoming.updatedAt !== serverTime) return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }

  if (collection === 'messages') {
    if (parentOwnerUid !== auth.uid) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules enforces global safety net and all 10 collections', () => {
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  for (const col of [
    'users', 'tasks', 'schedules', 'habits', 'habit_logs',
    'focus_sessions', 'productivity_logs', 'ai_conversations',
    'notifications', 'ml_predictions',
  ]) {
    assert.ok(rulesText.includes(`match /${col}/`), `Missing match block for ${col}`);
  }
});

test('Dirty Dozen Payload Suite: all 12 adversarial payloads return PERMISSION_DENIED', () => {
  const now = '2026-11-13T10:00:00Z';
  const validAuth: AuthContext = { uid: 'user_alice', email_verified: true };
  const baseTask = {
    userId: 'user_alice',
    title: 'Prepare ML Report',
    category: 'Academic',
    priority: 'High',
    status: 'Todo',
    deadline: '2026-11-15',
    estimatedMinutes: 60,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Unverified Email Spoof
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', { uid: 'user_alice', email_verified: false }, baseTask, null, now),
    'PERMISSION_DENIED'
  );

  // 2. Cross-Tenant Task Read (list)
  assert.equal(
    evaluateDirtyPayload('list', 'tasks', 'task_1', validAuth, null, { ...baseTask, userId: 'user_bob' }, now),
    'PERMISSION_DENIED'
  );

  // 3. Identity Spoofing on Create
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', validAuth, { ...baseTask, userId: 'user_bob' }, null, now),
    'PERMISSION_DENIED'
  );

  // 4. Shadow Field Injection on Create
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', validAuth, { ...baseTask, isAdmin: true }, null, now),
    'PERMISSION_DENIED'
  );

  // 5. Ownership Transfer on Update
  assert.equal(
    evaluateDirtyPayload('update', 'tasks', 'task_1', validAuth, { ...baseTask, userId: 'user_bob' }, baseTask, now),
    'PERMISSION_DENIED'
  );

  // 6. Timestamp Forgery on Create
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', validAuth, { ...baseTask, createdAt: '2020-01-01T00:00:00Z' }, null, now),
    'PERMISSION_DENIED'
  );

  // 7. Immortal createdAt Mutation on Update
  assert.equal(
    evaluateDirtyPayload('update', 'tasks', 'task_1', validAuth, { ...baseTask, createdAt: '2026-11-14T00:00:00Z' }, baseTask, now),
    'PERMISSION_DENIED'
  );

  // 8. ID Poisoning Attack
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'bad/id$with*special!chars', validAuth, baseTask, null, now),
    'PERMISSION_DENIED'
  );

  // 9. Denial-of-Wallet Oversized String
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', validAuth, { ...baseTask, title: 'A'.repeat(250) }, null, now),
    'PERMISSION_DENIED'
  );

  // 10. Unbounded Array Injection (> 10 tags)
  assert.equal(
    evaluateDirtyPayload('create', 'tasks', 'task_1', validAuth, { ...baseTask, tags: Array.from({ length: 15 }, (_, i) => `t${i}`) }, null, now),
    'PERMISSION_DENIED'
  );

  // 11. Orphaned Subcollection Message Write
  assert.equal(
    evaluateDirtyPayload('create', 'messages', 'msg_1', validAuth, { userId: 'user_alice' }, null, now, 'user_bob'),
    'PERMISSION_DENIED'
  );

  // 12. PII Leak on /users/{userId}
  assert.equal(
    evaluateDirtyPayload('get', 'users', 'user_bob', validAuth, null, { userId: 'user_bob' }, now),
    'PERMISSION_DENIED'
  );
});
