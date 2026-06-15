/* ═══════════════════════════════════════════════════════════════
   APP — bootstrap: pick backend (?demo=1 → localStorage mock),
   wire auth + store + router, render the current screen.
═══════════════════════════════════════════════════════════════ */

import { state, subscribe, initStore } from './store.js';
import { resolveUser } from './auth.js';
import { resolveRoute } from './router.js';
import { setRenderer } from './bus.js';
import { esc } from './ui.js';

import { renderLogin } from './views/login.js';
import { sidebarHtml, wireSidebar, topbarHtml } from './views/shell.js';
import { renderMyReviews } from './views/my-reviews.js';
import { renderReviewForm, clearReviewSession } from './views/review-form.js';
import { renderDashboard } from './views/dashboard.js';
import { renderEmployees, clearEmployeesFilters } from './views/employees.js';
import { renderEmployeeDetail } from './views/employee-detail.js';
import { renderQuestions } from './views/questions.js';

const root = document.getElementById('root');
const isDemo = new URLSearchParams(location.search).get('demo') === '1';

function splash(label) {
  return `<div class="splash">
    <div class="spinner pr-spin"></div>
    <div class="label">${esc(label)}</div>
  </div>`;
}

let lastRouteKey = null;

function render() {
  if (!state.authReady) { root.innerHTML = splash('Đang khởi động…'); return; }

  const user = resolveUser(state);
  if (!user) {
    lastRouteKey = null;
    clearReviewSession();
    clearEmployeesFilters();
    renderLogin(root);
    return;
  }
  if (!state.dataReady) { root.innerHTML = splash('Đang tải dữ liệu…'); return; }

  const route = resolveRoute(user);
  const routeKey = `${route.page}:${route.param || ''}`;
  if (lastRouteKey && lastRouteKey !== routeKey && lastRouteKey.startsWith('review:')) {
    clearReviewSession(); // leaving the form → drop the local working copy
  }

  // preserve scroll position across re-renders of the same page
  const prevScroller = root.querySelector('[data-scroll]');
  const prevScroll = prevScroller ? prevScroller.scrollTop : 0;

  root.innerHTML = `<div class="app-frame" data-frame>
    ${sidebarHtml(user, route)}
    <div class="sidebar-scrim" data-scrim></div>
    <div class="app-scroll" data-scroll>
      ${topbarHtml(user, route)}
      <div class="app-content" data-content></div>
    </div>
  </div>`;
  wireSidebar(root);

  const content = root.querySelector('[data-content]');
  if (route.page === 'dashboard') renderDashboard(content);
  else if (route.page === 'employees') renderEmployees(content, user);
  else if (route.page === 'employee') renderEmployeeDetail(content, route.param, user);
  else if (route.page === 'questions') renderQuestions(content);
  else if (route.page === 'myreviews') renderMyReviews(content, user);
  else if (route.page === 'review') renderReviewForm(content, user, route.param);

  root.querySelector('[data-scroll]').scrollTop = (routeKey === lastRouteKey) ? prevScroll : 0;
  lastRouteKey = routeKey;
}

setRenderer(render);
subscribe(render);
window.addEventListener('hashchange', render);
render();

try {
  const mod = await import(isDemo ? './demo-store.js' : './firebase.js');
  await initStore(mod.backend);
} catch (e) {
  console.error('Khởi tạo thất bại:', e);
  root.innerHTML = `<div class="splash">
    <div style="max-width:460px;text-align:center;padding:24px">
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:10px">Không khởi tạo được ứng dụng</div>
      <div style="font-size:13.5px;color:#8A99B0;line-height:1.6">
        ${esc(e.message || e)}<br><br>
        Kiểm tra cấu hình Firebase trong <b style="color:#fff">js/firebase-config.js</b> (xem README.md),
        hoặc chạy thử giao diện với <a href="?demo=1" style="color:#29ABE2">chế độ demo</a>.
      </div>
    </div>
  </div>`;
}
