/* ═══════════════════════════════════════════════════════════════
   STORE — in-memory state mirrored from the backend
   (Firebase Realtime DB, or localStorage in demo mode).
   Views read `state`, call write helpers, and re-render on notify.
═══════════════════════════════════════════════════════════════ */

export const state = {
  authReady: false,
  authUser: null,        // { email, name } | null
  dataReady: false,
  groups: [],            // [{ id, name, items: [{ id, text, hint }] }]
  employees: [],         // [{ id, name, email, title, dept, order, reviewerIds: {empId:true} }]
  reviews: {},           // { empId: { reviewerEmpId: { status, answers, updatedAt, submittedAt } } }
  finals: {},            // { empId: { qid: { score, edited: true } } }  — manager overrides only
  managers: {},          // { emailKey: true }
  leaders: {},           // { emailKey: '<dept name>' }
};

let backend = null;
const subs = new Set();

export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }
function notify() { subs.forEach(cb => cb()); }

export function getBackend() { return backend; }

export async function initStore(b) {
  backend = b;
  await backend.init({
    onAuth(user) {
      state.authUser = user;
      state.authReady = true;
      if (!user) {
        state.dataReady = false;
        state.groups = []; state.employees = []; state.reviews = {}; state.finals = {}; state.managers = {}; state.leaders = {};
      }
      notify();
    },
    onData(key, val) {
      if (key === 'groups') {
        state.groups = (val || []).filter(Boolean).map(g => ({ ...g, items: (g.items || []).filter(Boolean) }));
      } else if (key === 'employees') {
        state.employees = Object.entries(val || {})
          .map(([id, e]) => ({ id, dept: '', title: '', ...e, reviewerIds: e.reviewerIds || {} }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      } else {
        state[key] = val || {};
      }
      state.dataReady = true;
      notify();
    },
  });
}

/* ═══════════ Computed helpers ═══════════ */

export function allQuestionIds(groups = state.groups) {
  const ids = [];
  groups.forEach(g => g.items.forEach(q => ids.push(q.id)));
  return ids;
}

export function reviewerIdsOf(emp) { return Object.keys(emp.reviewerIds || {}); }

export function reviewOf(empId, reviewerId) {
  return (state.reviews[empId] && state.reviews[empId][reviewerId]) || null;
}

// Average of submitted reviewers' scores for one question
export function avgForQuestion(empId, qid) {
  const empReviews = state.reviews[empId] || {};
  const vals = [];
  Object.values(empReviews).forEach(r => {
    const a = r && r.status === 'submitted' && r.answers && r.answers[qid];
    if (a && a.score != null) vals.push(a.score);
  });
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Final score for one question = manager override ?? auto average
export function finalForQuestion(empId, qid) {
  const o = state.finals[empId] && state.finals[empId][qid];
  if (o && o.edited && o.score != null) return { score: o.score, edited: true };
  const avg = avgForQuestion(empId, qid);
  return { score: avg == null ? null : Math.round(avg * 10) / 10, edited: false };
}

// Overall average of finals across all questions
export function empAvg(empId) {
  const vals = allQuestionIds().map(qid => finalForQuestion(empId, qid).score).filter(v => v != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
}

// Final scores must end up as integers 1–5; fractional auto-averages
// need a manager round-off pass.
export function isFractional(v) { return v != null && !Number.isInteger(v); }

export function fractionalQuestionsOf(empId) {
  return allQuestionIds().filter(qid => isFractional(finalForQuestion(empId, qid).score));
}

export function empProgress(emp) {
  const assigned = reviewerIdsOf(emp);
  const r = state.reviews[emp.id] || {};
  const submitted = assigned.filter(id => r[id] && r[id].status === 'submitted').length;
  const drafts = assigned.filter(id => r[id] && r[id].status === 'draft').length;
  return { assigned: assigned.length, submitted, drafts };
}

export function answeredCount(review, qids = allQuestionIds()) {
  if (!review || !review.answers) return 0;
  return qids.filter(q => review.answers[q] && review.answers[q].score != null).length;
}

/* ═══════════ Write helpers (delegate to backend) ═══════════ */

// Strip unanswered/empty entries — RTDB drops nulls anyway, keep it clean
function sanitizeAnswers(answers) {
  const out = {};
  Object.entries(answers || {}).forEach(([qid, a]) => {
    if (!a) return;
    const entry = {};
    if (a.score != null) entry.score = a.score;
    if (a.comment && a.comment.trim()) entry.comment = a.comment;
    if (Object.keys(entry).length) out[qid] = entry;
  });
  return out;
}

export function saveReview(empId, reviewerId, { status, answers, submittedAt }) {
  return backend.saveReview(empId, reviewerId, {
    status,
    answers: sanitizeAnswers(answers),
    updatedAt: Date.now(),
    submittedAt: status === 'submitted' ? Date.now() : (submittedAt || null),
  });
}

export function assignReviewers(empId, reviewerIds /* array of empIds */) {
  const emp = state.employees.find(e => e.id === empId);
  const prev = emp ? reviewerIdsOf(emp) : [];
  const removed = prev.filter(id => !reviewerIds.includes(id));
  const map = {};
  reviewerIds.forEach(id => { map[id] = true; });
  return backend.assignReviewers(empId, map, removed);
}

export function setFinal(empId, qid, score) {
  if (score == null) return backend.resetFinal(empId, qid);
  // finals must be whole points 1–5
  const v = Math.max(1, Math.min(5, Math.round(score)));
  return backend.setFinal(empId, qid, v);
}
export function resetFinal(empId, qid) { return backend.resetFinal(empId, qid); }
export function resetAllFinals(empId) { return backend.resetAllFinals(empId); }

export function importQuestions(groups) { return backend.importQuestions(groups); }
export function importEmployees(list) { return backend.importEmployees(list); }
