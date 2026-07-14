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
import { COLLECTIONS_SHARED, COLLECTIONS_MANAGER, COLLECTIONS_LEADER, COLLECTIONS_DIRECTOR } from './constants.js';
import { encodeEmailKey } from './auth.js';

let auth = null;
let db = null;
let sharedUnsubs = [];   // phase-1 subscriptions (shared nodes)
let roleUnsubs = [];     // phase-2 subscriptions (role-scoped nodes)
let onDataCb = null;

// Latest shared snapshots we need to resolve role/empId in phase 2.
const sharedSnap = { managers: {}, leaders: {}, directors: {}, emailToEmpId: {} };
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
  const empId = sharedSnap.emailToEmpId[key] || null;
  // Director reads the full canonical tree read-only; carry empId so their own
  // reviewer/result pages still work if they're also an employee.
  if (sharedSnap.directors[key]) return { role: 'director', empId };
  const dept = typeof sharedSnap.leaders[key] === 'string' ? sharedSnap.leaders[key].trim() : null;
  // A leader may also be an employee with review assignments — carry empId so
  // reconcileRoleSubscriptions can additionally wire their reviewer-side data.
  if (dept) return { role: 'leader', dept, empId };
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

  if (info.role === 'director') {
    // Read-only over the full canonical tree (same reads as a manager; the
    // rules deny every write). empId is part of the sig so we re-wire to add
    // their own assignment-side data once emailToEmpId resolves.
    const sig = `director:${info.empId || 'none'}`;
    if (sig === roleSig) return;
    roleSig = sig;
    clearUnsubs(roleUnsubs);
    clearAssignmentSubs();
    COLLECTIONS_DIRECTOR.forEach(key => {
      roleUnsubs.push(onValue(ref(db, `${BASE}/${key}`), snap => onDataCb(key, snap.val()),
        err => console.error(`RTDB read failed for /${BASE}/${key}:`, err)));
    });
    // Additive: a director who is also an employee gets their own "Đánh giá của
    // tôi" page wired on top of the read-only tree (assignments/myReviews only —
    // memberResults/selfResponses already arrived in full above).
    if (info.empId) wireAssignmentSubs(info.empId, { ownResult: false });
    return;
  }

  if (info.role === 'leader') {
    // A leader may ALSO be an employee with review assignments (e.g. a dept
    // lead who cross-reviews people in other depts). empId is part of the sig
    // so that when emailToEmpId resolves late we re-wire to pick up their
    // assignment-side data on top of the dept view.
    const sig = `leader:${info.dept}:${info.empId || 'none'}`;
    if (sig === roleSig) return;
    roleSig = sig;
    clearUnsubs(roleUnsubs);
    clearAssignmentSubs();
    // Leaders read the per-dept mirrors; map them back onto the canonical
    // state keys (employees/reviews/finals) so the views are role-agnostic.
    const map = {
      employeesByDept: 'employees',
      reviewsByDept: 'reviews',
      finalsByDept: 'finals',
      finalCommentsByDept: 'finalComments',
    };
    COLLECTIONS_LEADER.forEach(key => {
      roleUnsubs.push(onValue(ref(db, `${BASE}/${key}/${info.dept}`),
        snap => onDataCb(map[key], snap.val()),
        err => console.error(`RTDB read failed for /${BASE}/${key}/${info.dept}:`, err)));
    });
    // Additive: load the leader's own assignments + own reviews so the
    // "Đánh giá của tôi" page works for them too (state.assignments /
    // state.myReviews stay separate from the dept slices above).
    if (info.empId) wireAssignmentSubs(info.empId);
    return;
  }

  // reviewer — needs an empId to read its assignments.
  if (!info.empId) { roleSig = 'reviewer:none'; clearUnsubs(roleUnsubs); clearAssignmentSubs(); onDataCb('assignments', null); return; }
  const sig = `reviewer:${info.empId}`;
  if (sig === roleSig) return;
  roleSig = sig;
  clearUnsubs(roleUnsubs);
  wireAssignmentSubs(info.empId);
}

// Keep track of which (empId) review paths we're currently subscribed to, so
// we only re-subscribe when the assignment set changes.
let reviewerAssignedIds = '';
let assignmentsUnsub = null;
let reviewSubs = [];

function clearAssignmentSubs() {
  if (assignmentsUnsub) { assignmentsUnsub(); assignmentsUnsub = null; }
  clearUnsubs(reviewSubs);
  reviewerAssignedIds = '';
}

// Subscribe the current user's own assignment list (reverse-index) + their own
// review of each assignee + their own finalized result snapshot. Used by both
// reviewers and leader-reviewers. The caller has already set roleSig and
// cleared roleUnsubs; the unsubs are registered so they're torn down on the
// next role change.
function wireAssignmentSubs(empId, { ownResult = true } = {}) {
  clearAssignmentSubs();

  // Each change to the assignment list re-derives which reviews we must read.
  assignmentsUnsub = onValue(ref(db, `${BASE}/assignments/${empId}`), snap => {
    const val = snap.val() || {};
    onDataCb('assignments', val);
    rewireReviewSubs(empId, Object.keys(val));
  }, err => console.error(`RTDB read failed for /${BASE}/assignments/${empId}:`, err));
  roleUnsubs.push(() => clearAssignmentSubs());

  // ownResult=false: skip memberResults/selfResponses — used by the director
  // branch, which already subscribes those nodes in full via COLLECTIONS_DIRECTOR;
  // subscribing the $empId-scoped path here would fire onDataCb with just
  // { [empId]: val } and clobber the full-tree state (state[key] is a full
  // replace, not a merge — see store.js onData).
  if (!ownResult) return;

  // Own finalized-result snapshot (written by the manager at PAS submit).
  // Emitted as { empId: snapshot } so state.memberResults has the same shape
  // for every role (managers subscribe the whole node).
  roleUnsubs.push(onValue(ref(db, `${BASE}/memberResults/${empId}`), snap => {
    const val = snap.val();
    onDataCb('memberResults', val ? { [empId]: val } : {});
  }, err => console.error(`RTDB read failed for /${BASE}/memberResults/${empId}:`, err)));

  // Own self-assessment (imported from PAS) — the reviewee compares it against
  // their manager's final result on the "Kết quả của tôi" page. Same
  // { empId: … } shape as memberResults so state.selfResponses is role-agnostic.
  roleUnsubs.push(onValue(ref(db, `${BASE}/selfResponses/${empId}`), snap => {
    const val = snap.val();
    onDataCb('selfResponses', val ? { [empId]: val } : {});
  }, err => console.error(`RTDB read failed for /${BASE}/selfResponses/${empId}:`, err)));
}

// Subscribe reviews/$empId/$myId for each assigned employee. Builds the
// current user's own-review map state.myReviews as { empId: { myId: review } }
// (kept separate from the dept/full state.reviews tree).
function rewireReviewSubs(myId, assignedEmpIds) {
  const sigIds = assignedEmpIds.slice().sort().join(',');
  if (sigIds === reviewerAssignedIds) return;
  reviewerAssignedIds = sigIds;
  clearUnsubs(reviewSubs);

  const collected = {};
  if (assignedEmpIds.length === 0) { onDataCb('myReviews', {}); return; }
  assignedEmpIds.forEach(empId => {
    reviewSubs.push(onValue(ref(db, `${BASE}/reviews/${empId}/${myId}`), snap => {
      const r = snap.val();
      if (r) collected[empId] = { [myId]: r };
      else delete collected[empId];
      // emit a fresh shallow copy so the store replaces state.myReviews
      onDataCb('myReviews', { ...collected });
    }, err => console.error(`RTDB read failed for /${BASE}/reviews/${empId}/${myId}:`, err)));
  });
}

function unsubscribeAll() {
  clearUnsubs(sharedUnsubs);
  clearUnsubs(roleUnsubs);
  clearAssignmentSubs();
  roleSig = null;
  sharedSnap.managers = {}; sharedSnap.leaders = {}; sharedSnap.directors = {}; sharedSnap.emailToEmpId = {};
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

  // Manager-only backfill: stamp reviewerName onto existing reviews that lack
  // it, in BOTH the canonical node and the per-dept mirror, so leaders can
  // display cross-dept reviewers' names. entries: [{ empId, dept, reviewerId, name }].
  // Idempotent — callers pass only the reviews still missing a name.
  async backfillReviewerNames(entries) {
    if (!entries || !entries.length) return;
    const updates = {};
    entries.forEach(({ empId, dept, reviewerId, name }) => {
      if (!name) return;
      updates[`${BASE}/reviews/${empId}/${reviewerId}/reviewerName`] = name;
      if (dept) updates[`${BASE}/reviewsByDept/${dept}/${empId}/${reviewerId}/reviewerName`] = name;
    });
    if (Object.keys(updates).length) await update(ref(db), updates);
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

  // Manager's final comment (sent to PAS). Mirrored per-dept so leaders can
  // read (view-only) their own members' final comments. null clears the entry.
  async setFinalComment(empId, val) {
    const dept = await deptOf(empId);
    const updates = { [`${BASE}/finalComments/${empId}`]: val };
    if (dept) updates[`${BASE}/finalCommentsByDept/${dept}/${empId}`] = val;
    await update(ref(db), updates);
  },

  // Merge Assessment IDs onto existing employees. A single multi-path update
  // whose paths are EXCLUSIVELY employees/$empId/assessmentId (+ the dept
  // mirror) — nothing else is written, so reviews/finals/assignments are
  // untouched. entries: [{ empId, dept, assessmentId }].
  async setAssessmentIds(entries) {
    const updates = {};
    for (const e of entries) {
      // Prefer the dept carried in the entry; fall back to the canonical node
      // so the leader mirror stays in sync even if the caller omitted it.
      const dept = (e.dept || '').trim() || await deptOf(e.empId);
      updates[`${BASE}/employees/${e.empId}/assessmentId`] = e.assessmentId;
      if (dept) updates[`${BASE}/employeesByDept/${dept}/${e.empId}/assessmentId`] = e.assessmentId;
    }
    if (Object.keys(updates).length) await update(ref(db), updates);
  },

  // Audit record of a push to PAS + the member-facing result snapshot
  // (memberResults/$empId is the ONLY finals-derived node the reviewee can
  // read — it carries aggregated finals only, never per-reviewer data).
  // Written atomically so the "đã chốt" flag and what the member sees can't
  // drift apart.
  recordPasSubmission(empId, rec, snapshot) {
    return update(ref(db), {
      [`${BASE}/pasSubmissions/${empId}`]: rec,
      [`${BASE}/memberResults/${empId}`]: snapshot,
    });
  },

  // Manager-only backfill: employees pushed to PAS before memberResults
  // existed get their snapshot recreated so they can see their result.
  // entries: [{ empId, snapshot }]. Idempotent — callers pass only the
  // submissions still missing a snapshot.
  async backfillMemberResults(entries) {
    if (!entries || !entries.length) return;
    const updates = {};
    entries.forEach(({ empId, snapshot }) => {
      updates[`${BASE}/memberResults/${empId}`] = snapshot;
    });
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
