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

// RTDB collections under tools/performance-review/* — also the keys of
// the in-memory `state` object and the demo localStorage payload.
export const COLLECTIONS = Object.freeze([
  'groups', 'employees', 'reviews', 'finals', 'groupWeights', 'bands', 'managers', 'leaders',
]);
