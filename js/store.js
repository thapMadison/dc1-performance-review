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
  groupWeights: {},      // { groupId: weightPercent }  — per-group weight, edited directly in DB
  bands: null,           // [{ id, label, min, max }]  — classification thresholds, edited in DB
  managers: {},          // { emailKey: true }
  leaders: {},           // { emailKey: '<dept name>' }
};

// Default classification bands (used until overridden in the DB under /bands).
export const DEFAULT_BANDS = [
  { id: 'A', label: 'Loại A', min: 4.50, max: 5.00 },
  { id: 'B', label: 'Loại B', min: 4.00, max: 4.49 },
  { id: 'C', label: 'Loại C', min: 3.00, max: 3.99 },
  { id: 'D', label: 'Loại D', min: 2.21, max: 2.99 },
  { id: 'E', label: 'Loại E', min: 1.00, max: 2.20 },
];

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
      } else if (key === 'bands') {
        state.bands = Array.isArray(val) ? val.filter(Boolean) : (val ? Object.values(val) : null);
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

/* ═══════════ Review-period gating ═══════════
   Mirrors js/ui.js reviewPeriodStatus() — kept local (no import from ui.js)
   to avoid a store↔ui dependency cycle. Used by write helpers below to
   reject mutations once the app should be read-only. */

import { APP_DEADLINE_ISO, APP_START_DATE_ISO } from './firebase-config.js';

export function reviewPeriodStatus(nowMs = Date.now()) {
  const start = APP_START_DATE_ISO ? new Date(APP_START_DATE_ISO).getTime() : null;
  const end = new Date(APP_DEADLINE_ISO).getTime();
  const beforeStart = start != null && nowMs < start;
  const expired = nowMs > end;
  return { beforeStart, expired, locked: beforeStart || expired, active: !beforeStart && !expired };
}

// Reviewer-facing write gate: blocked before the period starts AND after
// it ends. (Manager Final-score edits use a separate, looser gate below.)
export function isReviewPeriodOpen(nowMs = Date.now()) {
  return reviewPeriodStatus(nowMs).active;
}

// Manager Final-score edit gate: blocked only before the period starts —
// managers may still adjust Final scores after the deadline.
export function isManagerEditAllowed(nowMs = Date.now()) {
  return !reviewPeriodStatus(nowMs).beforeStart;
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

/* ═══════════ Weighted scoring & classification ═══════════
   Formula (per the design): each question's final score (1–5)
   → raw group average → × group weight = weighted score
   → sum of weighted scores = final result.
   All maths use raw (unrounded) values; views round only for display. */

export const bands = () => state.bands && state.bands.length ? state.bands : DEFAULT_BANDS;

// Weight (%) configured for a group; 0 when not set in the DB.
export function groupWeight(groupId) {
  const w = state.groupWeights && state.groupWeights[groupId];
  return typeof w === 'number' && isFinite(w) ? w : 0;
}

// Raw group average of question finals. Unscored questions count as 0
// (per the design note "Tiêu chí chưa chấm tính điểm 0"), so the divisor
// is the group's total question count. null only for an empty group.
export function groupAvg(empId, group) {
  const items = group.items || [];
  if (!items.length) return null;
  const sum = items.reduce((a, q) => a + (finalForQuestion(empId, q.id).score ?? 0), 0);
  return sum / items.length;
}

// Per-group breakdown for the result overview.
// { group, scored, total, avg, weight, weighted }
export function groupStats(empId) {
  return state.groups.map(g => {
    const total = (g.items || []).length;
    const scored = (g.items || []).filter(q => finalForQuestion(empId, q.id).score != null).length;
    const avg = groupAvg(empId, g);
    const weight = groupWeight(g.id);
    const weighted = avg == null ? null : avg * (weight / 100);
    return { group: g, scored, total, avg, weight, weighted };
  });
}

// Sum of group weights (%). Used to flag when it ≠ 100.
export function totalWeight() {
  return state.groups.reduce((a, g) => a + groupWeight(g.id), 0);
}

// Weighted final = Σ (group raw average × weight%). Raw, unrounded.
// null when there are no groups with questions at all.
export function weightedFinal(empId) {
  const stats = groupStats(empId).filter(s => s.weighted != null);
  if (!stats.length) return null;
  return stats.reduce((a, s) => a + s.weighted, 0);
}

// Classification band for a final score; null when no score / no band matches.
export function classify(score) {
  if (score == null) return null;
  return bands().find(b => score >= b.min && score <= b.max) || null;
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

export function saveReview(empId, reviewerId, { status, answers, overallComment, submittedAt }) {
  // Block reviewer save/submit when review period not open
  if (!isReviewPeriodOpen()) {
    const err = new Error('Kỳ đánh giá đã đóng hoặc chưa bắt đầu');
    err.code = 'PERIOD_LOCKED';
    return Promise.reject(err);
  }
  const oc = overallComment && overallComment.trim() ? overallComment.trim() : null;
  return backend.saveReview(empId, reviewerId, {
    status,
    answers: sanitizeAnswers(answers),
    overallComment: oc,
    updatedAt: Date.now(),
    submittedAt: status === 'submitted' ? Date.now() : (submittedAt || null),
  });
}

// Shared rejection for manager actions blocked before the period starts.
function periodLockedError() {
  const err = new Error('Kỳ đánh giá chưa bắt đầu');
  err.code = 'PERIOD_LOCKED';
  return Promise.reject(err);
}

export function assignReviewers(empId, reviewerIds /* array of empIds */) {
  if (!isManagerEditAllowed()) return periodLockedError();
  const emp = state.employees.find(e => e.id === empId);
  const prev = emp ? reviewerIdsOf(emp) : [];
  const removed = prev.filter(id => !reviewerIds.includes(id));
  const map = {};
  reviewerIds.forEach(id => { map[id] = true; });
  return backend.assignReviewers(empId, map, removed);
}

export function setFinal(empId, qid, score) {
  if (!isManagerEditAllowed()) return periodLockedError();
  if (score == null) return backend.resetFinal(empId, qid);
  // finals must be whole points 1–5
  const v = Math.max(1, Math.min(5, Math.round(score)));
  return backend.setFinal(empId, qid, v);
}
export function resetFinal(empId, qid) {
  if (!isManagerEditAllowed()) return periodLockedError();
  return backend.resetFinal(empId, qid);
}
export function resetAllFinals(empId) {
  if (!isManagerEditAllowed()) return periodLockedError();
  return backend.resetAllFinals(empId);
}

// Per-group weight (%). Clamped to 0–100; manager-only (Bộ câu hỏi page).
export function setGroupWeight(groupId, weight) {
  const w = Math.max(0, Math.min(100, Math.round((Number(weight) || 0) * 100) / 100));
  return backend.setGroupWeight(groupId, w);
}

export function importQuestions(groups) {
  if (!isManagerEditAllowed()) return periodLockedError();
  return backend.importQuestions(groups);
}
export function importEmployees(list) {
  if (!isManagerEditAllowed()) return periodLockedError();
  return backend.importEmployees(list);
}
