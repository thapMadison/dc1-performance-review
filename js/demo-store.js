/* ═══════════════════════════════════════════════════════════════
   DEMO BACKEND — localStorage-backed mock of the Firebase backend.
   Enabled with ?demo=1. Lets you walk every screen without
   Firebase credentials. Seed data mirrors the design prototype.
═══════════════════════════════════════════════════════════════ */

const KEY = 'madison_pr_demo_v2';
const AUTH_KEY = 'madison_pr_demo_auth';

const DEMO_ACCOUNTS = [
  { name: 'Trần Minh Anh', email: 'minhanh@madison.tech', role: 'manager', title: 'Head of People' },
  { name: 'Nguyễn Thị Lan', email: 'lan@madison.tech', role: 'leader', title: 'Engineering Lead' },
  { name: 'Lê Quang Huy', email: 'huy@madison.tech', role: 'reviewer', title: 'Product Lead' },
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

  function mkReview(scores, status, firstComment) {
    const answers = {};
    let i = 0;
    groups.forEach(g => g.items.forEach(q => {
      const entry = {};
      if (scores[i] != null) entry.score = scores[i];
      if (i === 0 && firstComment) entry.comment = firstComment;
      if (Object.keys(entry).length) answers[q.id] = entry;
      i++;
    }));
    return { status, answers, updatedAt: Date.now() - 86400000, submittedAt: status === 'submitted' ? Date.now() - 86400000 : null };
  }

  const reviews = {
    e1: {
      e_lan: mkReview([5, 4, 5, 4, 5, 4, 5, 4], 'submitted', 'Kiệt là một kỹ sư vững vàng, code sạch và rất chủ động trong sprint.'),
      e_huy: mkReview([4, 4, 4, 5, 4, 5, 4, 4], 'submitted', 'Hợp tác tốt với team product, cần mạnh dạn hơn khi đưa ý kiến.'),
    },
    e2: {
      e_lan: mkReview([4, 5, 4, 4, 3, 4, 4, 4], 'draft', ''),
    },
  };

  return {
    groups,
    employees,
    reviews,
    finals: {},
    managers: { 'minhanh@madison,tech': true },
    leaders: { 'lan@madison,tech': 'Engineering' },
  };
}

let data = load();
let handlers = null;

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
function emitAll() {
  if (!handlers) return;
  ['groups', 'employees', 'reviews', 'finals', 'managers', 'leaders'].forEach(key =>
    handlers.onData(key, JSON.parse(JSON.stringify(data[key]))));
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
      emitAll();
      handlers.onAuth({ email: acc.email, name: acc.name });
    } else {
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
    emitAll();
    handlers.onAuth({ email: acc.email, name: acc.name });
  },

  async logout() {
    localStorage.removeItem(AUTH_KEY);
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
