/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL — reviewer scores, auto-average, comments.
   Manager: editable final score (integers 1–5) + assign reviewers.
   Leader: read-only view, restricted to their own department.
   Fractional auto-averages are flagged so the Manager rounds them.
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, scoreChip, emptyState, openModal, btn, eyebrowMark } from '../ui.js';
import {
  state, reviewerIdsOf, avgForQuestion, finalForQuestion, empAvg,
  isFractional, fractionalQuestionsOf,
  setFinal, resetFinal, resetAllFinals, assignReviewers,
} from '../store.js';
import { inLeaderDept } from '../auth.js';
import { nav } from '../router.js';

export function renderEmployeeDetail(container, empId, user) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'help', title: 'Không tìm thấy nhân viên', desc: 'Nhân viên này không còn trong danh sách.' })}</div>`;
    return;
  }
  const canEdit = user.role === 'manager';
  if (user.role === 'leader' && !inLeaderDept(user, emp)) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'lock', title: 'Không có quyền xem', desc: `Nhân viên này không thuộc phòng ban ${user.dept} của bạn.` })}</div>`;
    return;
  }

  const empReviews = state.reviews[empId] || {};
  const assigned = reviewerIdsOf(emp).map(id => state.employees.find(e => e.id === id)).filter(Boolean);
  const submitted = assigned.filter(u => empReviews[u.id] && empReviews[u.id].status === 'submitted');
  const overrides = state.finals[empId] || {};
  const avg = empAvg(empId);
  const allSubmitted = assigned.length > 0 && submitted.length === assigned.length;
  const anyEdited = Object.values(overrides).some(x => x && x.edited);
  const fractional = fractionalQuestionsOf(empId);

  const GRID = `display:grid;grid-template-columns:2.4fr repeat(${submitted.length}, 64px) 70px 96px;gap:0`;

  container.innerHTML = `
    <button class="back-btn" data-back>← Danh sách nhân viên</button>

    <div class="card card-hi" style="padding:24px;margin-bottom:22px">
      <div class="hi-tri" style="background:color-mix(in srgb, var(--blue) 11%, transparent)"></div>
      <div class="hi-body">
      <div class="detail-hero" style="display:flex;align-items:center;gap:18px">
        <div class="detail-hero-main" style="display:flex;align-items:center;gap:18px;flex:1;min-width:0">
        ${avatar(emp.name, 58)}
        <div style="flex:1;min-width:0">
          <h1 style="font-size:25px;font-weight:700;color:var(--ink);letter-spacing:-0.03em;line-height:1.05">${esc(emp.name)}</h1>
          <div style="font-size:14px;color:var(--sub);margin-top:3px;overflow-wrap:anywhere">${esc(emp.title)}${emp.dept ? ' · ' + esc(emp.dept) : ''} · ${esc(emp.email)}</div>
        </div>
        </div>
        <div class="detail-stats" style="display:contents">
        <div class="detail-stat" style="text-align:center;padding:0 24px;border-right:1px solid var(--line)">
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Điểm Final</div>
          ${scoreChip(avg, { size: 'lg', muted: !allSubmitted })}
        </div>
        <div class="detail-stat" style="text-align:center;padding:0 8px 0 24px">
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Reviewer</div>
          <div style="font-size:22px;font-weight:700;color:var(--ink)">${submitted.length}<span style="color:var(--faint);font-size:15px">/${assigned.length || '0'}</span></div>
        </div>
        </div>
      </div>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-bottom:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;${assigned.length ? 'margin-bottom:16px' : ''}">
        <div style="font-size:12px;font-weight:700;color:var(--faint);letter-spacing:0.1em;text-transform:uppercase">Reviewer được phân công</div>
        ${canEdit ? btn({ label: assigned.length ? 'Chỉnh sửa' : 'Phân công', variant: 'ghost', size: 'sm', icon: 'users', attrs: 'data-assign' }) : ''}
      </div>
      ${assigned.length ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${assigned.map(u => {
            const r = empReviews[u.id];
            const st = r ? r.status : 'pending';
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;border:1px solid var(--line);border-radius:8px;background:#FAFBFC">
              ${avatar(u.name, 30)}
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap">${esc(u.name)}</div>
                <div style="margin-top:2px">${statusPill(st)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>`
        : `<div style="font-size:13.5px;color:var(--sub);padding-top:4px">Chưa có reviewer nào.${canEdit ? ' Bấm <b>Phân công</b> để bắt đầu.' : ''}</div>`}
    </div>

    ${submitted.length === 0
      ? `<div class="card">${emptyState({ icon: 'clipboard', title: 'Chưa có đánh giá nào được nộp', desc: 'Bảng điểm và điểm final sẽ xuất hiện khi reviewer nộp bản đánh giá.' })}</div>`
      : `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Bảng điểm chi tiết</h2>
        <div style="font-size:12.5px;color:var(--sub);display:flex;align-items:center;gap:6px">
          ${canEdit
            ? `${icon('edit', { size: 13, color: 'var(--blue)' })} Điểm final tự động tính trung bình — có thể chỉnh sửa`
            : `${icon('lock', { size: 13, color: 'var(--faint)' })} Điểm final tự động tính trung bình — chỉ xem`}
        </div>
      </div>

      ${fractional.length ? `
      <div style="display:flex;align-items:center;gap:11px;padding:12px 16px;background:var(--warn-bg);border:1px solid #EFD9AE;border-radius:9px;margin-bottom:14px">
        ${icon('alert', { size: 17, color: 'var(--warn)', stroke: 2.2 })}
        <div style="font-size:13.5px;color:#8A5A12;font-weight:600">
          ${fractional.length} câu hỏi có điểm trung bình lẻ — điểm final cần là số nguyên (1–5)${canEdit ? ', hãy xem lại và làm tròn.' : '. Manager cần xem lại và làm tròn.'}
        </div>
      </div>` : ''}

      <div class="card score-table" style="padding:0;overflow:hidden">
        <div class="sr-row" style="${GRID};padding:12px 22px;background:#FAFBFC;border-bottom:1px solid var(--line);align-items:center">
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase">Câu hỏi</div>
          ${submitted.map(u => `<div title="${esc(u.name)}" style="display:flex;justify-content:center">${avatar(u.name, 28)}</div>`).join('')}
          <div style="font-size:10px;font-weight:700;color:var(--faint);letter-spacing:0.06em;text-transform:uppercase;text-align:center">TB</div>
          <div style="font-size:10px;font-weight:700;color:var(--blue);letter-spacing:0.06em;text-transform:uppercase;text-align:center">Final</div>
        </div>

        ${state.groups.map((g, gi) => `
          <div class="sr-grp">
            <div class="sr-band" style="padding:9px 22px;background:#F3F6F9;border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--navy);letter-spacing:0.02em;display:flex;align-items:center;gap:8px">
              <span style="width:18px;height:18px;border-radius:5px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px">${gi + 1}</span>
              ${esc(g.name)}
            </div>
            ${g.items.map(q => {
              const auto = avgForQuestion(empId, q.id);
              const fin = finalForQuestion(empId, q.id);
              return `
              <div class="sr-row" style="${GRID};padding:11px 22px;border-bottom:1px solid var(--line);align-items:center">
                <div style="font-size:14px;font-weight:600;color:var(--ink);padding-right:12px">${esc(q.text)}</div>
                ${submitted.map(u => {
                  const a = empReviews[u.id] && empReviews[u.id].answers && empReviews[u.id].answers[q.id];
                  const sc = a && a.score != null ? a.score : null;
                  return `<div style="text-align:center;font-size:14px;font-weight:700;color:${sc != null ? 'var(--ink)' : 'var(--faint)'}">${sc != null ? sc : '—'}</div>`;
                }).join('')}
                <div style="text-align:center;font-size:14px;font-weight:700;color:var(--sub)">${auto != null ? Math.round(auto * 10) / 10 : '—'}</div>
                <div style="display:flex;justify-content:center" data-final-cell="${esc(q.id)}">
                  ${(() => {
                    const warn = isFractional(fin.score);
                    if (!canEdit) {
                      // read-only (leader): plain value, flagged when fractional
                      return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:14.5px;font-weight:700;color:${warn ? 'var(--warn)' : (fin.score != null ? 'var(--ink)' : 'var(--faint)')}"${warn ? ' title="Điểm trung bình lẻ — Manager cần làm tròn về số nguyên"' : ''}>${fin.score != null ? fin.score : '—'}${warn ? icon('alert', { size: 11, color: 'var(--warn)', stroke: 2.4 }) : ''}</span>`;
                    }
                    return `<button class="final-cell-btn${fin.edited ? ' edited' : ''}${warn ? ' warn' : ''}" data-final="${esc(q.id)}"
                      ${warn ? 'title="Điểm trung bình lẻ — cần làm tròn về số nguyên"' : ''}>
                      <span style="font-size:14.5px;font-weight:700;color:${warn ? 'var(--warn)' : (fin.score != null ? 'var(--ink)' : 'var(--faint)')}">${fin.score != null ? fin.score : '—'}</span>
                      ${warn ? icon('alert', { size: 11, color: 'var(--warn)', stroke: 2.4 }) : icon('edit', { size: 11, color: fin.edited ? 'var(--blue)' : 'var(--faint)' })}
                    </button>`;
                  })()}
                </div>
              </div>`;
            }).join('')}
          </div>`).join('')}

        <div class="sr-row" style="${GRID};padding:14px 22px;background:var(--navy);align-items:center">
          <div style="font-size:14px;font-weight:700;color:#fff;letter-spacing:-0.01em">Điểm trung bình tổng</div>
          ${submitted.map(() => '<div></div>').join('')}
          <div></div>
          <div style="display:flex;justify-content:center"><span style="font-size:19px;font-weight:700;color:#fff">${avg != null ? avg : '—'}</span></div>
        </div>
      </div>

      ${canEdit && anyEdited ? `
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12.5px;color:var(--sub)">
        <span style="width:12px;height:12px;border-radius:3px;background:var(--blue-hi);border:1.5px solid var(--blue);display:inline-block"></span>
        Ô tô màu xanh = điểm final đã được Manager chỉnh sửa thủ công.
        <button class="text-underline-btn" data-reset-all style="color:var(--blue);font-weight:700;margin-left:4px">Đặt lại tất cả về trung bình</button>
      </div>` : ''}

      <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin:32px 0 14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Nhận xét từ reviewer</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${commentsHtml(submitted, empReviews)}
      </div>`}
  `;

  wire(container, emp, user);
}

function commentsHtml(submitted, empReviews) {
  const comments = [];
  submitted.forEach(u => {
    state.groups.forEach(g => g.items.forEach(q => {
      const a = empReviews[u.id] && empReviews[u.id].answers && empReviews[u.id].answers[q.id];
      if (a && a.comment && a.comment.trim()) comments.push({ u, q, text: a.comment });
    }));
  });
  if (!comments.length) {
    return `<div class="card"><div style="font-size:13.5px;color:var(--sub);text-align:center;padding:8px 0">Chưa có nhận xét nào.</div></div>`;
  }
  return comments.map(c => `
    <div class="card" style="padding:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
        ${avatar(c.u.name, 28)}
        <span style="font-size:13.5px;font-weight:700;color:var(--ink)">${esc(c.u.name)}</span>
        <span style="font-size:12px;color:var(--faint)">về</span>
        <span style="font-size:12.5px;font-weight:600;color:var(--blue);background:var(--blue-hi);padding:2px 8px;border-radius:5px">${esc(c.q.text)}</span>
      </div>
      <div style="font-size:14px;color:var(--ink);line-height:1.55;padding-left:38px">"${esc(c.text)}"</div>
    </div>`).join('');
}

function wire(container, emp, user) {
  container.querySelector('[data-back]').addEventListener('click', () => nav('/employees'));
  const assignBtn = container.querySelector('[data-assign]');
  if (assignBtn) assignBtn.addEventListener('click', () => openAssignModal(emp));

  const resetAll = container.querySelector('[data-reset-all]');
  if (resetAll) resetAll.addEventListener('click', () => resetAllFinals(emp.id));

  // final score (manager only): click → inline number input; Enter/blur
  // commits (rounded to a whole point 1–5), Esc cancels.
  // Empty value resets the override back to the auto average.
  container.querySelectorAll('[data-final]').forEach(b =>
    b.addEventListener('click', () => {
      const qid = b.dataset.final;
      const cell = container.querySelector(`[data-final-cell="${CSS.escape(qid)}"]`);
      const fin = finalForQuestion(emp.id, qid);
      cell.innerHTML = `<input class="final-cell-input" type="number" min="1" max="5" step="1" value="${fin.score ?? ''}">`;
      const input = cell.querySelector('input');
      input.focus();
      input.select();
      let done = false;
      const commit = () => {
        if (done) return;
        done = true;
        const v = parseFloat(input.value);
        if (isNaN(v)) resetFinal(emp.id, qid);
        else setFinal(emp.id, qid, v);
        // store notify triggers the full re-render
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { done = true; renderEmployeeDetail(container, emp.id, user); }
      });
    }));
}

/* ---------- Assign reviewers modal (search + compact rows + chips) ---------- */
function openAssignModal(emp) {
  const candidates = state.employees.filter(e => e.id !== emp.id);
  let sel = reviewerIdsOf(emp).filter(id => candidates.some(e => e.id === id));
  let q = '';

  const m = openModal({
    title: 'Phân công Reviewer',
    subtitle: `Đánh giá cho ${emp.name} · ${candidates.length} nhân viên có thể chọn`,
    width: 540,
    contentHtml: `
      <div style="display:flex;flex-direction:column">
        <div style="padding:14px 24px 0;position:relative">
          ${icon('search', { size: 15, color: 'var(--faint)', style: 'position:absolute;left:38px;top:26px' })}
          <input data-q placeholder="Tìm theo tên, vị trí, email…"
            style="width:100%;height:42px;border:1.5px solid var(--line);border-radius:8px;padding:0 14px 0 36px;font-size:14px;outline:none;background:#FAFBFC;color:var(--ink)">
        </div>
        <div data-list style="max-height:340px;overflow-y:auto;margin-top:10px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)"></div>
        <div data-chips style="padding:0 24px;display:flex;flex-wrap:wrap;gap:7px"></div>
        <div style="padding:14px 24px 20px;display:flex;justify-content:space-between;align-items:center">
          <span data-count style="font-size:13px;color:var(--sub);font-weight:600"></span>
          <div style="display:flex;gap:10px">
            ${btn({ label: 'Huỷ', variant: 'soft', attrs: 'data-cancel' })}
            ${btn({ label: 'Lưu phân công', variant: 'primary', icon: 'check', attrs: 'data-save' })}
          </div>
        </div>
      </div>`,
  });

  const listEl = m.body.querySelector('[data-list]');
  const chipsEl = m.body.querySelector('[data-chips]');
  const countEl = m.body.querySelector('[data-count]');

  function paint() {
    const filtered = candidates.filter(e =>
      !q || (e.name + e.title + e.email).toLowerCase().includes(q.toLowerCase()));

    listEl.innerHTML = filtered.length === 0
      ? `<div style="padding:32px 24px;text-align:center;color:var(--faint);font-size:14px">Không tìm thấy nhân viên nào</div>`
      : filtered.map((e, i) => {
          const on = sel.includes(e.id);
          return `
          <button class="assign-row${on ? ' selected' : ''}" data-toggle="${esc(e.id)}" style="${i < filtered.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}">
            ${avatar(e.name, 30)}
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:${on ? 700 : 600};color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.name)}</div>
              <div style="font-size:12px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.title)}${e.email ? ' · ' + esc(e.email) : ''}</div>
            </div>
            <span style="width:20px;height:20px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${on ? 'var(--blue)' : '#fff'};border:1.5px solid ${on ? 'var(--blue)' : 'var(--line-hi)'};transition:all .1s">
              ${on ? icon('check', { size: 12, color: '#fff', stroke: 3 }) : ''}
            </span>
          </button>`;
        }).join('');

    const selEmps = sel.map(id => candidates.find(e => e.id === id)).filter(Boolean);
    chipsEl.style.paddingTop = selEmps.length ? '12px' : '0';
    chipsEl.innerHTML = selEmps.map(e => `
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;background:#29ABE215;color:var(--blue);padding:4px 8px 4px 10px;border-radius:6px">
        ${esc(e.name)}
        <button class="chip-x" data-toggle="${esc(e.id)}">${icon('x', { size: 13, stroke: 2.5 })}</button>
      </span>`).join('');

    countEl.innerHTML = sel.length
      ? `<b style="color:var(--ink)">${sel.length}</b> reviewer được chọn`
      : 'Chưa chọn reviewer nào';

    m.body.querySelectorAll('[data-toggle]').forEach(b =>
      b.addEventListener('click', () => {
        const id = b.dataset.toggle;
        sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id];
        paint();
      }));
  }

  m.body.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; paint(); });
  m.body.querySelector('[data-cancel]').addEventListener('click', m.close);
  m.body.querySelector('[data-save]').addEventListener('click', async () => {
    await assignReviewers(emp.id, sel);
    m.close();
  });

  paint();
}
