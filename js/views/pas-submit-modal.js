/* ═══════════════════════════════════════════════════════════════
   PAS SUBMIT — confirm modal for pushing an employee's finalized
   result to the company system (PAS). Shared by the employee-detail
   page and the employee list, so both entry points behave identically.

   Guards: lists every blocker (missing scores / fractional finals /
   no final comment / no assessment id / no token) and disables confirm
   until they're all cleared. On success it records the submission and
   toasts; auth failures prompt for a fresh token in-place.
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, btn, openModal, toast, bandColor, bandBg } from '../ui.js';
import { state, allQuestionIds, weightedFinal, classify, finalCommentOf, recordPasSubmission } from '../store.js';
import { requestRender } from '../bus.js';
import {
  pasBlockers, assessmentIdOf, hasPasToken, getPasToken, setPasToken, submitToPas,
} from '../pas.js';

const fmt2 = v => v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2);

export function openPasSubmitModal(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) { toast('Không tìm thấy nhân viên.', { type: 'error' }); return; }

  const finalComment = finalCommentOf(empId);
  const assessmentId = assessmentIdOf(empId);
  const qCount = allQuestionIds().length;
  const final = weightedFinal(empId);
  const band = classify(final);
  const prevSubmit = state.pasSubmissions && state.pasSubmissions[empId];

  const m = openModal({
    title: 'Nộp kết quả lên PAS',
    subtitle: `Đẩy điểm final của ${emp.name} lên hệ thống công ty.`,
    width: 500,
    contentHtml: `<div data-pas-body style="padding:20px 26px 24px"></div>`,
  });

  const bodyEl = m.body.querySelector('[data-pas-body]');
  let submitting = false;
  // token input opens automatically when there's no saved token
  let tokenOpen = !hasPasToken();

  function paint() {
    const blockers = pasBlockers(empId, finalComment);
    // don't count "no token" as a blocker while the token field is open —
    // the manager is about to type it; we validate again on confirm.
    const shownBlockers = blockers.filter(b => !(tokenOpen && b.includes('token')));
    const ready = shownBlockers.length === 0;

    bodyEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        ${avatar(emp.name, 42)}
        <div style="flex:1;min-width:0">
          <div style="font-size:15.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(emp.name)}</div>
          <div style="font-size:12.5px;color:var(--sub)">${esc(emp.title || '')}${emp.dept ? ' · ' + esc(emp.dept) : ''}</div>
        </div>
        ${band ? `<span style="display:inline-flex;align-items:center;gap:6px;background:${bandBg(band.id)};border:1.5px solid ${bandColor(band.id)};padding:5px 10px;border-radius:999px">
          <span style="width:18px;height:18px;border-radius:50%;background:${bandColor(band.id)};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">${esc(band.id)}</span>
          <span style="font-size:12px;font-weight:700;color:${bandColor(band.id)}">${fmt2(final)}</span>
        </span>` : ''}
      </div>

      <div style="border:1px solid var(--line);border-radius:9px;overflow:hidden;margin-bottom:16px">
        ${infoRow('Assessment ID', assessmentId
          ? `<span style="font-family:monospace;font-size:12.5px;color:var(--ink)">${esc(assessmentId)}</span>`
          : `<span style="color:var(--danger);font-weight:700">Chưa có</span>`)}
        ${infoRow('Số tiêu chí gửi', `<span style="font-weight:700;color:var(--ink)">${qCount}</span>`, true)}
        ${infoRow('Nhận xét final', finalComment
          ? `<span style="color:var(--ink)">${esc(finalComment.length > 60 ? finalComment.slice(0, 60) + '…' : finalComment)}</span>`
          : `<span style="color:var(--danger);font-weight:700">Chưa có</span>`, true)}
      </div>

      ${prevSubmit ? `
      <div style="display:flex;align-items:center;gap:9px;padding:10px 13px;background:#EEF1F8;border-radius:8px;margin-bottom:16px;font-size:12.5px;color:#3D4B66">
        ${icon('check', { size: 15, color: '#5B6B8A', stroke: 2.6 })}
        Đã nộp trước đó lúc ${new Date(prevSubmit.submittedAt).toLocaleString('vi-VN')}. Nộp lại sẽ ghi đè bản nháp trên PAS.
      </div>` : ''}

      ${shownBlockers.length ? `
      <div style="padding:12px 15px;background:var(--warn-bg);border:1px solid #EFD9AE;border-radius:9px;margin-bottom:16px">
        <div style="font-size:12.5px;font-weight:700;color:#8A5A12;margin-bottom:7px;display:flex;align-items:center;gap:6px">
          ${icon('alert', { size: 15, color: 'var(--warn)', stroke: 2.4 })} Chưa thể nộp:
        </div>
        <ul style="margin:0;padding-left:20px;font-size:12.5px;color:#8A5A12;line-height:1.6">
          ${shownBlockers.map(b => `<li>${esc(b)}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${tokenOpen ? `
      <div style="margin-bottom:16px">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--faint);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:7px">Token PAS (Bearer)</label>
        <textarea class="textarea" data-token style="min-height:70px;font-family:monospace;font-size:12px" placeholder="Dán token từ PAS vào đây…">${esc(getPasToken())}</textarea>
        <div style="font-size:11.5px;color:var(--faint);margin-top:6px">Token lưu trên máy này (localStorage), không đưa lên hệ thống. Hết hạn ~7 ngày.</div>
      </div>` : `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 13px;background:var(--ok-bg);border-radius:8px;margin-bottom:16px">
        <span style="font-size:12.5px;font-weight:600;color:#147A50;display:flex;align-items:center;gap:6px">
          ${icon('check', { size: 14, color: 'var(--ok)', stroke: 3 })} Đã có token PAS
        </span>
        <button class="text-underline-btn" data-change-token style="color:var(--blue);font-weight:700;font-size:12.5px">Đổi token</button>
      </div>`}

      <div style="display:flex;gap:10px;justify-content:flex-end">
        ${btn({ label: 'Huỷ', variant: 'soft', attrs: 'data-cancel' })}
        ${btn({ label: submitting ? 'Đang nộp…' : 'Nộp lên PAS', variant: 'primary', icon: submitting ? undefined : 'upload', disabled: submitting || !ready, attrs: 'data-confirm' })}
      </div>`;

    wireBody();
  }

  function wireBody() {
    const tokenTa = bodyEl.querySelector('[data-token]');
    if (tokenTa) tokenTa.addEventListener('input', () => setPasToken(tokenTa.value));

    const changeBtn = bodyEl.querySelector('[data-change-token]');
    if (changeBtn) changeBtn.addEventListener('click', () => { tokenOpen = true; paint(); });

    bodyEl.querySelector('[data-cancel]').addEventListener('click', m.close);
    bodyEl.querySelector('[data-confirm]').addEventListener('click', doSubmit);
  }

  async function doSubmit() {
    if (submitting) return;
    // Re-validate everything (incl. token) at the moment of submit.
    const blockers = pasBlockers(empId, finalComment);
    if (blockers.length) {
      // If the only thing missing is the token, keep the field open and nudge.
      if (blockers.every(b => b.includes('token'))) {
        tokenOpen = true;
        toast('Dán token PAS trước khi nộp.', { type: 'error' });
      }
      paint();
      return;
    }

    submitting = true;
    paint();
    try {
      await submitToPas(empId, finalComment);
      await recordPasSubmission(empId);
      m.close();
      toast(`Đã nộp kết quả của ${emp.name} lên PAS.`);
      requestRender();
    } catch (e) {
      submitting = false;
      if (e && e.code === 'PAS_TOKEN') {
        tokenOpen = true;
        toast(e.message || 'Token PAS không hợp lệ — dán token mới.', { type: 'error' });
      } else {
        toast((e && e.message) || 'Không nộp được lên PAS. Vui lòng thử lại.', { type: 'error' });
      }
      paint();
    }
  }

  paint();
}

function infoRow(label, valueHtml, border = false) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;${border ? 'border-top:1px solid var(--line);' : ''}">
    <span style="font-size:12.5px;color:var(--sub);font-weight:600">${esc(label)}</span>
    <span style="min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${valueHtml}</span>
  </div>`;
}
