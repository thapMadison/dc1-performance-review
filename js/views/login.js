/* ═══════════════════════════════════════════════════════════════
   LOGIN — Blueprint screen, Microsoft SSO.
   Real mode: Firebase signInWithPopup. Demo mode: account picker.
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, LOGO, logoTile, eyebrowMark } from '../ui.js';
import { getBackend } from '../store.js';
import { APP_CYCLE, APP_CYCLE_YEAR } from '../firebase-config.js';

function msLogo(size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 21 21">
    <rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>`;
}

const FRIENDLY_ERRORS = {
  'auth/popup-closed-by-user': 'Cửa sổ đăng nhập đã bị đóng. Vui lòng thử lại.',
  'auth/cancelled-popup-request': 'Cửa sổ đăng nhập đã bị đóng. Vui lòng thử lại.',
  'auth/popup-blocked': 'Trình duyệt đã chặn popup. Hãy cho phép popup cho trang này rồi thử lại.',
  'auth/network-request-failed': 'Lỗi mạng. Kiểm tra kết nối internet và thử lại.',
  'auth/invalid-api-key': 'Firebase chưa được cấu hình — điền js/firebase-config.js (xem README).',
  'auth/operation-not-allowed': 'Provider Microsoft chưa được bật trong Firebase Authentication.',
};

export function renderLogin(container) {
  const backend = getBackend();
  let loading = false;
  let picking = false; // demo-mode account picker
  let error = '';

  function template() {
    return `
    <div class="login-screen">
      <div class="login-origami">
        <div class="lo-facet" style="background:rgba(255,255,255,0.11);clip-path:polygon(0 0,58% 0,0 72%)"></div>
        <div class="lo-facet" style="background:var(--blue-dk);opacity:0.55;clip-path:polygon(100% 0,100% 58%,42% 0)"></div>
        <div class="lo-facet" style="background:var(--navy);opacity:0.30;clip-path:polygon(100% 32%,100% 100%,22% 100%)"></div>
        <div class="lo-facet" style="background:rgba(255,255,255,0.16);clip-path:polygon(41% 0,44% 0,29% 100%,26% 100%)"></div>
      </div>

      <div class="lo-brand">
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:-0.01em;line-height:1.1">Madison</div>
          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.82);letter-spacing:0.16em;text-transform:uppercase">Technologies</div>
        </div>
        ${logoTile({ size: 58, logoSize: 36, bg: 'rgba(255,255,255,0.16)', border: 'rgba(255,255,255,0.34)' })}
      </div>

      <div style="position:relative;z-index:3;height:100%;display:flex;align-items:center;padding:0 9vw;max-width:620px">
        <div style="width:100%;max-width:400px">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:40px">
            ${eyebrowMark(13)}
            <span style="font-size:11px;font-weight:700;color:var(--blue);letter-spacing:0.16em;text-transform:uppercase">Performance Review · ${esc(APP_CYCLE)}</span>
          </div>
          ${picking ? pickerHtml() : formHtml()}
        </div>
      </div>
    </div>`;
  }

  function formHtml() {
    return `
      <h1 style="font-size:56px;font-weight:700;color:var(--ink);line-height:0.95;letter-spacing:-0.035em;margin-bottom:18px">Đăng<br>nhập.</h1>
      <p style="font-size:15px;color:var(--sub);margin-bottom:44px;line-height:1.6;max-width:320px">
        Sử dụng tài khoản Microsoft của công ty để truy cập hệ thống đánh giá hiệu suất.
      </p>
      <button class="ms-btn" data-login ${loading ? 'disabled' : ''}>
        ${loading
          ? `<span class="pr-spin" style="width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;display:inline-block"></span>Đang kết nối…`
          : `<span style="background:#fff;border-radius:3px;padding:3px;display:flex">${msLogo(17)}</span>Đăng nhập với Microsoft`}
      </button>
      ${error ? `<div style="margin-top:16px;max-width:340px;padding:11px 14px;background:var(--danger-bg);color:var(--danger);border-radius:8px;font-size:13px;font-weight:600;line-height:1.45">${esc(error)}</div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-top:26px;font-size:12.5px;color:var(--faint)">
        ${icon('lock', { size: 14, color: 'var(--faint)' })} Xác thực qua Azure AD · SSO bảo mật
      </div>
      ${backend.isDemo ? `<div style="margin-top:14px;font-size:12px;color:var(--warn);font-weight:600">⚠ Chế độ demo — dữ liệu giả lập trên trình duyệt</div>` : ''}`;
  }

  function pickerHtml() {
    return `
      <h1 style="font-size:38px;font-weight:700;color:var(--ink);line-height:1;letter-spacing:-0.03em;margin-bottom:10px">Chọn tài khoản</h1>
      <p style="font-size:14px;color:var(--sub);margin-bottom:28px;line-height:1.55">Microsoft tìm thấy các tài khoản sau cho domain <b style="color:var(--ink)">@madison.tech</b></p>
      <div style="display:flex;flex-direction:column;max-width:360px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 20px rgba(15,23,41,0.06)">
        ${backend.demoAccounts.map(u => `
          <button class="account-row" data-email="${esc(u.email)}">
            ${avatar(u.name, 40)}
            <div style="flex:1;min-width:0">
              <div style="font-size:14.5px;font-weight:700;color:var(--ink)">${esc(u.name)}</div>
              <div style="font-size:12.5px;color:var(--sub)">${esc(u.email)}</div>
            </div>
            <span style="font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:3px 8px;border-radius:5px;background:${u.role === 'manager' ? '#29ABE218' : u.role === 'leader' ? 'var(--ok-bg)' : '#F0F2F5'};color:${u.role === 'manager' ? 'var(--blue)' : u.role === 'leader' ? 'var(--ok)' : 'var(--sub)'}">
              ${u.role === 'manager' ? 'Manager' : u.role === 'leader' ? 'Leader' : 'Reviewer'}
            </span>
            ${icon('chevR', { size: 16, color: 'var(--faint)' })}
          </button>`).join('')}
      </div>
      <button data-back style="margin-top:20px;background:none;border:none;color:var(--sub);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">← Dùng tài khoản khác</button>`;
  }

  function wire() {
    const loginBtn = container.querySelector('[data-login]');
    if (loginBtn) loginBtn.addEventListener('click', async () => {
      error = '';
      loading = true;
      paint();
      if (backend.isDemo) {
        // mimic the SSO round-trip, then show the demo account picker
        setTimeout(() => { loading = false; picking = true; paint(); }, 900);
        return;
      }
      try {
        await backend.login();
        // success → onAuthStateChanged re-renders the app
      } catch (e) {
        loading = false;
        error = FRIENDLY_ERRORS[e.code] || `Đăng nhập thất bại: ${e.message || e}`;
        paint();
      }
    });
    container.querySelectorAll('[data-email]').forEach(b =>
      b.addEventListener('click', () => backend.loginAs(b.dataset.email)));
    const back = container.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { picking = false; paint(); });
  }

  function paint() {
    container.innerHTML = template();
    wire();
  }
  paint();
}
