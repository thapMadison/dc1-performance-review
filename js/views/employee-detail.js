/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL — reviewer scores, auto-average, comments.
   Manager: editable final score (integers 1–5) + assign reviewers.
   Leader: read-only view, restricted to their own department.
   Fractional auto-averages are flagged so the Manager rounds them.
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, scoreChip, emptyState, openModal, btn, eyebrowMark, GROUP_COLORS, reviewPeriodStatus } from '../ui.js';
import {
  state, reviewerIdsOf, avgForQuestion, finalForQuestion,
  isFractional, fractionalQuestionsOf,
  setFinal, resetFinal, resetAllFinals, assignReviewers,
  groupStats, weightedFinal, totalWeight, classify, bands,
  isManagerEditAllowed,
} from '../store.js';
import { inLeaderDept } from '../auth.js';
import { nav } from '../router.js';

const BAND_COLORS = { A: 'var(--ok)', B: 'var(--blue)', C: '#E8A020', D: '#E06030', E: 'var(--danger)' };
const BAND_BGS    = { A: '#E6F6EF', B: '#E8F6FC', C: '#FDF3E0', D: '#FDEEE8', E: '#FBEAEA' };

export function renderEmployeeDetail(container, empId, user) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'help', title: 'Không tìm thấy nhân viên', desc: 'Nhân viên này không còn trong danh sách.' })}</div>`;
    return;
  }
  const isManager = user.role === 'manager';
  const period = reviewPeriodStatus();
  // Final-score editing stays open for managers after the deadline expires —
  // only the pre-start lock blocks it. Reviewer assignment is a setup action,
  // gated to the full active window.
  const canEdit = isManager && !period.beforeStart;
  const canAssign = isManager && period.active;
  if (user.role === 'leader' && !inLeaderDept(user, emp)) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'lock', title: 'Không có quyền xem', desc: `Nhân viên này không thuộc phòng ban ${user.dept} của bạn.` })}</div>`;
    return;
  }

  const empReviews = state.reviews[empId] || {};
  const assigned = reviewerIdsOf(emp).map(id => state.employees.find(e => e.id === id)).filter(Boolean);
  const submitted = assigned.filter(u => empReviews[u.id] && empReviews[u.id].status === 'submitted');
  const overrides = state.finals[empId] || {};
  const final = weightedFinal(empId);
  const band = classify(final);
  const bandColor = id => BAND_COLORS[id] || 'var(--sub)';
  const allSubmitted = assigned.length > 0 && submitted.length === assigned.length;
  const anyEdited = Object.values(overrides).some(x => x && x.edited);
  const fractional = fractionalQuestionsOf(empId);

  const GRID = `display:grid;grid-template-columns:2.4fr repeat(${submitted.length}, 64px) 70px 96px;gap:0`;

  container.innerHTML = `
    <button class="back-btn" data-back>← Danh sách nhân viên</button>

    ${period.beforeStart ? `
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#EEF1F8;border:1px solid var(--line);margin-bottom:18px">
      ${icon('lock', { size: 18, color: '#5B6B8A' })}
      <div style="font-size:13.5px;color:#3D4B66;font-weight:600">Kỳ đánh giá chưa bắt đầu. Bạn chỉ có thể xem.</div>
    </div>` : (period.expired && isManager) ? `
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--warn-bg);border:1px solid #EFD9AE;margin-bottom:18px">
      ${icon('alert', { size: 18, color: 'var(--warn)' })}
      <div style="font-size:13.5px;color:#8A5A12;font-weight:600">Kỳ đánh giá đã kết thúc — bạn vẫn có thể chỉnh sửa điểm Final.</div>
    </div>` : ''}

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
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Điểm Final${band ? ` · <span style="color:${bandColor(band.id)}">${esc(band.label)}</span>` : ''}</div>
          ${scoreChip(final, { size: 'lg', muted: !allSubmitted })}
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
        ${canAssign ? btn({ label: assigned.length ? 'Chỉnh sửa' : 'Phân công', variant: 'ghost', size: 'sm', icon: 'users', attrs: 'data-assign' }) : ''}
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
        : `<div style="font-size:13.5px;color:var(--sub);padding-top:4px">Chưa có reviewer nào.${canAssign ? ' Bấm <b>Phân công</b> để bắt đầu.' : ''}</div>`}
    </div>

    ${submitted.length === 0
      ? `<div class="card">${emptyState({ icon: 'clipboard', title: 'Chưa có đánh giá nào được nộp', desc: 'Bảng điểm và điểm final sẽ xuất hiện khi reviewer nộp bản đánh giá.' })}</div>`
      : `
      ${groupOverviewHtml(empId)}

      <div style="margin-bottom:22px">${resultBarHtml(empId)}</div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:14px;flex-wrap:wrap">
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

      <div class="score-table" style="display:flex;flex-direction:column;gap:10px">
        <div class="card" style="padding:0;overflow:hidden">
          <div class="sr-row" style="${GRID};padding:12px 22px;background:#FAFBFC;align-items:center">
            <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase">Câu hỏi</div>
            ${submitted.map(u => `<div title="${esc(u.name)}" style="display:flex;justify-content:center">${avatar(u.name, 28)}</div>`).join('')}
            <div style="font-size:10px;font-weight:700;color:var(--faint);letter-spacing:0.06em;text-transform:uppercase;text-align:center">TB</div>
            <div style="font-size:10px;font-weight:700;color:var(--blue);letter-spacing:0.06em;text-transform:uppercase;text-align:center">Final</div>
          </div>
        </div>

        ${state.groups.map((g, gi) => {
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          return `
          <div class="card sr-grp" style="padding:0;overflow:hidden;border-left:3px solid ${color}">
            <button class="sr-band" data-ed-toggle="${esc(g.id)}" style="padding:9px 22px;background:#F3F6F9;border-bottom:1px solid var(--line);font-size:12px;font-weight:700;color:var(--navy);letter-spacing:0.02em;display:flex;align-items:center;gap:8px;width:100%;border:none;border-bottom:1px solid var(--line);cursor:pointer;font-family:var(--font);text-align:left;transition:background .14s">
              <span style="width:18px;height:18px;border-radius:5px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${gi + 1}</span>
              <span style="flex:1">${esc(g.name)}</span>
              <svg data-ed-chevron="${esc(g.id)}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .22s"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="sr-grp-body" data-ed-body="${esc(g.id)}">
            ${g.items.map(q => {
              const auto = avgForQuestion(empId, q.id);
              const fin = finalForQuestion(empId, q.id);
              return `
              <div class="sr-row" style="${GRID};padding:11px 22px;${qComments(submitted, empReviews, q.id).length ? '' : 'border-bottom:1px solid var(--line);'}align-items:center">
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
                      return `<span style="display:inline-flex;align-items:center;gap:3px;font-size:14.5px;font-weight:700;color:${warn ? 'var(--warn)' : (fin.score != null ? 'var(--ink)' : 'var(--faint)')}"${warn ? ' title="Điểm trung bình lẻ — Manager cần làm tròn về số nguyên"' : ''}>${fin.score != null ? fin.score : '—'}${warn ? icon('alert', { size: 11, color: 'var(--warn)', stroke: 2.4 }) : ''}</span>`;
                    }
                    return `<button class="final-cell-btn${fin.edited ? ' edited' : ''}${warn ? ' warn' : ''}" data-final="${esc(q.id)}"
                      ${warn ? 'title="Điểm trung bình lẻ — cần làm tròn về số nguyên"' : ''}>
                      <span style="font-size:14.5px;font-weight:700;color:${warn ? 'var(--warn)' : (fin.score != null ? 'var(--ink)' : 'var(--faint)')}">${fin.score != null ? fin.score : '—'}</span>
                      ${warn ? icon('alert', { size: 11, color: 'var(--warn)', stroke: 2.4 }) : icon('edit', { size: 11, color: fin.edited ? 'var(--blue)' : 'var(--faint)' })}
                    </button>`;
                  })()}
                </div>
              </div>
              ${qCommentsHtml(submitted, empReviews, q.id)}`;
            }).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>

      ${canEdit && anyEdited ? `
      <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12.5px;color:var(--sub)">
        <span style="width:12px;height:12px;border-radius:3px;background:var(--blue-hi);border:1.5px solid var(--blue);display:inline-block"></span>
        Ô tô màu xanh = điểm final đã được Manager chỉnh sửa thủ công.
        <button class="text-underline-btn" data-reset-all style="color:var(--blue);font-weight:700;margin-left:4px">Đặt lại tất cả về trung bình</button>
      </div>` : ''}

      <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin:32px 0 14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Nhận xét tổng quan từ reviewer</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${commentsHtml(submitted, empReviews)}
      </div>`}
  `;

  wire(container, emp, user);
}

/* ---------- Weighted result helpers ---------- */

// 2-decimal display formatter (computation always uses raw values upstream)
const fmt2 = v => v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2);

// Inline group overview strip: per-group average score + weight chips.
// Shown above the score table so reviewers/managers see the group breakdown.
function groupOverviewHtml(empId) {
  const stats = groupStats(empId);
  if (!stats.length) return '';
  return `
    <div class="card" style="padding:16px 18px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px">
        <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.08em;text-transform:uppercase">Tổng quan theo nhóm</div>
        <div style="font-size:12px;font-weight:600;color:var(--sub)">Điểm TB từng nhóm câu hỏi</div>
      </div>
      <div class="grp-overview-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        ${stats.map((s, gi) => {
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          return `
          <div style="border:1px solid var(--line);border-left:3px solid ${color};border-radius:8px;padding:11px 13px;background:#FAFBFC">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <span style="font-size:12.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.group.name)}</span>
            </div>
            <div style="display:flex;align-items:baseline;gap:5px">
              <span style="font-size:21px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">${fmt2(s.avg)}</span>
              <span style="font-size:11px;color:var(--faint);font-weight:600">/5</span>
              <span style="margin-left:auto;font-size:11.5px;font-weight:700;color:${color}">${s.weight}%</span>
            </div>
            <div style="font-size:11px;color:var(--sub);margin-top:3px">Đã chấm ${s.scored}/${s.total}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// Final result bar (replaces the old plain-average navy row): weighted final +
// classification chip + a button to open the detailed breakdown modal.
function resultBarHtml(empId) {
  const final = weightedFinal(empId);
  const band = classify(final);
  return `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="display:flex;align-items:center;gap:18px;padding:16px 22px;background:var(--navy);flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px">Kết quả cuối cùng (có trọng số)</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7)">Σ (điểm TB nhóm × trọng số)</div>
        </div>
        ${band ? `<span style="display:inline-flex;align-items:center;gap:7px;background:${BAND_BGS[band.id]};border:1.5px solid ${BAND_COLORS[band.id]};padding:6px 12px;border-radius:999px">
          <span style="width:22px;height:22px;border-radius:50%;background:${BAND_COLORS[band.id]};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${esc(band.id)}</span>
          <span style="font-size:13px;font-weight:700;color:${BAND_COLORS[band.id]}">${esc(band.label)}</span>
        </span>` : ''}
        <div style="display:flex;align-items:baseline;gap:3px">
          <span style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.02em">${fmt2(final)}</span>
          <span style="font-size:13px;color:rgba(255,255,255,0.6);font-weight:600">/5</span>
        </div>
        ${btn({ label: 'Chi tiết', variant: 'soft', size: 'sm', icon: 'grid', attrs: 'data-result' })}
      </div>
    </div>`;
}

/* ---------- Result breakdown modal (matches the design overview) ---------- */
function openResultModal(empId) {
  const stats = groupStats(empId);
  const final = weightedFinal(empId);
  const band = classify(final);
  const sumW = totalWeight();
  const allBands = bands();

  const formula = stats
    .filter(s => s.weight)
    .map(s => `(${esc(s.group.name)} × ${s.weight}%)`)
    .join(' + ') || '—';

  const m = openModal({
    title: 'Kết quả tạm tính (Result)',
    subtitle: 'Dựa trên điểm hiện tại — cập nhật khi chấm thêm tiêu chí.',
    width: 620,
    contentHtml: `
      <div style="padding:8px 24px 24px">
        <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:2fr 0.8fr 0.9fr 0.8fr 1fr;gap:0;padding:11px 16px;background:#FAFBFC;font-size:10.5px;font-weight:700;color:var(--faint);letter-spacing:0.05em;text-transform:uppercase">
            <div>Nhóm tiêu chí</div>
            <div style="text-align:center">Đã chấm</div>
            <div style="text-align:center">Điểm TB nhóm</div>
            <div style="text-align:center">Trọng số</div>
            <div style="text-align:right">Điểm có trọng số</div>
          </div>
          ${stats.map((s, gi) => {
            const color = GROUP_COLORS[gi % GROUP_COLORS.length];
            return `
            <div style="display:grid;grid-template-columns:2fr 0.8fr 0.9fr 0.8fr 1fr;gap:0;padding:13px 16px;border-top:1px solid var(--line);align-items:center;font-size:13.5px">
              <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:var(--ink)">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.group.name)}</span>
              </div>
              <div style="text-align:center;color:var(--sub);font-weight:600">${s.scored}/${s.total}</div>
              <div style="text-align:center;font-weight:700;color:var(--ink)">${fmt2(s.avg)}</div>
              <div style="text-align:center;color:var(--sub);font-weight:600">${s.weight}%</div>
              <div style="text-align:right;font-weight:700;color:var(--ink)">${fmt2(s.weighted)}</div>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 15px;background:var(--warn-bg);border:1px solid #EFD9AE;border-radius:9px;margin-bottom:18px">
          ${icon('alert', { size: 16, color: 'var(--warn)', stroke: 2.2, style: 'flex-shrink:0;margin-top:1px' })}
          <div style="font-size:12.5px;color:#8A5A12;line-height:1.55">
            <div>• Điểm hiển thị tại từng nhóm là điểm trung bình (chưa nhân trọng số).</div>
            <div><b>Kết quả cuối cùng</b> = ${formula}. (Có thể sai lệch nhẹ do quy tắc làm tròn.)</div>
            ${sumW !== 100 ? `<div style="margin-top:3px;font-weight:700">⚠ Tổng trọng số hiện là ${fmt2(sumW)}% (khác 100%).</div>` : ''}
          </div>
        </div>

        <div style="border:1.5px solid ${band ? BAND_COLORS[band.id] : 'var(--ok)'};background:${band ? BAND_BGS[band.id] : '#E6F6EF'};border-radius:12px;padding:18px;text-align:center;margin-bottom:18px">
          <div style="font-size:34px;font-weight:700;color:${band ? BAND_COLORS[band.id] : 'var(--ok)'};letter-spacing:-0.03em">${fmt2(final)}<span style="font-size:16px;color:var(--faint);font-weight:600"> / 5.00</span></div>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px">Thang phân loại</div>
        <div style="display:grid;grid-template-columns:repeat(${allBands.length},1fr);gap:8px;margin-bottom:16px">
          ${allBands.map(b => {
            const c = BAND_COLORS[b.id] || 'var(--sub)';
            const bg = BAND_BGS[b.id] || '#FAFBFC';
            const on = band && b.id === band.id;
            return `
            <div style="border:1.5px solid ${on ? c : 'var(--line)'};border-radius:10px;padding:12px 6px;text-align:center;background:${on ? bg : '#FAFBFC'};transition:border-color .15s,background .15s">
              <div style="width:34px;height:34px;border-radius:50%;margin:0 auto 7px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;background:${on ? c : '#E3E7EC'};color:${on ? '#fff' : 'var(--faint)'}">${esc(b.id)}</div>
              <div style="font-size:12px;font-weight:700;color:${on ? 'var(--ink)' : 'var(--sub)'}">${esc(b.label)}</div>
              <div style="font-size:11px;color:${on ? c : 'var(--faint)'};margin-top:2px;opacity:${on ? 1 : 0.8}">${fmt2(b.min)} - ${fmt2(b.max)}</div>
            </div>`;
          }).join('')}
        </div>

        <div style="display:flex;align-items:center;gap:8px;padding:11px 14px;background:#EEF1F8;border-radius:8px;font-size:12.5px;color:#3D4B66">
          ${icon('help', { size: 15, color: '#5B6B8A', style: 'flex-shrink:0' })}
          <span><b>Note:</b> Tiêu chí chưa chấm tính điểm 0.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:18px">
          ${btn({ label: 'Đóng', variant: 'soft', attrs: 'data-close' })}
        </div>
      </div>`,
  });

  m.body.querySelector('[data-close]').addEventListener('click', m.close);
}

// Per-question comments from submitted reviewers (for the inline row).
function qComments(submitted, empReviews, qid) {
  const out = [];
  submitted.forEach(u => {
    const a = empReviews[u.id] && empReviews[u.id].answers && empReviews[u.id].answers[qid];
    if (a && a.comment && a.comment.trim()) out.push({ u, text: a.comment.trim() });
  });
  return out;
}

// Inline comment block rendered directly under a question's score row.
// Kept neutral — the only color is each reviewer's small avatar, which is
// enough to tell them apart without the row turning into a rainbow.
function qCommentsHtml(submitted, empReviews, qid) {
  const cs = qComments(submitted, empReviews, qid);
  if (!cs.length) return '';
  return `
    <div class="sr-qcomments">
      <div class="sr-qc-label">${icon('chat', { size: 12, color: 'var(--faint)', stroke: 2.2 })} Nhận xét (${cs.length})</div>
      ${cs.map(c => `
      <div class="sr-qcomment">
        ${avatar(c.u.name, 24)}
        <div style="flex:1;min-width:0">
          <span class="sr-qc-name">${esc(c.u.name)}</span>
          <div class="sr-qc-text">${esc(c.text)}</div>
        </div>
      </div>`).join('')}
    </div>`;
}

// Bottom section: each reviewer's overall comment (per-question explanations
// now live inline with their question in the score table). Reviewers with no
// overall comment are skipped.
function commentsHtml(submitted, empReviews) {
  const blocks = submitted.map(u => {
    const r = empReviews[u.id] || {};
    const overall = r.overallComment && r.overallComment.trim() ? r.overallComment.trim() : null;
    return { u, overall };
  }).filter(b => b.overall);

  if (!blocks.length) {
    return `<div class="card"><div style="font-size:13.5px;color:var(--sub);text-align:center;padding:8px 0">Chưa có nhận xét tổng quan nào.</div></div>`;
  }

  return blocks.map(b => `
    <div class="card" style="padding:18px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        ${avatar(b.u.name, 30)}
        <span style="font-size:14px;font-weight:700;color:var(--ink)">${esc(b.u.name)}</span>
      </div>
      <div style="font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-wrap">${esc(b.overall)}</div>
    </div>`).join('');
}

function wire(container, emp, user) {
  container.querySelector('[data-back]').addEventListener('click', () => nav('/employees'));
  const assignBtn = container.querySelector('[data-assign]');
  if (assignBtn) assignBtn.addEventListener('click', () => openAssignModal(emp));

  const resetAll = container.querySelector('[data-reset-all]');
  if (resetAll) resetAll.addEventListener('click', () => resetAllFinals(emp.id));

  const resultBtn = container.querySelector('[data-result]');
  if (resultBtn) resultBtn.addEventListener('click', () => openResultModal(emp.id));

  // group collapse / expand
  container.querySelectorAll('[data-ed-toggle]').forEach(btn => {
    const gid = btn.dataset.edToggle;
    const body = container.querySelector(`[data-ed-body="${CSS.escape(gid)}"]`);
    const chevron = container.querySelector(`[data-ed-chevron="${CSS.escape(gid)}"]`);
    btn.addEventListener('click', () => {
      const collapsed = body.classList.toggle('sr-grp-body--collapsed');
      chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
      btn.style.borderBottom = collapsed ? 'none' : '1px solid var(--line)';
    });
  });

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
