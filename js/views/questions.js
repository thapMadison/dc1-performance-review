/* ═══════════════════════════════════════════════════════════════
   MANAGER · QUESTIONS — question set grouped view + Excel import
═══════════════════════════════════════════════════════════════ */

import { esc, pageHead, emptyState, btn, hiCard, NOTCH, GROUP_COLORS, wireCollapsibles } from '../ui.js';
import { state, groupWeight, totalWeight, setGroupWeight } from '../store.js';
import { openImportModal } from './import-modal.js';

export function renderQuestions(container) {
  const { groups } = state;
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const sumW = Math.round(totalWeight() * 100) / 100;
  const weightOk = groups.length === 0 || sumW === 100;
  const stats = [
    { l: 'Số nhóm', v: groups.length },
    { l: 'Tổng câu hỏi', v: total },
    { l: 'Tổng trọng số', v: `${sumW}%`, tone: weightOk ? 'var(--blue)' : 'var(--warn)',
      vColor: weightOk ? 'var(--ink)' : 'var(--warn)',
      note: weightOk ? '' : 'Nên bằng 100%' },
  ];

  container.innerHTML = `
    ${pageHead({
      eyebrow: 'Cấu hình', title: 'Bộ câu hỏi đánh giá',
      desc: 'Các câu hỏi được dùng cho mọi bản đánh giá trong chu kỳ. Import từ Excel để cập nhật.',
      actionsHtml: btn({ label: 'Import câu hỏi', variant: 'primary', icon: 'upload', attrs: 'data-import' }),
    })}

    <div class="stat-row stat-row-3" style="margin-bottom:26px">
      ${stats.map(s => hiCard({
        tone: s.tone || 'var(--blue)', pad: 18, style: 'flex:1',
        body: `
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">${esc(s.l)}</div>
          <div style="font-size:28px;font-weight:700;color:${s.vColor || 'var(--ink)'};letter-spacing:-0.03em">${s.v}</div>
          ${s.note ? `<div style="font-size:11.5px;font-weight:600;color:var(--warn);margin-top:4px">${esc(s.note)}</div>` : ''}`,
      })).join('')}
    </div>

    <div style="display:flex;flex-direction:column;gap:18px">
      ${groups.map((g, gi) => {
        const color = GROUP_COLORS[gi % GROUP_COLORS.length];
        return `
        <div class="card q-group" style="padding:0;overflow:hidden;border-left:3px solid ${color}" data-gidx="${gi}">
          <button class="q-group-header" data-toggle="${gi}" style="display:flex;align-items:center;gap:11px;padding:16px 22px;background:#FAFBFC;border-bottom:1px solid var(--line);width:100%;border:none;cursor:pointer;text-align:left">
            <div style="width:26px;height:26px;clip-path:${NOTCH(7)};background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${gi + 1}</div>
            <h2 style="font-size:16.5px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;flex:1">${esc(g.name)}</h2>
            <span class="q-weight" data-weight-wrap="${esc(g.id)}" title="Trọng số nhóm — bấm để chỉnh sửa" style="display:inline-flex;align-items:center;gap:1px;font-size:12.5px;font-weight:700;color:${color};background:${color}15;padding:3px 9px;border-radius:6px;margin-right:8px;cursor:text">
              <input class="q-weight-input" data-weight="${esc(g.id)}" type="number" min="0" max="100" step="1" value="${groupWeight(g.id)}"
                style="width:34px;border:none;background:transparent;color:${color};font-weight:700;font-size:12.5px;font-family:var(--font);text-align:right;outline:none;padding:0;-moz-appearance:textfield">%
            </span>
            <span style="font-size:12px;font-weight:600;color:var(--faint);margin-right:10px">${g.items.length} câu hỏi</span>
            <svg class="q-chevron" data-chevron="${gi}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .22s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="q-group-body" data-body="${gi}">
            ${g.items.map((q, qi) => `
              <div style="display:flex;gap:14px;padding:14px 22px;${qi < g.items.length - 1 ? 'border-bottom:1px solid var(--line);' : ''}">
                <span style="font-size:13px;font-weight:700;color:${color};min-width:26px">${gi + 1}.${qi + 1}</span>
                <div style="flex:1">
                  <div style="font-size:14.5px;font-weight:700;color:var(--ink)">${esc(q.text)}</div>
                  ${q.hint ? `<div style="font-size:13px;color:var(--sub);margin-top:2px;line-height:1.45">${esc(q.hint)}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
      }).join('')}
      ${!groups.length ? `<div class="card">${emptyState({ icon: 'help', title: 'Chưa có bộ câu hỏi', desc: 'Import file Excel chứa các câu hỏi đánh giá theo nhóm để bắt đầu.' })}</div>` : ''}
    </div>
  `;

  container.querySelector('[data-import]').addEventListener('click', () => openImportModal('questions'));

  // Per-group weight editing (manager-only page). The input lives inside the
  // collapse-toggle button, so swallow clicks/keys to keep the group from
  // folding while editing. Commit on Enter/blur; the store re-renders.
  container.querySelectorAll('[data-weight]').forEach(input => {
    const gid = input.dataset.weight;
    const stop = e => e.stopPropagation();
    input.addEventListener('click', stop);
    input.addEventListener('mousedown', stop);
    let committing = false;
    const commit = () => {
      if (committing) return;
      committing = true;
      const cur = groupWeight(gid);
      const next = Math.max(0, Math.min(100, Math.round(Number(input.value) || 0)));
      if (next !== cur) setGroupWeight(gid, next); // notify → re-render
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      stop(e);
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = groupWeight(gid); input.blur(); }
    });
  });

  wireCollapsibles(container, {
    toggleAttr: 'data-toggle', bodyAttr: 'data-body', chevronAttr: 'data-chevron',
    collapsedClass: 'q-group-body--collapsed',
    onToggle: (btn, collapsed) => { btn.style.borderBottom = collapsed ? 'none' : '1px solid var(--line)'; },
  });
}
