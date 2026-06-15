/* ═══════════════════════════════════════════════════════════════
   EMPLOYEES — searchable table + Excel import (Manager),
   or the leader's own department, read-only (Leader).
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, scoreChip, pageHead, emptyState, btn } from '../ui.js';
import { state, empProgress, empAvg, fractionalQuestionsOf } from '../store.js';
import { inLeaderDept, encodeEmailKey } from '../auth.js';
import { nav } from '../router.js';
import { openImportModal } from './import-modal.js';

let query = '';            // survives re-renders
let onlyFractional = false; // "điểm lẻ cần chú ý" filter toggle

// drop transient list state (called on logout so it doesn't leak to next user)
export function clearEmployeesFilters() { query = ''; onlyFractional = false; }

// preset the list filter before navigating here (e.g. from the dashboard)
export function setEmployeesFractionalFilter(on) { onlyFractional = !!on; query = ''; }

export function renderEmployees(container, user) {
  const isMgr = user.role === 'manager';
  const scoped = isMgr ? state.employees : state.employees.filter(e => inLeaderDept(user, e));
  const fracEmps = scoped.filter(e => fractionalQuestionsOf(e.id).length > 0);
  const fracCount = fracEmps.length;
  if (!fracCount) onlyFractional = false; // nothing to filter → reset

  let list = scoped.filter(e =>
    (e.name + e.email + (e.dept || '')).toLowerCase().includes(query.toLowerCase()));
  if (onlyFractional) list = list.filter(e => fractionalQuestionsOf(e.id).length > 0);

  const GRID = 'display:grid;grid-template-columns:2.2fr 1.4fr 1.6fr 1fr 90px';

  container.innerHTML = `
    ${pageHead(isMgr ? {
      eyebrow: 'Manager', title: 'Nhân viên',
      desc: 'Toàn bộ nhân viên trong chu kỳ. Phân công reviewer và xem điểm số cuối cùng.',
      actionsHtml: btn({ label: 'Import Excel', variant: 'ghost', icon: 'upload', attrs: 'data-import' }),
    } : {
      eyebrow: `Leader · ${user.dept}`, title: 'Phòng ban của tôi',
      desc: 'Nhân viên thuộc phòng ban của bạn và kết quả đánh giá tương ứng (chỉ xem).',
    })}

    <div style="display:flex;gap:12px;align-items:center;margin-bottom:18px;flex-wrap:wrap">
      <div class="search-wrap" style="flex:1;max-width:340px">
        ${icon('search', { size: 16, color: 'var(--faint)' })}
        <input class="search-input" data-search placeholder="Tìm theo tên, email, phòng ban…" value="${esc(query)}">
      </div>
      ${fracCount ? `
      <button class="filter-chip${onlyFractional ? ' active' : ''}" data-filter-frac
        title="Lọc nhân viên có điểm trung bình lẻ cần làm tròn">
        ${icon('alert', { size: 15, color: onlyFractional ? '#fff' : 'var(--warn)', stroke: 2.4 })}
        Điểm lẻ cần chú ý <span class="chip-count">${fracCount}</span>
      </button>` : ''}
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="emp-grid-head" style="${GRID};padding:13px 22px;background:#FAFBFC;border-bottom:1px solid var(--line);font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase">
        <div>Nhân viên</div><div>Phòng ban</div><div>Reviewer</div><div>Điểm final</div><div style="text-align:right">Tiến độ</div>
      </div>
      ${list.map((e, i) => {
        const p = empProgress(e);
        const avg = empAvg(e.id);
        const fullDone = p.assigned > 0 && p.submitted === p.assigned;
        const fracN = fractionalQuestionsOf(e.id).length;
        return `
        <div class="row-hover emp-row${fracN ? ' row-warn' : ''}" data-emp="${esc(e.id)}" style="${GRID};align-items:center;padding:14px 22px;${i < list.length - 1 ? 'border-bottom:1px solid var(--line);' : ''}">
          <div class="emp-cell-name" style="display:flex;align-items:center;gap:12px;min-width:0">
            ${avatar(e.name, 38)}
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:6px;min-width:0">
                <span style="font-size:14.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.name)}</span>
                ${isMgr && state.leaders[encodeEmailKey(e.email)]
                  ? `<span style="flex:none;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#1E9E6A2E;color:var(--ok)">Leader</span>`
                  : ''}
              </div>
              <div style="font-size:12.5px;color:var(--sub)">${esc(e.title)}</div>
            </div>
          </div>
          <div class="emp-cell-dept" style="font-size:13.5px;color:var(--ink);font-weight:600">${esc(e.dept || '—')}</div>
          <div class="emp-cell-reviewer">
            ${p.assigned
              ? `<span style="font-size:13px;color:var(--sub);font-weight:600">${p.assigned} người</span>`
              : `<span style="font-size:12px;font-weight:700;color:var(--warn);background:var(--warn-bg);padding:3px 9px;border-radius:5px">Chưa phân công</span>`}
          </div>
          <div class="emp-cell-final" style="display:flex;align-items:center;gap:8px">
            ${scoreChip(avg, { muted: !fullDone })}
            ${fracN
              ? `<span class="warn-chip" title="${fracN} câu có điểm trung bình lẻ — cần làm tròn điểm final">${icon('alert', { size: 12, color: 'var(--warn)', stroke: 2.4 })}${fracN} câu lẻ</span>`
              : ''}
          </div>
          <div class="emp-cell-progress" style="display:flex;justify-content:flex-end;align-items:center;gap:8px">
            ${p.assigned
              ? `<span style="font-size:13px;font-weight:700;color:${fullDone ? 'var(--ok)' : 'var(--sub)'}">${p.submitted}/${p.assigned}</span>`
              : `<span style="color:var(--faint)">—</span>`}
            ${icon('chevR', { size: 15, color: 'var(--faint)' })}
          </div>
        </div>`;
      }).join('')}
      ${!list.length ? emptyState(onlyFractional
        ? { icon: 'check', title: 'Không có nhân viên điểm lẻ', desc: 'Không có nhân viên nào (khớp tìm kiếm) cần làm tròn điểm final.' }
        : { icon: 'users', title: 'Không tìm thấy nhân viên', desc: 'Thử từ khoá khác hoặc import danh sách mới.' }) : ''}
    </div>
  `;

  const search = container.querySelector('[data-search]');
  search.addEventListener('input', () => {
    query = search.value;
    // re-render only the table rows by re-running the view, preserving input focus
    const pos = search.selectionStart;
    renderEmployees(container, user);
    const s2 = container.querySelector('[data-search]');
    s2.focus();
    s2.setSelectionRange(pos, pos);
  });
  const importBtn = container.querySelector('[data-import]');
  if (importBtn) importBtn.addEventListener('click', () => openImportModal('employees'));
  const filterBtn = container.querySelector('[data-filter-frac]');
  if (filterBtn) filterBtn.addEventListener('click', () => {
    onlyFractional = !onlyFractional;
    renderEmployees(container, user);
  });
  container.querySelectorAll('[data-emp]').forEach(r =>
    r.addEventListener('click', () => nav(`/employee/${r.dataset.emp}`)));
}
