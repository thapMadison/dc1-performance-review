/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS — email keys + role resolution
   Manager  = email is hardcoded in /managers (DB).
   Director = email is hardcoded in /directors (DB); read-only view over
              ALL employees across every department (manager's read scope
              without any editing/assign/PAS powers).
   Leader   = email is hardcoded in /leaders (DB), value = dept name;
              read-only view over that department's reviews.
   Reviewer = anyone else; their assignments come from employees
              whose reviewerIds contain their employee record id.
   Precedence: manager > director > leader > reviewer.
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
  const isDirector = !isManager && !!(state.directors && state.directors[key]);
  const leaderDept = !isManager && !isDirector && typeof state.leaders[key] === 'string' ? state.leaders[key].trim() : null;
  // empId comes from the shared emailToEmpId index — reviewers no longer
  // read the employees node, so we can't look themselves up there.
  const empId = (state.emailToEmpId && state.emailToEmpId[key]) || null;
  // Manager/leader still have employees loaded, so enrich name/title when present.
  const myEmp = empId ? state.employees.find(e => e.id === empId) : null;
  return {
    email,
    name: au.name || (myEmp && myEmp.name) || email,
    role: isManager ? ROLE.MANAGER : isDirector ? ROLE.DIRECTOR : (leaderDept ? ROLE.LEADER : ROLE.REVIEWER),
    dept: leaderDept,
    empId,
    title: myEmp ? myEmp.title : '',
  };
}

// Does this employee belong to the leader's department?
export function inLeaderDept(user, emp) {
  if (!user || !user.dept || !emp) return false;
  return String(emp.dept || '').trim().toLowerCase() === user.dept.toLowerCase();
}
