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
  const self = state.selfResponses[user.empId] || null;
  const selfScores = self && self.scores ? self.scores : null;

  container.innerHTML = `
    ${head}
    ${resultHeroHtml(res, self)}
    ${scoreTableHtml(scores, selfScores)}
    ${commentsHtml(res.finalComment, self && self.comment)}
  `;

  wireCollapsibles(container, {
    toggleAttr: 'data-mr-toggle', bodyAttr: 'data-mr-body', chevronAttr: 'data-mr-chevron',
    collapsedClass: 'sr-grp-body--collapsed',
    onToggle: (btn, collapsed) => { btn.style.borderBottom = collapsed ? 'none' : '1px solid var(--line)'; },
  });
}

// Navy result bar — the member-facing twin of employee-detail's resultBarHtml,
// rendered from the frozen snapshot instead of live computed values. When the
// member's own self-assessment is present, its total is shown as a subtle
// secondary figure next to the manager's weighted final for quick comparison.
function resultHeroHtml(res, self) {
  const selfTotal = self && self.totalScore != null ? self.totalScore : null;
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
        ${selfTotal != null ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
          <span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.06em;text-transform:uppercase">Tự đánh giá</span>
          <div style="display:flex;align-items:baseline;gap:3px">
            <span style="font-size:18px;font-weight:700;color:rgba(255,255,255,0.75)">${fmt2(selfTotal)}</span>
            <span style="font-size:11px;color:rgba(255,255,255,0.45);font-weight:600">/5</span>
          </div>
        </div>` : ''}
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
          ${selfTotal != null ? `<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.06em;text-transform:uppercase">Manager</span>` : ''}
          <div style="display:flex;align-items:baseline;gap:3px">
            <span style="font-size:26px;font-weight:700;color:#fff;letter-spacing:-0.02em">${fmt2(res.weightedFinal)}</span>
            <span style="font-size:13px;color:rgba(255,255,255,0.6);font-weight:600">/5</span>
          </div>
        </div>
      </div>
      ${res.finalizedAt ? `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 22px;background:#EAF7EF;border-top:1px solid #BFE3CC;font-size:12.5px;color:#147A50;font-weight:600">
        ${icon('check', { size: 14, color: 'var(--ok)', stroke: 3 })} Đã chốt lúc ${new Date(res.finalizedAt).toLocaleString('vi-VN')}
      </div>` : ''}
    </div>`;
}

// Score color scale (1–5): red → amber → blue → green. Used to tint the
// per-question score chips so long question lists can be scanned at a glance.
const SCORE_COLORS = {
  5: { fg: '#147A50', bg: '#E3F5EB' },
  4: { fg: '#1D6FD6', bg: '#E8F1FC' },
  3: { fg: '#B26A00', bg: '#FDF2DF' },
  2: { fg: '#C2410C', bg: '#FCEBE1' },
  1: { fg: '#B91C1C', bg: '#FBE7E7' },
};

// A single score rendered as a colored chip. Manager scores are filled
// (tinted background), self scores are outlined — same color scale, but the
// manager's final stays visually dominant. null → plain faint dash.
function scoreChip(v, strong) {
  if (v == null) return '<span style="font-size:14px;font-weight:700;color:var(--faint)">—</span>';
  const c = SCORE_COLORS[v] || { fg: 'var(--ink)', bg: '#F0F2F5' };
  return strong
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:25px;padding:0 7px;border-radius:8px;background:${c.bg};color:${c.fg};font-size:13.5px;font-weight:700">${v}</span>`
    : `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:25px;padding:0 7px;border-radius:8px;background:#fff;border:1.5px solid ${c.fg}40;color:${c.fg};font-size:13px;font-weight:700">${v}</span>`;
}

// Per-question scores, one collapsible card per question group. When the
// member's own self-assessment is available (selfScores), each row shows two
// score columns — "Tự đánh giá" (self) beside "Manager" (final) — for a
// direct comparison; otherwise it falls back to the single manager column.
// Rows where the two disagree get a whisper of background tint (green when
// the manager scored higher, red when lower) plus the +N/−N badge.
// Group averages are recomputed (unscored counts as 0, same rule as
// store.groupAvg); weights are display-only from shared config.
function scoreTableHtml(scores, selfScores) {
  const cmp = !!selfScores; // comparison mode
  const GRID = cmp
    ? 'display:grid;grid-template-columns:1fr 82px 82px;gap:0'
    : 'display:grid;grid-template-columns:1fr 90px;gap:0';
  const avgOf = (items, src) => items.length
    ? items.reduce((a, q) => a + (src[q.id] ?? 0), 0) / items.length : null;
  return `
    <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin-bottom:14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}${cmp ? 'So sánh điểm từng câu hỏi' : 'Điểm final từng câu hỏi'}</h2>
    ${cmp ? `<div style="${GRID};padding:0 22px 8px;align-items:end">
      <div></div>
      <div style="text-align:center;font-size:10.5px;font-weight:700;color:var(--sub);letter-spacing:0.04em;text-transform:uppercase">Tự đánh giá</div>
      <div style="text-align:center;font-size:10.5px;font-weight:700;color:var(--navy);letter-spacing:0.04em;text-transform:uppercase">Manager</div>
    </div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:8px">
      ${state.groups.map((g, gi) => {
        const color = GROUP_COLORS[gi % GROUP_COLORS.length];
        const items = g.items || [];
        const avg = avgOf(items, scores);
        const selfAvg = cmp ? avgOf(items, selfScores) : null;
        const weight = groupWeight(g.id);
        return `
        <div class="card sr-grp" style="padding:0;overflow:hidden;border-left:3px solid ${color}">
          <button class="sr-band" data-mr-toggle="${esc(g.id)}" style="${GRID};align-items:center;padding:8px 22px;background:#F3F6F9;font-size:12px;font-weight:700;color:var(--navy);letter-spacing:0.02em;width:100%;border:none;border-bottom:1px solid var(--line);cursor:pointer;font-family:var(--font);text-align:left;transition:background .14s">
            <span style="display:flex;align-items:center;gap:8px;min-width:0;padding-right:12px">
              <span style="width:18px;height:18px;border-radius:5px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${gi + 1}</span>
              <span style="min-width:0">
                <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</span>
                <span style="display:block;font-size:10.5px;font-weight:600;color:var(--faint);letter-spacing:0.02em">Trọng số ${weight}%</span>
              </span>
            </span>
            ${cmp ? `<span style="text-align:center;font-size:13px;font-weight:700;color:var(--sub)">${fmt2(selfAvg)}</span>` : ''}
            <span style="display:flex;align-items:center;justify-content:center;gap:6px">
              <span style="font-size:${cmp ? '13.5px' : '12px'};font-weight:700;color:${cmp ? 'var(--ink)' : color}">${cmp ? '' : 'TB '}${fmt2(avg)}</span>
              <svg data-mr-chevron="${esc(g.id)}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .22s"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </button>
          <div class="sr-grp-body" data-mr-body="${esc(g.id)}">
          ${items.map(q => {
            const sc = scores[q.id];
            const self = cmp ? selfScores[q.id] : null;
            const diff = cmp && sc != null && self != null ? sc - self : null;
            const rowBg = diff ? (diff > 0 ? '#F7FCF9' : '#FEF6F5') : '';
            return `
            <div class="sr-row" style="${GRID};padding:11px 22px;border-bottom:1px solid var(--line);align-items:center${rowBg ? `;background:${rowBg}` : ''}">
              <div style="padding-right:12px">
                <div style="font-size:14px;font-weight:600;color:var(--ink)">${esc(q.text)}</div>
                ${q.hint ? `<div style="font-size:13px;color:var(--sub);margin-top:2px;line-height:1.45">${esc(q.hint)}</div>` : ''}
              </div>
              ${cmp ? `<div style="text-align:center">${scoreChip(self, false)}</div>` : ''}
              <div style="text-align:center;position:relative">
                ${scoreChip(sc, true)}
                ${diff ? `<span style="position:absolute;top:50%;right:2px;transform:translateY(-50%);font-size:10px;font-weight:700;color:${diff > 0 ? 'var(--ok)' : '#C0392B'}">${diff > 0 ? '+' : ''}${diff}</span>` : ''}
              </div>
            </div>`;
          }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// Comments block. Shows the member's own self-comment (when present) next to
// the manager's final comment so they can be compared. Each is hidden when
// empty; the whole block collapses to nothing if neither exists.
function commentsHtml(finalText, selfText) {
  const hasFinal = !!finalText;
  const hasSelf = !!selfText;
  if (!hasFinal && !hasSelf) return '';
  const card = (label, text, accent) => `
    <div class="card" style="padding:0;overflow:hidden;flex:1;min-width:260px">
      <div style="padding:9px 18px;background:#F3F6F9;border-bottom:1px solid var(--line);font-size:11px;font-weight:700;color:${accent};letter-spacing:0.05em;text-transform:uppercase">${esc(label)}</div>
      <div style="padding:16px 18px;font-size:14px;color:var(--ink);line-height:1.6;white-space:pre-wrap">${esc(text)}</div>
    </div>`;
  return `
    <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;margin:32px 0 14px;display:flex;align-items:center;gap:10px">${eyebrowMark(11)}${hasSelf && hasFinal ? 'Nhận xét' : (hasSelf ? 'Nhận xét của bạn' : 'Nhận xét final')}</h2>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      ${hasSelf ? card('Tự đánh giá (của bạn)', selfText, 'var(--sub)') : ''}
      ${hasFinal ? card('Nhận xét final (Manager)', finalText, 'var(--navy)') : ''}
    </div>`;
}
