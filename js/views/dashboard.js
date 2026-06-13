/* ═══════════════════════════════════════════════════════════════
   MANAGER · DASHBOARD — KPIs, company-wide progress, attention list
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, pageHead, emptyState, hiCard, eyebrowMark } from '../ui.js';
import { state, empProgress, fractionalQuestionsOf } from '../store.js';
import { nav } from '../router.js';
import { setEmployeesFractionalFilter } from './employees.js';
import { APP_CYCLE, APP_CYCLE_YEAR, APP_DEADLINE } from '../firebase-config.js';

export function renderDashboard(container) {
  const { employees } = state;
  const totalAssign = employees.reduce((a, e) => a + empProgress(e).assigned, 0);
  const totalSubmitted = employees.reduce((a, e) => a + empProgress(e).submitted, 0);
  const fullyDone = employees.filter(e => { const p = empProgress(e); return p.assigned > 0 && p.submitted === p.assigned; }).length;
  const noReviewer = employees.filter(e => empProgress(e).assigned === 0).length;
  const pct = totalAssign ? Math.round(totalSubmitted / totalAssign * 100) : 0;

  const kpis = [
    { l: 'Nhân viên', v: employees.length, icon: 'users', c: 'var(--blue)' },
    { l: 'Lượt đánh giá đã nộp', v: `${totalSubmitted}/${totalAssign}`, icon: 'check', c: 'var(--ok)' },
    { l: 'Hoàn tất 100%', v: fullyDone, icon: 'clipboard', c: 'var(--navy)' },
    { l: 'Chưa có reviewer', v: noReviewer, icon: 'help', c: noReviewer ? 'var(--warn)' : 'var(--faint)' },
  ];

  const attention = employees.filter(e => { const p = empProgress(e); return p.assigned === 0 || p.submitted < p.assigned; }).slice(0, 4);
  const allDone = employees.length > 0 && employees.every(e => { const p = empProgress(e); return p.assigned > 0 && p.submitted === p.assigned; });
  const fractionalEmps = employees.filter(e => fractionalQuestionsOf(e.id).length > 0);

  container.innerHTML = `
    ${pageHead({ eyebrow: 'Manager · Tổng quan', title: `Chu kỳ đánh giá ${APP_CYCLE}`, desc: 'Theo dõi tiến độ đánh giá toàn công ty và điểm số cuối cùng của từng nhân viên.' })}

    <div style="display:flex;gap:16px;margin-bottom:16px">
      ${kpis.map(s => hiCard({
        tone: s.c, pad: 20, style: 'flex:1',
        body: `
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase;max-width:90px;line-height:1.3">${esc(s.l)}</div>
            <div style="width:32px;height:32px;border-radius:8px;background:#fff;box-shadow:0 1px 5px color-mix(in srgb, ${s.c} 22%, transparent);display:flex;align-items:center;justify-content:center">
              ${icon(s.icon, { size: 16, color: s.c })}
            </div>
          </div>
          <div style="font-size:32px;font-weight:700;color:var(--ink);letter-spacing:-0.03em;margin-top:12px">${s.v}</div>`,
      })).join('')}
    </div>

    ${fractionalEmps.length ? `
    <div class="card card-hover" data-frac style="padding:14px 18px;margin-bottom:16px;background:var(--warn-bg);border:1px solid #EFD9AE;display:flex;align-items:center;gap:12px">
      ${icon('alert', { size: 18, color: 'var(--warn)', stroke: 2.2 })}
      <div style="flex:1;font-size:13.5px;color:#8A5A12;font-weight:600">
        <b>${fractionalEmps.length} nhân viên</b> có điểm final lẻ (thập phân) — điểm final cần là số nguyên, hãy xem lại và làm tròn.
      </div>
      <span style="font-size:13px;font-weight:700;color:var(--warn);display:inline-flex;align-items:center;gap:5px">Xem danh sách ${icon('arrowR', { size: 14, color: 'var(--warn)' })}</span>
    </div>` : ''}

    <div class="card" style="padding:24px;margin-bottom:28px;background:var(--navy);border:none;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;right:0;width:200px;height:200px;background:#29ABE218;clip-path:polygon(100% 0,100% 100%,30% 0)"></div>
      <div style="position:absolute;top:0;right:0;width:130px;height:200px;background:#29ABE214;clip-path:polygon(100% 0,100% 100%,0 0)"></div>
      <div style="position:relative;display:flex;align-items:center;gap:28px">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:700;color:var(--blue);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px">Tiến độ toàn công ty</div>
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px">
            <span style="font-size:44px;font-weight:700;color:#fff;letter-spacing:-0.03em">${pct}%</span>
            <span style="font-size:15px;color:#8A99B0;font-weight:600">${totalSubmitted}/${totalAssign} lượt đánh giá đã nộp</span>
          </div>
          <div style="width:100%;height:8px;background:rgba(255,255,255,0.12);border-radius:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--blue),#5BC6F0);border-radius:8px;transition:width .5s"></div>
          </div>
        </div>
        <div style="text-align:center;padding-left:28px;border-left:1px solid rgba(255,255,255,0.12)">
          <div style="font-size:12px;color:#8A99B0;font-weight:600;margin-bottom:4px">Deadline</div>
          <div style="font-size:22px;font-weight:700;color:#fff">${esc(APP_DEADLINE)}</div>
          <div style="font-size:12px;color:#8A99B0">${esc(APP_CYCLE_YEAR)}</div>
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Nhân viên cần chú ý</h2>
      <button class="link-btn" data-all>Xem tất cả ${icon('arrowR', { size: 14, color: 'var(--blue)' })}</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${attention.map(e => {
        const p = empProgress(e);
        return `
        <div class="card card-hover" style="padding:0" data-emp="${esc(e.id)}">
          <div style="display:flex;align-items:center;gap:16px;padding:14px 20px">
            ${avatar(e.name, 40)}
            <div style="flex:1">
              <div style="font-size:14.5px;font-weight:700;color:var(--ink)">${esc(e.name)}</div>
              <div style="font-size:12.5px;color:var(--sub)">${esc(e.title)}${e.dept ? ' · ' + esc(e.dept) : ''}</div>
            </div>
            ${p.assigned === 0 ? statusPill('pending') : `<span style="font-size:13px;font-weight:600;color:var(--sub)">${p.submitted}/${p.assigned} reviewer đã nộp</span>`}
            ${icon('chevR', { size: 16, color: 'var(--faint)' })}
          </div>
        </div>`;
      }).join('')}
      ${allDone ? `<div class="card">${emptyState({ icon: 'check', title: 'Tất cả đã hoàn tất 🎉', desc: 'Mọi nhân viên đều đã nhận đủ đánh giá.' })}</div>` : ''}
      ${!employees.length ? `<div class="card">${emptyState({ icon: 'users', title: 'Chưa có nhân viên', desc: 'Import danh sách nhân viên từ Excel để bắt đầu chu kỳ đánh giá.' })}</div>` : ''}
    </div>
  `;

  container.querySelector('[data-all]').addEventListener('click', () => {
    setEmployeesFractionalFilter(false); // full list
    nav('/employees');
  });
  const frac = container.querySelector('[data-frac]');
  if (frac) frac.addEventListener('click', () => {
    setEmployeesFractionalFilter(true); // jump straight to the flagged employees
    nav('/employees');
  });
  container.querySelectorAll('[data-emp]').forEach(c =>
    c.addEventListener('click', () => nav(`/employee/${c.dataset.emp}`)));
}
