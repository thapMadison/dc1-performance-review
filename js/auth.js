/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS — email keys + role resolution
   Manager  = email is hardcoded in /managers (DB).
   Leader   = email is hardcoded in /leaders (DB), value = dept name;
              read-only view over that department's reviews.
   Reviewer = anyone else; their assignments come from employees
              whose reviewerIds contain their employee record id.
   Precedence: manager > leader > reviewer.
═══════════════════════════════════════════════════════════════ */

import { ROLE } from './constants.js';

// RTDB keys cannot contain '.', so emails are stored with '.' → ','
export function encodeEmailKey(email) {
  return String(email || '').trim().toLowerCase().replace(/\./g, ',');
}

// Derive the current user (with role) from auth + DB state.
export function resolveUser(state) {
  const au = state.authUser;
  if (!au) return null;
  const email = String(au.email || '').toLowerCase();
  const key = encodeEmailKey(email);
  const isManager = !!state.managers[key];
  const leaderDept = !isManager && typeof state.leaders[key] === 'string' ? state.leaders[key].trim() : null;
  const myEmp = state.employees.find(e => String(e.email || '').toLowerCase() === email) || null;
  return {
    email,
    name: au.name || (myEmp && myEmp.name) || email,
    role: isManager ? ROLE.MANAGER : (leaderDept ? ROLE.LEADER : ROLE.REVIEWER),
    dept: leaderDept,
    empId: myEmp ? myEmp.id : null,
    title: myEmp ? myEmp.title : '',
  };
}

// Does this employee belong to the leader's department?
export function inLeaderDept(user, emp) {
  if (!user || !user.dept || !emp) return false;
  return String(emp.dept || '').trim().toLowerCase() === user.dept.toLowerCase();
}
