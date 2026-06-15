/* ═══════════════════════════════════════════════════════════════
   ROUTER — hash-based routes + role guard
   #/dashboard #/employees #/employee/:id #/questions
   #/myreviews #/review/:empId
═══════════════════════════════════════════════════════════════ */

import { ROLE } from './constants.js';

const MANAGER_PAGES = ['dashboard', 'employees', 'employee', 'questions', 'myreviews', 'review'];
const LEADER_PAGES = ['employees', 'employee', 'myreviews', 'review'];
const REVIEWER_PAGES = ['myreviews', 'review'];

export function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { page: parts[0] || null, param: parts[1] ? decodeURIComponent(parts[1]) : null };
}

export function nav(path) {
  location.hash = path;
}

// Returns the effective route for the user's role; stale or
// unauthorized routes fall back to the role's home page.
export function resolveRoute(user) {
  const { page, param } = parseRoute();
  const allowed = user.role === ROLE.MANAGER ? MANAGER_PAGES
    : user.role === ROLE.LEADER ? LEADER_PAGES
    : REVIEWER_PAGES;
  const home = user.role === ROLE.MANAGER ? 'dashboard'
    : user.role === ROLE.LEADER ? 'employees'
    : 'myreviews';
  if (!page || !allowed.includes(page)) return { page: home, param: null };
  return { page, param };
}
