/* ═══════════════════════════════════════════════════════════════
   FIREBASE BACKEND — Auth (Microsoft via OAuthProvider) +
   Realtime Database subscriptions and writes.
═══════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, onValue, set, update, remove,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {
  initializeAppCheck, ReCaptchaV3Provider,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { firebaseConfig, MS_TENANT, RECAPTCHA_SITE_KEY } from './firebase-config.js';
import { COLLECTIONS } from './constants.js';

let auth = null;
let db = null;
let unsubs = [];

// This tool shares one Firebase project with other tools; all its data
// lives under tools/performance-review/* so the namespaces never collide.
const BASE = 'tools/performance-review';

function subscribeData(onData) {
  unsubscribeData();
  COLLECTIONS.forEach(key => {
    unsubs.push(onValue(ref(db, `${BASE}/${key}`), snap => onData(key, snap.val()), err => {
      console.error(`RTDB read failed for /${BASE}/${key}:`, err);
    }));
  });
}
function unsubscribeData() {
  unsubs.forEach(u => u());
  unsubs = [];
}

export const backend = {
  isDemo: false,

  async init({ onAuth, onData }) {
    const app = initializeApp(firebaseConfig);

    // App Check — chứng thực client hợp lệ trước khi cho gọi RTDB/Auth.
    // Bật khi đã có site key; trên localhost dùng debug token (token sẽ in ra
    // console lần chạy đầu — đăng ký nó ở Firebase Console → App Check →
    // Manage debug tokens để dev cục bộ qua được khi enforcement đang bật).
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
        subscribeData(onData);
        onAuth({ email: user.email || '', name: user.displayName || user.email || '' });
      } else {
        unsubscribeData();
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

  saveReview(empId, reviewerId, review) {
    return set(ref(db, `${BASE}/reviews/${empId}/${reviewerId}`), review);
  },

  async assignReviewers(empId, reviewerIdsMap, removedIds) {
    const updates = { [`${BASE}/employees/${empId}/reviewerIds`]: reviewerIdsMap };
    removedIds.forEach(rid => { updates[`${BASE}/reviews/${empId}/${rid}`] = null; });
    await update(ref(db), updates);
  },

  setFinal(empId, qid, score) {
    return set(ref(db, `${BASE}/finals/${empId}/${qid}`), { score, edited: true });
  },
  resetFinal(empId, qid) { return remove(ref(db, `${BASE}/finals/${empId}/${qid}`)); },
  resetAllFinals(empId) { return remove(ref(db, `${BASE}/finals/${empId}`)); },

  setGroupWeight(groupId, weight) {
    return set(ref(db, `${BASE}/groupWeights/${groupId}`), weight);
  },

  // Replacing the question set invalidates existing reviews/finals
  importQuestions(groups) {
    return update(ref(db), { [`${BASE}/groups`]: groups, [`${BASE}/reviews`]: null, [`${BASE}/finals`]: null });
  },

  // list: [{ id, name, email, title, dept, order, reviewerIds }]
  importEmployees(list) {
    const map = {};
    list.forEach(e => { const { id, ...rest } = e; map[id] = rest; });
    return update(ref(db), { [`${BASE}/employees`]: map, [`${BASE}/reviews`]: null, [`${BASE}/finals`]: null });
  },
};
