/* ═══════════════════════════════════════════════════════════════
   DEMO BACKEND — localStorage-backed mock of the Firebase backend.
   Enabled with ?demo=1. Lets you walk every screen without
   Firebase credentials. Seed data mirrors the design prototype.
═══════════════════════════════════════════════════════════════ */

import { STATUS, ROLE, COLLECTIONS_SHARED } from './constants.js';
import { DEFAULT_BANDS } from './store.js';
import { encodeEmailKey } from './auth.js';

const KEY = 'madison_pr_demo_v7';
const AUTH_KEY = 'madison_pr_demo_auth';

const DEMO_ACCOUNTS = [
  { name: 'Trần Minh Anh', email: 'minhanh@madison.tech', role: ROLE.MANAGER, title: 'Head of People' },
  { name: 'Phan Vũ Đăng', email: 'dang@madison.tech', role: ROLE.DIRECTOR, title: 'Director' },
  { name: 'Nguyễn Thị Lan', email: 'lan@madison.tech', role: ROLE.LEADER, title: 'Engineering Lead' },
  { name: 'Lê Quang Huy', email: 'huy@madison.tech', role: ROLE.REVIEWER, title: 'Product Lead' },
];

function seed() {
  const groups = [
    {
      id: 'g1', name: 'Năng lực chuyên môn',
      items: [
        { id: 'q1', text: 'Chất lượng công việc', hint: 'Sản phẩm bàn giao chính xác, ít lỗi, đạt chuẩn kỳ vọng của vị trí.' },
        { id: 'q2', text: 'Kiến thức chuyên môn', hint: 'Nắm vững kiến thức cần thiết và liên tục cập nhật kỹ năng mới.' },
        { id: 'q3', text: 'Năng suất & hiệu quả', hint: 'Hoàn thành khối lượng công việc hợp lý trong thời hạn cam kết.' },
      ],
    },
    {
      id: 'g2', name: 'Kỹ năng làm việc',
      items: [
        { id: 'q4', text: 'Làm việc nhóm', hint: 'Hợp tác, hỗ trợ đồng nghiệp và đóng góp tích cực vào mục tiêu chung.' },
        { id: 'q5', text: 'Giao tiếp', hint: 'Truyền đạt rõ ràng, lắng nghe và phản hồi mang tính xây dựng.' },
        { id: 'q6', text: 'Giải quyết vấn đề', hint: 'Chủ động xác định vấn đề và đưa ra giải pháp khả thi.' },
      ],
    },
    {
      id: 'g3', name: 'Thái độ & Văn hóa',
      items: [
        { id: 'q7', text: 'Tinh thần trách nhiệm', hint: 'Chịu trách nhiệm với công việc và cam kết của bản thân.' },
        { id: 'q8', text: 'Phù hợp văn hóa', hint: 'Thể hiện và lan tỏa các giá trị cốt lõi của Madison.' },
      ],
    },
  ];

  const employees = {
    e1: { name: 'Phạm Tuấn Kiệt', email: 'kiet@madison.tech', title: 'Frontend Engineer', dept: 'Engineering', order: 0, reviewerIds: { e_lan: true, e_huy: true }, assessmentId: 'demo-assess-e1' },
    e2: { name: 'Đỗ Thu Hà', email: 'ha@madison.tech', title: 'Backend Engineer', dept: 'Engineering', order: 1, reviewerIds: { e_lan: true } },
    e3: { name: 'Vũ Đức Thắng', email: 'thang@madison.tech', title: 'Product Designer', dept: 'Product', order: 2, reviewerIds: { e_huy: true } },
    e4: { name: 'Bùi Khánh Linh', email: 'linh@madison.tech', title: 'Product Manager', dept: 'Product', order: 3, reviewerIds: { e_huy: true, e_mgr: true } },
    e5: { name: 'Hoàng Nam', email: 'nam@madison.tech', title: 'QA Engineer', dept: 'Engineering', order: 4, reviewerIds: { e_lan: true } },
    e6: { name: 'Ngô Mỹ Duyên', email: 'duyen@madison.tech', title: 'Data Analyst', dept: 'Data', order: 5, reviewerIds: {} },
    e_lan: { name: 'Nguyễn Thị Lan', email: 'lan@madison.tech', title: 'Engineering Lead', dept: 'Engineering', order: 6, reviewerIds: {} },
    e_huy: { name: 'Lê Quang Huy', email: 'huy@madison.tech', title: 'Product Lead', dept: 'Product', order: 7, reviewerIds: { e_lan: true } },
    e_mgr: { name: 'Trần Minh Anh', email: 'minhanh@madison.tech', title: 'Head of People', dept: 'People', order: 8, reviewerIds: {} },
  };

  // comments: map of question-index → per-question comment text
  function mkReview(scores, status, comments, overallComment) {
    const answers = {};
    let i = 0;
    groups.forEach(g => g.items.forEach(q => {
      const entry = {};
      if (scores[i] != null) entry.score = scores[i];
      if (comments && comments[i]) entry.comment = comments[i];
      if (Object.keys(entry).length) answers[q.id] = entry;
      i++;
    }));
    return {
      status, answers,
      overallComment: overallComment || null,
      updatedAt: Date.now() - 86400000,
      submittedAt: status === STATUS.SUBMITTED ? Date.now() - 86400000 : null,
    };
  }

  const reviews = {
    e1: {
      e_lan: mkReview([5, 4, 5, 4, 5, 4, 5, 4], STATUS.SUBMITTED,
        {
          0: 'Code sạch, ít lỗi, review PR rất kỹ. Bàn giao đúng chuẩn.',
          2: 'Hoàn thành sprint đều đặn, ước lượng thời gian ngày càng chính xác.',
          4: 'Trình bày rõ ràng trong standup, tài liệu kỹ thuật dễ theo dõi.',
          6: 'Luôn nhận phần việc khó và theo tới cùng, rất đáng tin cậy.',
        },
        'Một năm rất ấn tượng. Kiệt làm chủ tốt phần frontend, chất lượng bàn giao cao và luôn sẵn sàng hỗ trợ đồng đội. Điểm cần phát triển là chủ động dẫn dắt các quyết định kỹ thuật lớn hơn trong năm tới.'),
      e_huy: mkReview([4, 4, 4, 5, 4, 5, 4, 4], STATUS.SUBMITTED,
        {
          0: 'Sản phẩm bàn giao ổn định, hiếm khi phải sửa lại sau khi release.',
          3: 'Phối hợp với team product rất ăn ý, chủ động hỏi để hiểu đúng yêu cầu.',
          5: 'Tiếp cận vấn đề có hệ thống, đề xuất giải pháp khả thi và gọn gàng.',
        },
        'Phối hợp với product rất ăn ý và đáng tin cậy về tiến độ. Nên tự tin trình bày quan điểm sớm hơn trong các buổi thảo luận để tạo ảnh hưởng nhiều hơn.'),
    },
    e2: {
      e_lan: mkReview([4, 5, 4, 4, 3, 4, 4, 4], STATUS.DRAFT, null),
    },
    e_huy: {
      e_lan: mkReview([4, 5, 4, 4, 5, 4, 5, 5], STATUS.SUBMITTED, null,
        'Huy dẫn dắt team product vững vàng, ưu tiên đúng việc và giao tiếp rõ ràng với các bên.'),
    },
  };

  const groupWeights = { g1: 43, g2: 30, g3: 27 };

  // The reviewer demo account (Huy) is also a reviewee whose result was
  // already finalized and pushed to PAS, so "Kết quả của tôi" is populated
  // on first load. Snapshot mirrors buildMemberResultSnapshot(): per-question
  // finals (single reviewer → their scores), weighted total, band, comment.
  const huyScores = [4, 5, 4, 4, 5, 4, 5, 5];
  const huyResult = { scores: {}, finalizedAt: Date.now() - 3600000 };
  let hi = 0, weighted = 0;
  groups.forEach(g => {
    let sum = 0;
    g.items.forEach(q => { huyResult.scores[q.id] = huyScores[hi]; sum += huyScores[hi]; hi++; });
    weighted += (sum / g.items.length) * (groupWeights[g.id] / 100);
  });
  huyResult.weightedFinal = weighted;
  const huyBand = DEFAULT_BANDS.find(b => weighted >= b.min && weighted <= b.max);
  if (huyBand) { huyResult.bandId = huyBand.id; huyResult.bandLabel = huyBand.label; }
  huyResult.finalComment = 'Năm làm việc chắc chắn của Huy: sản phẩm ra đúng lộ trình, team gắn kết. Kỳ tới tập trung xây năng lực kế thừa cho các bạn junior.';

  // Huy's own PAS self-assessment (imported) — deliberately a bit more modest
  // than the manager's finals so the side-by-side comparison is visible.
  const huySelfScores = [4, 4, 4, 4, 4, 3, 5, 5];
  const huySelf = { scores: {}, totalScore: null };
  let si = 0, selfWeighted = 0;
  groups.forEach(g => {
    let sum = 0;
    g.items.forEach(q => { huySelf.scores[q.id] = huySelfScores[si]; sum += huySelfScores[si]; si++; });
    selfWeighted += (sum / g.items.length) * (groupWeights[g.id] / 100);
  });
  huySelf.totalScore = Math.round(selfWeighted * 100) / 100;
  huySelf.comment = 'Em tự thấy năm nay hoàn thành tốt phần công việc được giao, sản phẩm ổn định. Về giao tiếp và trình bày quan điểm trong các buổi thảo luận em vẫn còn hơi ngại nên tự chấm khiêm tốn, sẽ cố gắng chủ động hơn ở kỳ tới.';

  return {
    groups,
    employees,
    reviews,
    finals: {},
    finalComments: { e_huy: { text: huyResult.finalComment, updatedAt: huyResult.finalizedAt } },
    pasSubmissions: { e_huy: { submittedAt: huyResult.finalizedAt, by: 'minhanh@madison.tech' } },
    memberResults: { e_huy: huyResult },
    selfResponses: { e_huy: huySelf },
    groupWeights,
    bands: DEFAULT_BANDS.map(b => ({ ...b })),
    managers: { 'minhanh@madison,tech': true },
    leaders: { 'lan@madison,tech': 'Engineering' },
    directors: { 'dang@madison,tech': true },
  };
}

/* Derive the RBAC mirrors/indexes the real backend stores alongside the
   canonical nodes, so the demo emits the same shape per role. */
function deriveEmailToEmpId(employees) {
  const out = {};
  Object.entries(employees || {}).forEach(([id, e]) => { out[encodeEmailKey(e.email)] = id; });
  return out;
}
function deriveAssignments(employees) {
  const out = {};
  Object.entries(employees || {}).forEach(([id, e]) => {
    Object.keys(e.reviewerIds || {}).forEach(rid => {
      if (!out[rid]) out[rid] = {};
      out[rid][id] = { empId: id, name: e.name || '', title: e.title || '', dept: (e.dept || '').trim() };
    });
  });
  return out;
}
function deptOf(employees, empId) { return ((employees[empId] || {}).dept || '').trim(); }

let data = load();
let handlers = null;
let currentEmail = null;   // demo account currently signed in

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted → reseed */ }
  const s = seed();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  return s;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
}
function clone(v) { return JSON.parse(JSON.stringify(v ?? null)); }

// Stamp reviewerName onto each review (mirrors production, where saveReview +
// the manager backfill embed the reviewer's name into reviews/reviewsByDept so
// leaders can show cross-dept reviewers' names). Returns a fresh clone.
function withReviewerNames(reviewsMap) {
  const out = clone(reviewsMap) || {};
  Object.entries(out).forEach(([, byReviewer]) => {
    Object.entries(byReviewer || {}).forEach(([rid, review]) => {
      if (review && !review.reviewerName) review.reviewerName = (data.employees[rid] || {}).name || '';
    });
  });
  return out;
}

// Emit the same per-role view the real backend (RBAC rules + role-scoped
// subscriptions) would expose, so demo mode faithfully reproduces what each
// role can and cannot see.
function emitAll() {
  if (!handlers) return;

  // Shared nodes — everyone signed in receives these.
  const emailToEmpId = deriveEmailToEmpId(data.employees);
  const shared = { ...data, emailToEmpId };
  COLLECTIONS_SHARED.forEach(key => handlers.onData(key, clone(shared[key])));

  if (!currentEmail) return;
  const key = encodeEmailKey(currentEmail.toLowerCase());
  const isManager = !!(data.managers || {})[key];
  const isDirector = !isManager && !!(data.directors || {})[key];
  const leaderDept = !isManager && !isDirector && typeof (data.leaders || {})[key] === 'string'
    ? data.leaders[key].trim() : null;

  if (isManager) {
    handlers.onData('employees', clone(data.employees));
    handlers.onData('reviews', withReviewerNames(data.reviews));
    handlers.onData('finals', clone(data.finals));
    handlers.onData('finalComments', clone(data.finalComments || {}));
    handlers.onData('pasSubmissions', clone(data.pasSubmissions || {}));
    handlers.onData('memberResults', clone(data.memberResults || {}));
    handlers.onData('selfResponses', clone(data.selfResponses || {}));
    return;
  }

  if (isDirector) {
    // Read-only over the full canonical tree, INCLUDING memberResults/
    // selfResponses (so a director can view every employee's finalized result
    // + self-assessment, same shape as the manager's read). Only pasSubmissions
    // (audit metadata) stays manager-only. Assignment-side (own assignments/
    // myReviews) is still wired for a director who is also an employee, but we
    // skip its memberResults/selfResponses emit here since the full-tree emit
    // above already covers every empId including their own.
    handlers.onData('employees', clone(data.employees));
    handlers.onData('reviews', withReviewerNames(data.reviews));
    handlers.onData('finals', clone(data.finals));
    handlers.onData('finalComments', clone(data.finalComments || {}));
    handlers.onData('memberResults', clone(data.memberResults || {}));
    handlers.onData('selfResponses', clone(data.selfResponses || {}));
    const myId = emailToEmpId[key] || null;
    const assignments = myId ? (deriveAssignments(data.employees)[myId] || {}) : {};
    handlers.onData('assignments', clone(assignments));
    const myReviews = {};
    Object.keys(assignments).forEach(empId => {
      const r = data.reviews[empId] && data.reviews[empId][myId];
      if (r) myReviews[empId] = { [myId]: r };
    });
    handlers.onData('myReviews', clone(myReviews));
    return;
  }

  if (leaderDept) {
    // per-dept slice of each node
    const emps = {}, revs = {}, fins = {}, fcs = {};
    Object.entries(data.employees || {}).forEach(([id, e]) => {
      if ((e.dept || '').trim() === leaderDept) {
        emps[id] = e;
        if (data.reviews[id]) revs[id] = data.reviews[id];
        if (data.finals[id]) fins[id] = data.finals[id];
        if (data.finalComments && data.finalComments[id]) fcs[id] = data.finalComments[id];
      }
    });
    handlers.onData('employees', clone(emps));
    handlers.onData('reviews', withReviewerNames(revs));
    handlers.onData('finals', clone(fins));
    handlers.onData('finalComments', clone(fcs));
    // A leader may also be an employee with review assignments — emit their
    // reviewer-side data on top of the dept view (separate state slices).
    emitAssignmentSide(emailToEmpId[key] || null);
    return;
  }

  // reviewer — assignments + only their own reviews of assigned employees
  emitAssignmentSide(emailToEmpId[key] || null);
}

// Emit the current user's reviewer-side slices: their assignment reverse-index,
// their own reviews of each assignee (state.assignments / state.myReviews),
// and their own finalized-result snapshot (state.memberResults[myId]).
function emitAssignmentSide(myId) {
  const assignments = myId ? (deriveAssignments(data.employees)[myId] || {}) : {};
  handlers.onData('assignments', clone(assignments));
  const myReviews = {};
  Object.keys(assignments).forEach(empId => {
    const r = data.reviews[empId] && data.reviews[empId][myId];
    if (r) myReviews[empId] = { [myId]: r };
  });
  handlers.onData('myReviews', clone(myReviews));
  const mine = myId && (data.memberResults || {})[myId];
  handlers.onData('memberResults', mine ? { [myId]: clone(mine) } : {});
  const mySelf = myId && (data.selfResponses || {})[myId];
  handlers.onData('selfResponses', mySelf ? { [myId]: clone(mySelf) } : {});
}
function mutate(fn) { fn(data); persist(); emitAll(); }

export const backend = {
  isDemo: true,
  demoAccounts: DEMO_ACCOUNTS,

  async init(h) {
    handlers = h;
    const email = localStorage.getItem(AUTH_KEY);
    const acc = DEMO_ACCOUNTS.find(a => a.email === email);
    if (acc) {
      currentEmail = acc.email;
      emitAll();
      handlers.onAuth({ email: acc.email, name: acc.name });
    } else {
      currentEmail = null;
      handlers.onAuth(null);
    }
  },

  // Real backend opens the Microsoft popup; demo shows an account picker
  // in the login view, which calls loginAs().
  async login() { throw new Error('demo: use loginAs()'); },

  loginAs(email) {
    const acc = DEMO_ACCOUNTS.find(a => a.email === email);
    if (!acc) return;
    localStorage.setItem(AUTH_KEY, email);
    currentEmail = acc.email;
    emitAll();
    handlers.onAuth({ email: acc.email, name: acc.name });
  },

  async logout() {
    localStorage.removeItem(AUTH_KEY);
    currentEmail = null;
    handlers.onAuth(null);
  },

  saveReview(empId, reviewerId, review) {
    mutate(d => {
      if (!d.reviews[empId]) d.reviews[empId] = {};
      d.reviews[empId][reviewerId] = review;
    });
  },

  assignReviewers(empId, reviewerIdsMap, removedIds) {
    mutate(d => {
      if (d.employees[empId]) d.employees[empId].reviewerIds = reviewerIdsMap;
      removedIds.forEach(rid => { if (d.reviews[empId]) delete d.reviews[empId][rid]; });
    });
  },

  setFinal(empId, qid, score) {
    mutate(d => {
      if (!d.finals[empId]) d.finals[empId] = {};
      d.finals[empId][qid] = { score, edited: true };
    });
  },
  resetFinal(empId, qid) {
    mutate(d => { if (d.finals[empId]) delete d.finals[empId][qid]; });
  },
  resetAllFinals(empId) {
    mutate(d => { delete d.finals[empId]; });
  },

  setFinalComment(empId, val) {
    mutate(d => {
      if (!d.finalComments) d.finalComments = {};
      if (val) d.finalComments[empId] = val; else delete d.finalComments[empId];
    });
  },

  setAssessmentIds(entries) {
    mutate(d => {
      entries.forEach(e => { if (d.employees[e.empId]) d.employees[e.empId].assessmentId = e.assessmentId; });
    });
  },

  recordPasSubmission(empId, rec, snapshot) {
    mutate(d => {
      if (!d.pasSubmissions) d.pasSubmissions = {};
      d.pasSubmissions[empId] = rec;
      if (!d.memberResults) d.memberResults = {};
      d.memberResults[empId] = snapshot;
    });
  },

  backfillMemberResults(entries) {
    mutate(d => {
      if (!d.memberResults) d.memberResults = {};
      entries.forEach(({ empId, snapshot }) => { d.memberResults[empId] = snapshot; });
    });
  },

  setGroupWeight(groupId, weight) {
    mutate(d => {
      if (!d.groupWeights) d.groupWeights = {};
      d.groupWeights[groupId] = weight;
    });
  },

  importQuestions(groups) {
    mutate(d => { d.groups = groups; d.reviews = {}; d.finals = {}; });
  },
  importEmployees(list) {
    mutate(d => {
      const map = {};
      list.forEach(e => { const { id, ...rest } = e; map[id] = rest; });
      d.employees = map; d.reviews = {}; d.finals = {};
    });
  },
};
