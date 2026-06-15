/* ═══════════════════════════════════════════════════════════════
   MY REVIEWS — employees assigned to the current reviewer
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, progress, pageHead, emptyState, hiCard, countdownBanner, reviewPeriodStatus } from '../ui.js';
import { state, allQuestionIds, reviewOf, answeredCount } from '../store.js';
import { nav } from '../router.js';
import { APP_CYCLE } from '../firebase-config.js';
import { STATUS } from '../constants.js';

export function renderMyReviews(container, user) {
  const qids = allQuestionIds();
  const myId = user.empId;
  const mine = myId ? state.employees.filter(e => (e.reviewerIds || {})[myId]) : [];
  const done = mine.filter(e => { const r = reviewOf(e.id, myId); return r && r.status === STATUS.SUBMITTED; }).length;

  const cards = [
    { l: 'Được phân công', v: mine.length, c: 'var(--blue)' },
    { l: 'Đã hoàn thành', v: done, c: 'var(--ok)' },
    { l: 'Còn lại', v: mine.length - done, c: 'var(--warn)' },
  ];

  const period = reviewPeriodStatus();

  container.innerHTML = `
    ${pageHead({ eyebrow: 'Reviewer', title: 'Đánh giá của tôi', desc: `Những nhân viên bạn được phân công đánh giá trong chu kỳ ${APP_CYCLE}.` })}

    ${period.locked ? `
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#EEF1F8;border:1px solid var(--line);margin-bottom:18px">
      ${icon('lock', { size: 18, color: '#5B6B8A' })}
      <div style="font-size:13.5px;color:#3D4B66;font-weight:600">
        ${period.beforeStart ? 'Kỳ đánh giá chưa bắt đầu. Bạn chỉ có thể xem.' : 'Kỳ đánh giá đã kết thúc. Bạn chỉ có thể xem.'}
      </div>
    </div>` : ''}

    ${countdownBanner()}

    <div class="stat-row stat-row-3" style="margin-bottom:28px">
      ${cards.map(s => hiCard({
        tone: s.c, pad: 18, style: 'flex:1',
        body: `
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">${esc(s.l)}</div>
          <div style="font-size:30px;font-weight:700;color:${s.c};letter-spacing:-0.03em">${s.v}</div>`,
      })).join('')}
    </div>

    ${mine.length === 0
      ? `<div class="card">${emptyState({ icon: 'clipboard', title: 'Chưa có ai được phân công', desc: 'Bạn chưa được Manager phân công đánh giá nhân viên nào trong chu kỳ này.' })}</div>`
      : `<div style="display:flex;flex-direction:column;gap:12px">
          ${mine.map(e => {
            const r = reviewOf(e.id, myId);
            const status = r ? r.status : STATUS.PENDING;
            const ans = answeredCount(r, qids);
            const locked = status === STATUS.SUBMITTED;
            const pct = qids.length ? Math.round(ans / qids.length * 100) : 0;
            return `
            <div class="card card-hover" style="padding:0;overflow:hidden" data-review="${esc(e.id)}">
              <div class="myreview-row" style="display:flex;align-items:center;gap:18px;padding:18px 22px">
                ${avatar(e.name, 46)}
                <div class="myreview-main" style="flex:1;min-width:0">
                  <div style="font-size:16px;font-weight:700;color:var(--ink);letter-spacing:-0.01em">${esc(e.name)}</div>
                  <div style="font-size:13px;color:var(--sub)">${esc(e.title)}${e.dept ? ' · ' + esc(e.dept) : ''}</div>
                </div>
                <div class="myreview-progress" style="width:180px">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span style="font-size:12px;font-weight:600;color:var(--sub)">${ans}/${qids.length} câu</span>
                    <span style="font-size:12px;font-weight:700;color:${locked ? 'var(--ok)' : 'var(--blue)'}">${pct}%</span>
                  </div>
                  ${progress(ans, qids.length, locked ? 'var(--ok)' : 'var(--blue)')}
                </div>
                <div class="myreview-status" style="width:130px;display:flex;justify-content:flex-end">
                  ${statusPill(locked ? STATUS.LOCKED : status)}
                </div>
                ${icon(locked ? 'lock' : 'chevR', { size: 18, color: 'var(--faint)' })}
              </div>
            </div>`;
          }).join('')}
        </div>`}
  `;

  container.querySelectorAll('[data-review]').forEach(c =>
    c.addEventListener('click', () => nav(`/review/${c.dataset.review}`)));
}
