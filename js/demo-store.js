/* ═══════════════════════════════════════════════════════════════
   DEMO BACKEND — localStorage-backed mock of the Firebase backend.
   Enabled with ?demo=1. Lets you walk every screen without
   Firebase credentials. Seed data mirrors the design prototype.
═══════════════════════════════════════════════════════════════ */

import { STATUS, ROLE, COLLECTIONS_SHARED } from './constants.js';
import { DEFAULT_BANDS } from './store.js';
import { encodeEmailKey } from './auth.js';

const KEY = 'madison_pr_demo_v5';
const AUTH_KEY = 'madison_pr_demo_auth';

const DEMO_ACCOUNTS = [
  { name: 'Trần Minh Anh', email: 'minhanh@madison.tech', role: ROLE.MANAGER, title: 'Head of People' },
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
    e1: { name: 'Phạm Tuấn Kiệt', email: 'kiet@madison.tech', title: 'Frontend Engineer', dept: 'Engineering', order: 0, reviewerIds: { e_lan: true, e_huy: true } },
    e2: { name: 'Đỗ Thu Hà', email: 'ha@madison.tech', title: 'Backend Engineer', dept: 'Engineering', order: 1, reviewerIds: { e_lan: true } },
    e3: { name: 'Vũ Đức Thắng', email: 'thang@madison.tech', title: 'Product Designer', dept: 'Product', order: 2, reviewerIds: { e_huy: true } },
    e4: { name: 'Bùi Khánh Linh', email: 'linh@madison.tech', title: 'Product Manager', dept: 'Product', order: 3, reviewerIds: { e_huy: true, e_mgr: true } },
    e5: { name: 'Hoàng Nam', email: 'nam@madison.tech', title: 'QA Engineer', dept: 'Engineering', order: 4, reviewerIds: { e_lan: true } },
    e6: { name: 'Ngô Mỹ Duyên', email: 'duyen@madison.tech', title: 'Data Analyst', dept: 'Data', order: 5, reviewerIds: {} },
    e_lan: { name: 'Nguyễn Thị Lan', email: 'lan@madison.tech', title: 'Engineering Lead', dept: 'Engineering', order: 6, reviewerIds: {} },
    e_huy: { name: 'Lê Quang Huy', email: 'huy@madison.tech', title: 'Product Lead', dept: 'Product', order: 7, reviewerIds: {} },
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
  };

  return {
    groups,
    employees,
    reviews,
    finals: {},
    groupWeights: { g1: 43, g2: 30, g3: 27 },
    bands: DEFAULT_BANDS.map(b => ({ ...b })),
    managers: { 'minhanh@madison,tech': true },
    leaders: { 'lan@madison,tech': 'Engineering' },
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
  const leaderDept = !isManager && typeof (data.leaders || {})[key] === 'string'
    ? data.leaders[key].trim() : null;

  if (isManager) {
    handlers.onData('employees', clone(data.employees));
    handlers.onData('reviews', clone(data.reviews));
    handlers.onData('finals', clone(data.finals));
    return;
  }

  if (leaderDept) {
    // per-dept slice of each node
    const emps = {}, revs = {}, fins = {};
    Object.entries(data.employees || {}).forEach(([id, e]) => {
      if ((e.dept || '').trim() === leaderDept) {
        emps[id] = e;
        if (data.reviews[id]) revs[id] = data.reviews[id];
        if (data.finals[id]) fins[id] = data.finals[id];
      }
    });
    handlers.onData('employees', clone(emps));
    handlers.onData('reviews', clone(revs));
    handlers.onData('finals', clone(fins));
    // A leader may also be an employee with review assignments — emit their
    // reviewer-side data on top of the dept view (separate state slices).
    emitAssignmentSide(emailToEmpId[key] || null);
    return;
  }

  // reviewer — assignments + only their own reviews of assigned employees
  emitAssignmentSide(emailToEmpId[key] || null);
}

// Emit the current user's reviewer-side slices: their assignment reverse-index
// and their own reviews of each assignee (state.assignments / state.myReviews).
function emitAssignmentSide(myId) {
  const assignments = myId ? (deriveAssignments(data.employees)[myId] || {}) : {};
  handlers.onData('assignments', clone(assignments));
  const myReviews = {};
  Object.keys(assignments).forEach(empId => {
    const r = data.reviews[empId] && data.reviews[empId][myId];
    if (r) myReviews[empId] = { [myId]: r };
  });
  handlers.onData('myReviews', clone(myReviews));
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
