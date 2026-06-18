/* ═══════════════════════════════════════════════════════════════
   FIREBASE BACKEND — Auth (Microsoft via OAuthProvider) +
   Realtime Database subscriptions and writes.

   RBAC note: a signed-in member can no longer read the whole tree.
   Reads are split by role and wired in two phases:
     phase 1  — SHARED nodes (groups/bands/weights/managers/leaders/
                emailToEmpId) load immediately; they let us resolve the
                current user's role + employee id.
     phase 2  — once the role is known, subscribe only the nodes that
                role is allowed to read (manager → full tree; leader →
                per-dept mirrors; reviewer → assignments + own reviews).
   Writes fan out to the denormalized mirrors (employeesByDept,
   reviewsByDept, finalsByDept, assignments, emailToEmpId) atomically.
═══════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, onValue, get, set, update, remove,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {
  initializeAppCheck, ReCaptchaV3Provider,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { firebaseConfig, MS_TENANT, RECAPTCHA_SITE_KEY } from './firebase-config.js';
import { COLLECTIONS_SHARED, COLLECTIONS_MANAGER, COLLECTIONS_LEADER } from './constants.js';
import { encodeEmailKey } from './auth.js';

let auth = null;
let db = null;
let sharedUnsubs = [];   // phase-1 subscriptions (shared nodes)
let roleUnsubs = [];     // phase-2 subscriptions (role-scoped nodes)
let onDataCb = null;

// Latest shared snapshots we need to resolve role/empId in phase 2.
const sharedSnap = { managers: {}, leaders: {}, emailToEmpId: {} };
let currentEmail = '';
// Signature of the phase-2 subscription set, so we only re-subscribe when
// the role / dept / assignment-set actually changes.
let roleSig = null;

// This tool shares one Firebase project with other tools; all its data
// lives under tools/performance-review/* so the namespaces never collide.
const BASE = 'tools/performance-review';

/* ─────────── Subscriptions ─────────── */

function clearUnsubs(list) { list.forEach(u => u()); list.length = 0; }

function subscribeShared() {
  clearUnsubs(sharedUnsubs);
  COLLECTIONS_SHARED.forEach(key => {
    sharedUnsubs.push(onValue(ref(db, `${BASE}/${key}`), snap => {
      const val = snap.val();
      if (key in sharedSnap) sharedSnap[key] = val || {};
      onDataCb(key, val);
      // shared data changed → role/empId may now be resolvable
      reconcileRoleSubscriptions();
    }, err => console.error(`RTDB read failed for /${BASE}/${key}:`, err)));
  });
}

// Resolve the current user's role from the shared snapshots, mirroring
// auth.js resolveUser() (kept local to avoid importing app state here).
function resolveRoleInfo() {
  const email = currentEmail.toLowerCase();
  const key = encodeEmailKey(email);
  if (sharedSnap.managers[key]) return { role: 'manager' };
  const dept = typeof sharedSnap.leaders[key] === 'string' ? sharedSnap.leaders[key].trim() : null;
  if (dept) return { role: 'leader', dept };
  const empId = sharedSnap.emailToEmpId[key] || null;
  return { role: 'reviewer', empId };
}

// (Re)wire phase-2 subscriptions whenever the resolved role identity
// changes. Reviewer assignments add a sub-step: we first read the
// assignment list, then subscribe each assigned employee's own review.
async function reconcileRoleSubscriptions() {
  if (!currentEmail) { roleSig = null; clearUnsubs(roleUnsubs); return; }
  const info = resolveRoleInfo();

  if (info.role === 'manager') {
    const sig = 'manager';
    if (sig === roleSig) return;
    roleSig = sig;
    clearUnsubs(roleUnsubs);
    COLLECTIONS_MANAGER.forEach(key => {
      roleUnsubs.push(onValue(ref(db, `${BASE}/${key}`), snap => onDataCb(key, snap.val()),
        err => console.error(`RTDB read failed for /${BASE}/${key}:`, err)));
    });
    return;
  }

  if (info.role === 'leader') {
    const sig = `leader:${info.dept}`;
    if (sig === roleSig) return;
    roleSig = sig;
    clearUnsubs(roleUnsubs);
    // Leaders read the per-dept mirrors; map them back onto the canonical
    // state keys (employees/reviews/finals) so the views are role-agnostic.
    const map = {
      employeesByDept: 'employees',
      reviewsByDept: 'reviews',
      finalsByDept: 'finals',
    };
    COLLECTIONS_LEADER.forEach(key => {
      roleUnsubs.push(onValue(ref(db, `${BASE}/${key}/${info.dept}`),
        snap => onDataCb(map[key], snap.val()),
        err => console.error(`RTDB read failed for /${BASE}/${key}/${info.dept}:`, err)));
    });
    return;
  }

  // reviewer — needs an empId to read its assignments.
  if (!info.empId) { roleSig = 'reviewer:none'; clearUnsubs(roleUnsubs); onDataCb('assignments', null); return; }
  const sig = `reviewer:${info.empId}`;
  // The assignment set can change; re-read on every shared tick for this
  // reviewer (cheap — single shallow node) and re-wire review subs if so.
  await wireReviewerSubscriptions(info.empId, sig);
}

// Keep track of which (empId) review paths the reviewer is currently
// subscribed to, so we only re-subscribe when the assignment set changes.
let reviewerEmpId = null;
let reviewerAssignedIds = '';
let assignmentsUnsub = null;
let reviewSubs = [];

async function wireReviewerSubscriptions(empId, sig) {
  if (sig !== roleSig) {
    // role identity changed (e.g. first resolve or empId changed) → reset
    roleSig = sig;
    reviewerEmpId = empId;
    clearUnsubs(roleUnsubs);
    if (assignmentsUnsub) { assignmentsUnsub(); assignmentsUnsub = null; }
    clearUnsubs(reviewSubs);
    reviewerAssignedIds = '';

    // Subscribe the reviewer's own assignment list. Each change re-derives
    // which employees' reviews we must read.
    assignmentsUnsub = onValue(ref(db, `${BASE}/assignments/${empId}`), snap => {
      const val = snap.val() || {};
      onDataCb('assignments', val);
      rewireReviewSubs(empId, Object.keys(val));
    }, err => console.error(`RTDB read failed for /${BASE}/assignments/${empId}:`, err));
    roleUnsubs.push(() => { if (assignmentsUnsub) { assignmentsUnsub(); assignmentsUnsub = null; } });
  }
}

// Subscribe reviews/$empId/$myId for each assigned employee. Rebuilds the
// nested state.reviews map as { empId: { myId: review } }.
function rewireReviewSubs(myId, assignedEmpIds) {
  const sigIds = assignedEmpIds.slice().sort().join(',');
  if (sigIds === reviewerAssignedIds) return;
  reviewerAssignedIds = sigIds;
  clearUnsubs(reviewSubs);

  const collected = {};
  if (assignedEmpIds.length === 0) { onDataCb('reviews', {}); return; }
  assignedEmpIds.forEach(empId => {
    reviewSubs.push(onValue(ref(db, `${BASE}/reviews/${empId}/${myId}`), snap => {
      const r = snap.val();
      if (r) collected[empId] = { [myId]: r };
      else delete collected[empId];
      // emit a fresh shallow copy so the store replaces state.reviews
      onDataCb('reviews', { ...collected });
    }, err => console.error(`RTDB read failed for /${BASE}/reviews/${empId}/${myId}:`, err)));
  });
}

function unsubscribeAll() {
  clearUnsubs(sharedUnsubs);
  clearUnsubs(roleUnsubs);
  clearUnsubs(reviewSubs);
  if (assignmentsUnsub) { assignmentsUnsub(); assignmentsUnsub = null; }
  roleSig = null;
  reviewerEmpId = null;
  reviewerAssignedIds = '';
  sharedSnap.managers = {}; sharedSnap.leaders = {}; sharedSnap.emailToEmpId = {};
}

/* ─────────── Denormalization helpers (write side) ─────────── */

// An employee's dept; used to route writes to the per-dept mirrors.
// A reviewer cannot read /employees (manager-only), so when the canonical
// node is unreadable we fall back to the dept carried on the reviewer's own
// assignment entry (assignments/$reviewerId/$empId/dept), which they CAN read.
async function deptOf(empId, reviewerId = null) {
  try {
    const snap = await get(ref(db, `${BASE}/employees/${empId}/dept`));
    if (snap.exists()) return (snap.val() || '').trim();
  } catch (_) { /* not a manager — fall through to the assignment mirror */ }
  if (reviewerId) {
    try {
      const snap = await get(ref(db, `${BASE}/assignments/${reviewerId}/${empId}/dept`));
      if (snap.exists()) return (snap.val() || '').trim();
    } catch (_) { /* no readable source for dept */ }
  }
  return '';
}

// Minimal snapshot stored in assignments/$reviewerId/$empId so a reviewer
// can see who they review (and route review writes to the dept mirror)
// without reading the manager-only /employees node.
function assignmentEntry(emp) {
  return { empId: emp.id, name: emp.name || '', title: emp.title || '', dept: (emp.dept || '').trim() };
}

export const backend = {
  isDemo: false,

  async init({ onAuth, onData }) {
    onDataCb = onData;
    const app = initializeApp(firebaseConfig);

    // App Check — chứng thực client hợp lệ trước khi cho gọi RTDB/Auth.
    if (RECAPTCHA_SITE_KEY) {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }

    auth = getAuth(app);
    db = getDatabase(app);
    onAuthStateChanged(auth, user => {
      if (user) {
        currentEmail = user.email || '';
        subscribeShared();
        onAuth({ email: user.email || '', name: user.displayName || user.email || '' });
      } else {
        currentEmail = '';
        unsubscribeAll();
        onAuth(null);
      }
    });
  },

  async login() {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ tenant: MS_TENANT, prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  },

  async logout() { await signOut(auth); },

  // Reviewer (or manager) saves a review → mirror into reviewsByDept/$dept.
  async saveReview(empId, reviewerId, review) {
    const dept = await deptOf(empId, reviewerId);
    const updates = { [`${BASE}/reviews/${empId}/${reviewerId}`]: review };
    if (dept) updates[`${BASE}/reviewsByDept/${dept}/${empId}/${reviewerId}`] = review;
    await update(ref(db), updates);
  },

  // Manager assigns reviewers. Fan-out:
  //  - employees/$empId/reviewerIds (canonical)
  //  - employeesByDept/$dept/$empId/reviewerIds (leader mirror)
  //  - assignments/$reviewerId/$empId (reverse index, each added reviewer)
  //  - remove reviews + mirror reviews + assignment entries for dropped reviewers
  async assignReviewers(empId, reviewerIdsMap, removedIds) {
    const empSnap = await get(ref(db, `${BASE}/employees/${empId}`));
    const emp = empSnap.val() || {};
    const dept = (emp.dept || '').trim();
    const reviewerIds = Object.keys(reviewerIdsMap);

    const updates = {};
    updates[`${BASE}/employees/${empId}/reviewerIds`] = reviewerIdsMap;
    if (dept) updates[`${BASE}/employeesByDept/${dept}/${empId}/reviewerIds`] = reviewerIdsMap;

    // reverse index: add an entry under each current reviewer
    const entry = assignmentEntry({ id: empId, name: emp.name, title: emp.title, dept });
    reviewerIds.forEach(rid => { updates[`${BASE}/assignments/${rid}/${empId}`] = entry; });

    // dropped reviewers: clear their review, the dept mirror, and reverse index
    removedIds.forEach(rid => {
      updates[`${BASE}/reviews/${empId}/${rid}`] = null;
      if (dept) updates[`${BASE}/reviewsByDept/${dept}/${empId}/${rid}`] = null;
      updates[`${BASE}/assignments/${rid}/${empId}`] = null;
    });

    await update(ref(db), updates);
  },

  async setFinal(empId, qid, score) {
    const dept = await deptOf(empId);
    const val = { score, edited: true };
    const updates = { [`${BASE}/finals/${empId}/${qid}`]: val };
    if (dept) updates[`${BASE}/finalsByDept/${dept}/${empId}/${qid}`] = val;
    await update(ref(db), updates);
  },
  async resetFinal(empId, qid) {
    const dept = await deptOf(empId);
    const updates = { [`${BASE}/finals/${empId}/${qid}`]: null };
    if (dept) updates[`${BASE}/finalsByDept/${dept}/${empId}/${qid}`] = null;
    await update(ref(db), updates);
  },
  async resetAllFinals(empId) {
    const dept = await deptOf(empId);
    const updates = { [`${BASE}/finals/${empId}`]: null };
    if (dept) updates[`${BASE}/finalsByDept/${dept}/${empId}`] = null;
    await update(ref(db), updates);
  },

  setGroupWeight(groupId, weight) {
    return set(ref(db, `${BASE}/groupWeights/${groupId}`), weight);
  },

  // Replacing the question set invalidates existing reviews/finals
  // (and all their denormalized mirrors + the reverse index).
  importQuestions(groups) {
    return update(ref(db), {
      [`${BASE}/groups`]: groups,
      [`${BASE}/reviews`]: null, [`${BASE}/reviewsByDept`]: null,
      [`${BASE}/finals`]: null, [`${BASE}/finalsByDept`]: null,
    });
  },

  // list: [{ id, name, email, title, dept, order, reviewerIds }]
  // Rebuilds employees + every derived mirror/index from scratch.
  importEmployees(list) {
    const employees = {};
    const employeesByDept = {};
    const emailToEmpId = {};
    const assignments = {};

    list.forEach(e => {
      const { id, ...rest } = e;
      const dept = (rest.dept || '').trim();
      employees[id] = rest;
      emailToEmpId[encodeEmailKey(rest.email)] = id;
      if (dept) {
        if (!employeesByDept[dept]) employeesByDept[dept] = {};
        employeesByDept[dept][id] = rest;
      }
    });
    // build the reverse assignment index from each employee's reviewerIds
    list.forEach(e => {
      Object.keys(e.reviewerIds || {}).forEach(rid => {
        if (!assignments[rid]) assignments[rid] = {};
        assignments[rid][e.id] = assignmentEntry(e);
      });
    });

    return update(ref(db), {
      [`${BASE}/employees`]: employees,
      [`${BASE}/employeesByDept`]: employeesByDept,
      [`${BASE}/emailToEmpId`]: emailToEmpId,
      [`${BASE}/assignments`]: assignments,
      // a fresh roster invalidates all prior reviews/finals + mirrors
      [`${BASE}/reviews`]: null, [`${BASE}/reviewsByDept`]: null,
      [`${BASE}/finals`]: null, [`${BASE}/finalsByDept`]: null,
    });
  },
};
