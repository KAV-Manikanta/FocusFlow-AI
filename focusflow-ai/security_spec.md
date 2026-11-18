# FocusFlow AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Tenant Isolation (`userId`)**: Every document across `users`, `tasks`, `schedules`, `habits`, `habit_logs`, `focus_sessions`, `productivity_logs`, `ai_conversations`, `notifications`, and `ml_predictions` MUST belong to `request.auth.uid` with `request.auth.token.email_verified == true`.
2. **Relational Subcollection Gate**: Every message in `/ai_conversations/{conversationId}/messages/{messageId}` MUST verify via `get()` that the parent `/ai_conversations/{conversationId}` exists and `data.userId == request.auth.uid`.
3. **Immutable Ownership & Creation Timestamps**: `userId` and `createdAt` can never be mutated during an `update` operation (`incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`).
4. **Server Timestamp Enforcement**: All `createdAt` and `updatedAt` fields must equal `request.time`.
5. **Bounded Strings & Arrays**: All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and all strings/arrays have explicit `.size()` upper bounds.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Email Spoof**: Authenticated user with `email_verified: false` attempting to create a task. -> `PERMISSION_DENIED`
2. **Cross-Tenant Task Read (`list`)**: Authenticated user querying `/tasks` without `where('userId', '==', auth.uid)`. -> `PERMISSION_DENIED`
3. **Identity Spoofing on Create**: Creating `/tasks/task_1` with `userId: "victim_uid"`. -> `PERMISSION_DENIED`
4. **Shadow Field Injection on Create**: Creating `/tasks/task_1` with an undeclared field `isAdmin: true`. -> `PERMISSION_DENIED`
5. **Ownership Transfer on Update**: Updating `/tasks/task_1` to change `userId` to another UID. -> `PERMISSION_DENIED`
6. **Timestamp Forgery on Create**: Creating `/tasks/task_1` with a past or future client-supplied `createdAt != request.time`. -> `PERMISSION_DENIED`
7. **Immortal `createdAt` Mutation**: Updating `/tasks/task_1` with a modified `createdAt`. -> `PERMISSION_DENIED`
8. **ID Poisoning Attack**: Creating a document with a 500-character or special-character ID. -> `PERMISSION_DENIED`
9. **Denial-of-Wallet Oversized String**: Updating a task `title` with a 10,000-character string (`> 200`). -> `PERMISSION_DENIED`
10. **Unbounded Array Injection**: Creating a task with 50 tags (`> 10`). -> `PERMISSION_DENIED`
11. **Orphaned Subcollection Message Write**: Writing to `/ai_conversations/conv_other/messages/msg_1` where `conv_other` belongs to another user. -> `PERMISSION_DENIED`
12. **PII Leak on `/users/{userId}`**: Authenticated user attempting `get` or `list` on `/users/other_uid`. -> `PERMISSION_DENIED`
