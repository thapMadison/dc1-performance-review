/* ═══════════════════════════════════════════════════════════════
   CONSTANTS — shared string literals with a single source of truth.
   This module imports nothing app-specific, so it can be imported
   from anywhere (incl. both store.js and ui.js) without a cycle.

   IMPORTANT: these VALUES double as CSS class suffixes (pill-${status}),
   DB paths, state keys, and selectors — never change a value, only
   reference it from here.
═══════════════════════════════════════════════════════════════ */

// Review status (also rendered as the `pill-${status}` CSS class).
export const STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  DRAFT: 'draft',
  PENDING: 'pending',
  LOCKED: 'locked',
});

// User roles (precedence manager > leader > reviewer).
export const ROLE = Object.freeze({
  MANAGER: 'manager',
  LEADER: 'leader',
  REVIEWER: 'reviewer',
});

// RTDB collections under tools/performance-review/*. After the RBAC
// rewrite, reads are split by role (a member can no longer read the whole
// tree). These groups drive both the firebase.js subscriptions and the
// demo-store emit. `state` keys are the union of all of them.
//
//   SHARED      — readable by anyone signed in (needed to render any screen
//                 + to resolve the current user's role / empId).
//   MANAGER     — full tree; only managers may read these.
//   LEADER_*    — per-department denormalized mirrors a leader reads.
//   reviewer    — assignments/$myId + reviews/$empId/$myId + memberResults/$myId
//                 (handled ad hoc in firebase.js, not a fixed top-level key list).
export const COLLECTIONS_SHARED = Object.freeze([
  'groups', 'groupWeights', 'bands', 'managers', 'leaders', 'emailToEmpId',
]);
export const COLLECTIONS_MANAGER = Object.freeze([
  'employees', 'reviews', 'finals', 'finalComments', 'pasSubmissions',
  'memberResults', 'selfResponses',
]);
// Leader denormalized mirrors (read under the /$dept child).
export const COLLECTIONS_LEADER = Object.freeze([
  'employeesByDept', 'reviewsByDept', 'finalsByDept', 'finalCommentsByDept',
]);

// Every state key the store may hold, across all roles. Used by the demo
// backend to emit a full snapshot.
export const COLLECTIONS = Object.freeze([
  ...COLLECTIONS_SHARED, ...COLLECTIONS_MANAGER, 'assignments',
]);
