/* ═══════════════════════════════════════════════════════════════
   UI KIT — shared HTML renderers (Blueprint style)
   All functions return HTML strings; modals are imperative.
═══════════════════════════════════════════════════════════════ */

import { APP_DEADLINE, APP_DEADLINE_ISO } from './firebase-config.js';

export const LOGO = 'assets/logo-gorilla.png';

export const GROUP_COLORS = ['#E8743B', '#3B7BE8', '#1E9E6A', '#7C5CFC', '#D14D8B', '#29ABE2'];

/* ---------- escaping ---------- */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function escAttr(s) { return esc(s); }

/* ---------- Icons ---------- */
const PATHS = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  help: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  check: 'M20 6 9 17l-5-5',
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  x: 'M18 6 6 18M6 6l12 12',
  arrowR: 'M5 12h14M12 5l7 7-7 7',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2Z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
};
export function icon(name, opts = {}) {
  const { size = 18, color = 'currentColor', stroke = 2, style = '' } = opts;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"${style ? ` style="${style}"` : ''}><path d="${PATHS[name] || ''}"/></svg>`;
}

/* ---------- Logo ---------- */
export function logo(size = 30, invert = false) {
  return `<img src="${LOGO}" alt="Madison" style="width:${size}px;height:${size}px;object-fit:contain;${invert ? 'filter:brightness(0) invert(1);' : ''}">`;
}

/* ═══════ Geometric DNA — origami shards & facets ═══════
   3 angle languages: CHAMFER (brand surfaces) · SQUARE+HIGHLIGHT
   (stat cards) · ROUNDED (content, kept as-is). Facets are an
   ACCENT layer — never a background wash. */

// origami corner-cut clip-path (top-right + bottom-left sliced)
export const NOTCH = (n = 10) =>
  `polygon(0 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% 100%, ${n}px 100%, 0 calc(100% - ${n}px))`;

// signature motif: a square split on the diagonal into two facets
export function eyebrowMark(size = 12, color = 'var(--blue)') {
  return `<span style="display:inline-flex;flex-shrink:0">
    <span style="width:${size}px;height:${size}px;background:${color};clip-path:polygon(0 0,100% 0,0 100%)"></span>
    <span style="width:${size}px;height:${size}px;background:${color};opacity:0.34;clip-path:polygon(100% 0,100% 100%,0 100%)"></span>
  </span>`;
}

// sharp faceted logo tile — used in sidebar & login (chamfered, no radius)
export function logoTile({ size = 44, logoSize = 26, bg = '#29ABE21F', border = '#29ABE240' } = {}) {
  return `<div style="width:${size}px;height:${size}px;background:${bg};${border ? `border:1px solid ${border};` : ''}display:flex;align-items:center;justify-content:center;flex-shrink:0;clip-path:${NOTCH(Math.round(size * 0.3))}">
    ${logo(logoSize, true)}
  </div>`;
}

// stat/highlight card: square top-right corner + tone-tinted corner triangle.
// `tone` is any CSS color (incl. var()); the triangle uses an 11% tint of it.
export function hiCard({ tone = 'var(--blue)', pad = 24, cls = '', style = '', body = '' } = {}) {
  return `<div class="card card-hi${cls ? ' ' + cls : ''}" style="padding:${pad}px;${style}">
    <div class="hi-tri" style="background:color-mix(in srgb, ${tone} 11%, transparent)"></div>
    <div class="hi-body">${body}</div>
  </div>`;
}

/* ---------- Avatar ---------- */
export function avatar(name, size = 36, tone) {
  const initials = esc((name || '?').split(' ').slice(-2).map(s => s[0]).join('').toUpperCase());
  const tones = ['#29ABE2', '#7C5CFC', '#1E9E6A', '#E8743B', '#D14D8B', '#3B7BE8'];
  const idx = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length;
  const bg = tone || tones[idx];
  return `<div style="width:${size}px;height:${size}px;border-radius:6px;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.38)}px;font-weight:700;flex-shrink:0;letter-spacing:-0.02em">${initials}</div>`;
}

/* ---------- Button ---------- */
export function btn({ label, variant = 'primary', size = 'md', icon: ic, iconRight, full = false, disabled = false, attrs = '' }) {
  const fs = { sm: 13, md: 14, lg: 15 }[size];
  return `<button class="btn btn-${variant} btn-${size}${full ? ' btn-full' : ''}" ${disabled ? 'disabled' : ''} ${attrs}>
    ${ic ? icon(ic, { size: fs + 3, stroke: 2.2 }) : ''}${esc(label)}${iconRight ? icon(iconRight, { size: fs + 3, stroke: 2.2 }) : ''}
  </button>`;
}

/* ---------- Status pill ---------- */
const PILL_TEXT = { submitted: 'Đã nộp', draft: 'Bản nháp', pending: 'Chưa bắt đầu', locked: 'Đã khóa' };
export function statusPill(status) {
  const st = PILL_TEXT[status] ? status : 'pending';
  return `<span class="pill pill-${st}"><span class="dot"></span>${PILL_TEXT[st]}</span>`;
}

/* ---------- Score chip ---------- */
export function scoreChip(value, { size = 'md', muted = false } = {}) {
  if (value == null) return `<span style="color:var(--faint);font-size:14px;font-weight:600">—</span>`;
  const colorFor = v => v >= 4.5 ? 'var(--ok)' : v >= 3.5 ? 'var(--blue)' : v >= 2.5 ? 'var(--warn)' : 'var(--danger)';
  const c = muted ? 'var(--sub)' : colorFor(value);
  const big = size === 'lg';
  const num = Number.isInteger(value) ? value : value.toFixed(1);
  return `<span style="display:inline-flex;align-items:baseline;gap:2px;font-weight:700;color:${c};font-size:${big ? 22 : 15}px;letter-spacing:-0.02em">${num}<span style="font-size:${big ? 12 : 10}px;color:var(--faint);font-weight:600">/5</span></span>`;
}

/* ---------- Rating scale 1–5 ---------- */
export const SCALE_LABELS = ['Không đạt (Poor)', 'Dưới kỳ vọng (Below)', 'Đạt yêu cầu (Meets) ★', 'Vượt kỳ vọng (Exceeds)', 'Xuất sắc (Outstanding)'];
// label colors mirror the active rating-btn backgrounds (css), with v3's yellow
// darkened to a legible gold for text-on-white.
export const SCALE_COLORS = ['#C0392B', '#E8743B', '#C99A06', '#3B9BD1', '#1E9E6A'];
export function ratingScale(qid, value, disabled) {
  const buttons = [1, 2, 3, 4, 5].map(n =>
    `<button class="rating-btn v${n}${value === n ? ' active' : ''}" data-rate="${n}" data-qid="${escAttr(qid)}" ${disabled ? 'disabled' : ''}>${n}</button>`
  ).join('');
  const label = value ? `${value} — ${SCALE_LABELS[value - 1]}` : 'Chọn mức điểm từ 1 đến 5';
  return `<div style="display:flex;flex-direction:column;gap:8px">
    <div class="rating-row" data-rating-row="${escAttr(qid)}">${buttons}</div>
    <div class="rating-label${value ? ' lit' : ''}" data-rating-label="${escAttr(qid)}"${value ? ` style="color:${SCALE_COLORS[value - 1]}"` : ''}>${esc(label)}</div>
  </div>`;
}

/* ---------- Progress bar ---------- */
export function progress(value, total, color = 'var(--blue)', height = 6) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return `<div class="progress-track" style="height:${height}px;border-radius:${height}px">
    <div class="progress-fill" style="width:${pct}%;background:${color};border-radius:${height}px"></div>
  </div>`;
}

/* ---------- Section header ---------- */
export function pageHead({ eyebrow, title, desc, actionsHtml = '' }) {
  return `<div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px;gap:24px;flex-wrap:wrap">
    <div>
      ${eyebrow ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        ${eyebrowMark()}
        <span style="font-size:11px;font-weight:700;color:var(--blue);letter-spacing:0.16em;text-transform:uppercase">${esc(eyebrow)}</span>
      </div>` : ''}
      <h1 style="font-size:32px;font-weight:700;color:var(--ink);letter-spacing:-0.03em;line-height:1.05">${esc(title)}</h1>
      ${desc ? `<p style="font-size:14.5px;color:var(--sub);margin-top:8px;line-height:1.5">${esc(desc)}</p>` : ''}
    </div>
    ${actionsHtml ? `<div class="page-head-actions" style="display:flex;gap:10px">${actionsHtml}</div>` : ''}
  </div>`;
}

/* ---------- Empty state ---------- */
export function emptyState({ icon: ic = 'clipboard', title, desc, actionHtml = '' }) {
  return `<div style="text-align:center;padding:64px 24px">
    <div style="width:60px;height:60px;border-radius:12px;background:var(--blue-hi);display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px">
      ${icon(ic, { size: 26, color: 'var(--blue)' })}
    </div>
    <div style="font-size:18px;font-weight:700;color:var(--ink);margin-bottom:6px">${esc(title)}</div>
    ${desc ? `<div style="font-size:14px;color:var(--sub);max-width:360px;margin:0 auto 20px;line-height:1.55">${esc(desc)}</div>` : ''}
    ${actionHtml}
  </div>`;
}

/* ---------- Modal (imperative) ----------
   openModal returns { root, body, close }. Content is wired by caller. */
export function openModal({ title = '', subtitle = '', width = 560, contentHtml = '', onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box" style="width:${width}px">
    ${(title || subtitle) ? `<div class="modal-head">
      <div>
        ${title ? `<div style="font-size:20px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">${esc(title)}</div>` : ''}
        ${subtitle ? `<div style="font-size:13.5px;color:var(--sub);margin-top:4px">${esc(subtitle)}</div>` : ''}
      </div>
      <button class="modal-close">${icon('x', { size: 17, color: 'var(--sub)' })}</button>
    </div>` : ''}
    <div data-modal-body>${contentHtml}</div>
  </div>`;

  function close() {
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    if (onClose) onClose();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const closeBtn = overlay.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  return { root: overlay, body: overlay.querySelector('[data-modal-body]'), close };
}

/* ---------- Review-period countdown ----------
   Time remaining until the configured deadline. Shown to every member
   (manager / leader / reviewer), regardless of review assignment. */

const MS = { day: 86400000, hour: 3600000, min: 60000, sec: 1000 };
const pad2 = n => String(n).padStart(2, '0');

// Returns { ms, expired, days, hours, mins, secs, dd, hh, mm, ss, label, tone }.
// `ms` is the raw remaining milliseconds (negative once past the deadline);
// dd/hh/mm/ss are 2-digit strings for the segmented clock display.
export function deadlineInfo(nowMs = Date.now()) {
  const end = new Date(APP_DEADLINE_ISO).getTime();
  const ms = end - nowMs;
  if (ms <= 0) {
    return { ms, expired: true, days: 0, hours: 0, mins: 0, secs: 0,
      dd: '00', hh: '00', mm: '00', ss: '00', label: 'Đã hết hạn', tone: 'var(--danger)' };
  }
  const days = Math.floor(ms / MS.day);
  const hours = Math.floor((ms % MS.day) / MS.hour);
  const mins = Math.floor((ms % MS.hour) / MS.min);
  const secs = Math.floor((ms % MS.min) / MS.sec);
  // tone: red ≤3 days left, amber ≤7, otherwise the calm "self-assessment" green
  const tone = days <= 3 ? 'var(--danger)' : days <= 7 ? 'var(--warn)' : 'var(--ok)';
  const label = days >= 1
    ? `Còn ${days} ngày ${hours} giờ`
    : `Còn ${hours} giờ ${mins} phút`;
  return { ms, expired: false, days, hours, mins, secs,
    dd: pad2(days), hh: pad2(hours), mm: pad2(mins), ss: pad2(secs), label, tone };
}

// One segment of the dd:hh:mm:ss clock. `unit` keys the live-updating value.
function cdSeg(value, label, unit, tone) {
  return `<div class="cd-seg">
    <span class="cd-num" data-cd="${unit}" style="color:${tone}">${esc(value)}</span>
    <span class="cd-unit">${esc(label)}</span>
  </div>`;
}

// Reusable real-time countdown banner. Visible to all roles.
// `variant`: 'card' (default, segmented dd:hh:mm:ss clock) or
//            'navy' (compact, for the dashboard hero aside).
export function countdownBanner({ variant = 'card' } = {}) {
  const d = deadlineInfo();
  if (variant === 'navy') {
    return `<div class="countdown-aside" data-countdown style="text-align:center;padding-left:28px;border-left:1px solid rgba(255,255,255,0.12)">
      <div style="font-size:12px;color:#8A99B0;font-weight:600;margin-bottom:6px">Còn lại đến hạn</div>
      <div class="cd-clock cd-clock--navy">
        ${cdSeg(d.dd, 'NGÀY', 'dd', '#fff')}<span class="cd-colon">:</span>${cdSeg(d.hh, 'GIỜ', 'hh', '#fff')}<span class="cd-colon">:</span>${cdSeg(d.mm, 'PHÚT', 'mm', '#fff')}<span class="cd-colon">:</span>${cdSeg(d.ss, 'GIÂY', 'ss', '#fff')}
      </div>
      <div style="font-size:11px;color:#8A99B0;margin-top:7px">Hạn chót ${esc(APP_DEADLINE)}</div>
    </div>`;
  }
  return `<div class="card cd-card" data-countdown style="margin-bottom:18px;border-left:3px solid ${d.tone}">
    <div class="cd-head">
      <div class="cd-head-icon" style="background:color-mix(in srgb, ${d.tone} 13%, transparent)">
        ${icon('clock', { size: 20, color: d.tone, stroke: 2.2 })}
      </div>
      <div style="min-width:0">
        <div class="cd-title" style="color:${d.tone}">Cross Review</div>
        <div class="cd-sub">Bạn nhớ hoàn tất trước khi hết hạn nhé! · Hạn chót ${esc(APP_DEADLINE)}</div>
      </div>
    </div>
    <div class="cd-clock">
      ${cdSeg(d.dd, 'NGÀY', 'dd', d.tone)}<span class="cd-colon" style="color:${d.tone}">:</span>${cdSeg(d.hh, 'GIỜ', 'hh', d.tone)}<span class="cd-colon" style="color:${d.tone}">:</span>${cdSeg(d.mm, 'PHÚT', 'mm', d.tone)}<span class="cd-colon" style="color:${d.tone}">:</span>${cdSeg(d.ss, 'GIÂY', 'ss', d.tone)}
    </div>
  </div>`;
}

// Tick every countdown banner in the DOM, once per second. Runs for the app's
// lifetime (cheap) — when no banner is mounted it simply does nothing, so a
// banner that appears after login picks up the live updates immediately.
let countdownTimer = null;
function tickCountdowns() {
  const nodes = document.querySelectorAll('[data-countdown]');
  if (!nodes.length) return;
  const d = deadlineInfo();
  nodes.forEach(node => {
    const isNavy = node.classList.contains('countdown-aside');
    node.querySelectorAll('[data-cd]').forEach(seg => {
      seg.textContent = d[seg.dataset.cd];
      if (!isNavy) seg.style.color = d.tone; // navy keeps white digits
    });
    // colon + accents follow the tone on the light-card variant
    if (!isNavy) {
      node.style.borderLeftColor = d.tone;
      node.querySelectorAll('.cd-colon').forEach(c => { c.style.color = d.tone; });
      const title = node.querySelector('.cd-title');
      if (title) title.style.color = d.tone;
    }
  });
}
export function startCountdownTicker() {
  if (countdownTimer) return;
  countdownTimer = setInterval(tickCountdowns, MS.sec);
}
