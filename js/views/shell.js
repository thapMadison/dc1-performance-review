/* ═══════════════════════════════════════════════════════════════
   SHELL — navy sidebar app frame (Blueprint)
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, logoTile, NOTCH } from '../ui.js';
import { getBackend } from '../store.js';
import { nav } from '../router.js';
import { APP_CYCLE } from '../firebase-config.js';

export function sidebarHtml(user, route) {
  const items = user.role === 'manager'
    ? [
        { id: 'dashboard', label: 'Tổng quan', icon: 'grid' },
        { id: 'employees', label: 'Nhân viên', icon: 'users' },
        { id: 'questions', label: 'Bộ câu hỏi', icon: 'help' },
        { id: 'myreviews', label: 'Đánh giá của tôi', icon: 'clipboard' },
      ]
    : user.role === 'leader'
    ? [
        { id: 'employees', label: 'Phòng ban của tôi', icon: 'users' },
        { id: 'myreviews', label: 'Đánh giá của tôi', icon: 'clipboard' },
      ]
    : [
        { id: 'myreviews', label: 'Đánh giá của tôi', icon: 'clipboard' },
      ];
  // detail pages keep their parent nav item highlighted
  const parent = { employee: 'employees', review: 'myreviews' }[route.page] || route.page;

  return `
  <div class="sidebar">
    <div class="sb-facet sb-f1"></div>
    <div class="sb-facet sb-f2"></div>
    <div class="sb-facet sb-f3"></div>
    <div class="sb-facet sb-f4"></div>

    <div style="padding:26px 22px 24px;display:flex;align-items:center;gap:11px;position:relative">
      ${logoTile({ size: 42, logoSize: 26 })}
      <div>
        <div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.02em;line-height:1.1">Madison</div>
        <div style="font-size:10px;font-weight:600;color:var(--blue);letter-spacing:0.14em;text-transform:uppercase">Performance</div>
      </div>
    </div>

    <div style="margin:0 18px 20px;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);clip-path:${NOTCH(9)};position:relative">
      <div style="font-size:10px;color:#6B7B92;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:3px">Chu kỳ hiện tại</div>
      <div style="display:flex;align-items:center;gap:7px">
        <span style="width:8px;height:8px;background:var(--blue);clip-path:polygon(50% 0,100% 100%,0 100%);box-shadow:0 0 8px var(--blue)"></span>
        <span style="font-size:14px;font-weight:700;color:#fff">${esc(APP_CYCLE)}</span>
        <span style="font-size:11px;color:#5E6E86;margin-left:auto">· đang mở</span>
      </div>
    </div>

    <div style="padding:0 14px;display:flex;flex-direction:column;gap:3px;flex:1;position:relative">
      <div style="font-size:10px;color:#4E5D74;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:4px 10px 8px">Menu</div>
      ${items.map(it => `
        <button class="nav-item${parent === it.id ? ' active' : ''}" data-nav="${it.id}">
          ${icon(it.icon, { size: 18, stroke: 2 })} ${esc(it.label)}
        </button>`).join('')}
    </div>

    <div style="padding:14px;border-top:1px solid rgba(255,255,255,0.07);position:relative">
      <div style="display:flex;align-items:center;gap:11px;padding:6px 8px">
        ${avatar(user.name, 38)}
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(user.name)}</div>
          <div style="font-size:11px;color:#6B7B92;display:flex;align-items:center;gap:5px">
            <span style="display:inline-block;padding:1px 6px;border-radius:4px;background:${user.role === 'manager' ? '#29ABE225' : user.role === 'leader' ? '#1E9E6A2E' : 'rgba(255,255,255,0.08)'};color:${user.role === 'manager' ? 'var(--blue)' : user.role === 'leader' ? '#43CE94' : '#9AA8BD'};font-weight:700;font-size:10px;letter-spacing:0.04em;text-transform:uppercase">
              ${user.role === 'manager' ? 'Manager' : user.role === 'leader' ? 'Leader' : 'Reviewer'}
            </span>
          </div>
        </div>
        <button class="logout-btn" data-logout title="Đăng xuất">${icon('logout', { size: 17, color: '#6B7B92' })}</button>
      </div>
    </div>
  </div>`;
}

export function wireSidebar(container) {
  container.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => nav(`/${b.dataset.nav}`)));
  const out = container.querySelector('[data-logout]');
  if (out) out.addEventListener('click', () => {
    location.hash = '';
    getBackend().logout();
  });
}
