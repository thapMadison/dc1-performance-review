/* ═══════════════════════════════════════════════════════════════
   MY RESULT — the current user's own finalized review result.
   Read-only render of the memberResults/$empId snapshot written by
   the manager at PAS submit: per-question final scores, weighted
   total + band, and the final comment. Shows aggregated finals
   only — never per-reviewer scores or identities. Question texts,
   group names and weights come from the shared nodes every
   signed-in user can read.
═══════════════════════════════════════════════════════════════ */

import { esc, icon, pageHead, emptyState, eyebrowMark, GROUP_COLORS, bandColor, bandBg, wireCollapsibles } from '../ui.js';
import { state, groupWeight } from '../store.js';
import { APP_CYCLE } from '../firebase-config.js';

// 2-decimal display formatter (same as employee-detail.js)
const fmt2 = v => v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2);

export function renderMyResult(container, user) {
  const head = pageHead({
    eyebrow: 'Kết quả',
    title: 'Kết quả của tôi',
    desc: `Kết quả đánh giá đã được Manager chốt trong chu kỳ ${APP_CYCLE}.`,
  });

  if (!user.empId) {
    container.innerHTML = `${head}<div class="card">${emptyState({
      icon: 'lock', title: 'Tài khoản chưa gắn với hồ sơ nhân viên',
      desc: 'Email của bạn chưa có trong danh sách nhân viên của chu kỳ này.',
    })}</div>`;
    return;
  }

  const res = state.memberResults[user.empId];
  if (!res) {
    container.innerHTML = `${head}<div class="card">${emptyState({
      icon: 'lock', title: 'Kết quả chưa được chốt',
      desc: 'Kết quả sẽ hiển thị tại đây sau khi Manager chốt và nộp kết quả của bạn lên PAS.',
    })}</div>`;
    return;
  }

  const scores = res.scores || {};

  container.innerHTML = `
    ${head}
    ${resultHeroHtml(res)}
    ${scoreTableHtml(scores)}
    ${finalCommentHtml(res.finalComment)}
  `;

  wireCollapsibles(container, {
    toggleAttr: 'data-mr-toggle', bodyAttr: 'data-mr-body', chevronAttr: 'data-mr-chevron',
    collapsedClass: 'sr-grp-body--collapsed',
    onToggle: (btn, collapsed) => { btn.style.borderBottom = collapsed ? 'none' : '1px solid var(--line)'; },
  });
}

// Navy result bar — the member-facing twin of employee-detail's resultBarHtml,
// rendered from the frozen snapshot instead of live computed values.
function resultHeroHtml(res) {
  return `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:22px">
      <div style="display:flex;align-items:center;gap:18px;padding:16px 22px;background:var(--navy);flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px">Kết quả cuối cùng (có trọng số)</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.7)">Σ (điểm TB nhóm × trọng số)</div>
        </div>
        ${res.bandId ? `<span style="display:inline-flex;align-items:center;gap:7px;background:${bandBg(res.bandId)};border:1.5px solid ${bandColor(res.bandId)};padding:6px 12px;border-radius:999px">
          <span style="width:22px;height:22px;border-radius:50%;background:${bandColor(res.bandId)};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${esc(res.bandId)}</span>
          <span style="font-size:13px;font-weight:700;color:${bandColor(res.bandId)}">${esc(res.bandLabel || res.bandId)}</span>
        </span>` : ''}
        <div style="display:flex;align-items:baseline;gap:3px">
          <span style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.02em">${fmt2(res.weightedFinal)}</span>
          <span style="font-size:13px;color:rgba(255,255,255,0.6);font-weight:600">/5</span>
        </div>
      </div>
      ${res.finalizedAt ? `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 22px;background:#EAF7EF;border-top:1px solid #BFE3CC;font-size:12.5px;color:#147A50;font-weight:600">
        ${icon('check', { size: 14, color: 'var(--ok)', stroke: 3 })} Đã chốt lúc ${new Date(res.finalizedAt).toLocaleString('vi-VN')}
      </div>` : ''}
    </div>`;
}

// Per-question final scores, one collapsible card per question group.
// Group averages are recomputed from the snapshot (unscored counts as 0,
// same rule as store.groupAvg); weights are display-only from shared config.
function scoreTableHtml(scores) {
  const GRID = 'display:grid;grid-template-columns:1fr 90px;gap:0';
  return `
    <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin-bottom:14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Điểm final từng câu hỏi</h2>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:8px">
      ${state.groups.map((g, gi) => {
        const color = GROUP_COLORS[gi % GROUP_COLORS.length];
        const items = g.items || [];
        const avg = items.length ? items.reduce((a, q) => a + (scores[q.id] ?? 0), 0) / items.length : null;
        const weight = groupWeight(g.id);
        return `
        <div class="card sr-grp" style="padding:0;overflow:hidden;border-left:3px solid ${color}">
          <button class="sr-band" data-mr-toggle="${esc(g.id)}" style="padding:9px 22px;background:#F3F6F9;font-size:12px;font-weight:700;color:var(--navy);letter-spacing:0.02em;display:flex;align-items:center;gap:8px;width:100%;border:none;border-bottom:1px solid var(--line);cursor:pointer;font-family:var(--font);text-align:left;transition:background .14s">
            <span style="width:18px;height:18px;border-radius:5px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${gi + 1}</span>
            <span style="flex:1">${esc(g.name)}</span>
            <span style="font-size:11.5px;font-weight:700;color:${color}">TB ${fmt2(avg)} · ${weight}%</span>
            <svg data-mr-chevron="${esc(g.id)}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .22s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="sr-grp-body" data-mr-body="${esc(g.id)}">
          ${items.map(q => {
            const sc = scores[q.id];
            return `
            <div class="sr-row" style="${GRID};padding:11px 22px;border-bottom:1px solid var(--line);align-items:center">
              <div style="font-size:14px;font-weight:600;color:var(--ink);padding-right:12px">${esc(q.text)}</div>
              <div style="text-align:center;font-size:14.5px;font-weight:700;color:${sc != null ? 'var(--ink)' : 'var(--faint)'}">${sc != null ? sc : '—'}</div>
            </div>`;
          }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// The manager's final comment (the text sent to PAS). Hidden when empty.
function finalCommentHtml(text) {
  if (!text) return '';
  return `
    <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin:32px 0 14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}Nhận xét final</h2>
    <div class="card" style="padding:18px">
      <div style="font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-wrap">${esc(text)}</div>
    </div>`;
}
