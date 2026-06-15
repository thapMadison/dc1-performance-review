/* ═══════════════════════════════════════════════════════════════
   MANAGER · QUESTIONS — question set grouped view + Excel import
═══════════════════════════════════════════════════════════════ */

import { esc, pageHead, emptyState, btn, hiCard, NOTCH } from '../ui.js';
import { state } from '../store.js';
import { openImportModal } from './import-modal.js';

export function renderQuestions(container) {
  const { groups } = state;
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const stats = [
    { l: 'Số nhóm', v: groups.length },
    { l: 'Tổng câu hỏi', v: total },
    { l: 'Thang điểm', v: '1–5' },
  ];

  container.innerHTML = `
    ${pageHead({
      eyebrow: 'Cấu hình', title: 'Bộ câu hỏi đánh giá',
      desc: 'Các câu hỏi được dùng cho mọi bản đánh giá trong chu kỳ. Import từ Excel để cập nhật.',
      actionsHtml: btn({ label: 'Import câu hỏi', variant: 'primary', icon: 'upload', attrs: 'data-import' }),
    })}

    <div class="stat-row stat-row-3" style="margin-bottom:26px">
      ${stats.map(s => hiCard({
        tone: 'var(--blue)', pad: 18, style: 'flex:1',
        body: `
          <div style="font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">${esc(s.l)}</div>
          <div style="font-size:28px;font-weight:700;color:var(--ink);letter-spacing:-0.03em">${s.v}</div>`,
      })).join('')}
    </div>

    <div style="display:flex;flex-direction:column;gap:18px">
      ${groups.map((g, gi) => `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="display:flex;align-items:center;gap:11px;padding:16px 22px;background:#FAFBFC;border-bottom:1px solid var(--line)">
            <div style="width:26px;height:26px;clip-path:${NOTCH(7)};background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${gi + 1}</div>
            <h2 style="font-size:16.5px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">${esc(g.name)}</h2>
            <span style="margin-left:auto;font-size:12px;font-weight:600;color:var(--faint)">${g.items.length} câu hỏi</span>
          </div>
          <div>
            ${g.items.map((q, qi) => `
              <div style="display:flex;gap:14px;padding:14px 22px;${qi < g.items.length - 1 ? 'border-bottom:1px solid var(--line);' : ''}">
                <span style="font-size:13px;font-weight:700;color:var(--faint);min-width:26px">${gi + 1}.${qi + 1}</span>
                <div style="flex:1">
                  <div style="font-size:14.5px;font-weight:700;color:var(--ink)">${esc(q.text)}</div>
                  ${q.hint ? `<div style="font-size:13px;color:var(--sub);margin-top:2px;line-height:1.45">${esc(q.hint)}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      ${!groups.length ? `<div class="card">${emptyState({ icon: 'help', title: 'Chưa có bộ câu hỏi', desc: 'Import file Excel chứa các câu hỏi đánh giá theo nhóm để bắt đầu.' })}</div>` : ''}
    </div>
  `;

  container.querySelector('[data-import]').addEventListener('click', () => openImportModal('questions'));
}
