/* ═══════════════════════════════════════════════════════════════
   REVIEW FORM — grouped questions · hint · 1–5 scale · optional
   comment · sticky progress rail · draft / submit → locked.
   Answers live in a local working copy; the store is only written
   on "Lưu nháp" / "Nộp" (so typing never fights re-renders).
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, ratingScale, progress, emptyState, openModal, btn, SCALE_LABELS, SCALE_COLORS, NOTCH } from '../ui.js';
import { state, allQuestionIds, reviewOf, saveReview } from '../store.js';
import { nav } from '../router.js';
import { requestRender } from '../bus.js';

// One in-progress form session at a time (reset when empId/reviewer changes)
let session = null;

function getSession(empId, reviewerId) {
  if (session && session.empId === empId && session.reviewerId === reviewerId) return session;
  const existing = reviewOf(empId, reviewerId);
  const answers = {};
  const openComments = {};
  allQuestionIds().forEach(q => { answers[q] = { score: null, comment: '' }; });
  if (existing && existing.answers) {
    Object.entries(existing.answers).forEach(([q, a]) => {
      if (answers[q]) {
        answers[q] = { score: a.score ?? null, comment: a.comment || '' };
        if (a.comment) openComments[q] = true;
      }
    });
  }
  session = { empId, reviewerId, answers, openComments, saved: false };
  return session;
}
export function clearReviewSession() { session = null; }

export function renderReviewForm(container, user, empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'help', title: 'Không tìm thấy nhân viên', desc: 'Nhân viên này không còn trong danh sách.' })}</div>`;
    return;
  }
  const myId = user.empId;
  const existing = myId ? reviewOf(empId, myId) : null;
  const assigned = myId && (emp.reviewerIds || {})[myId];
  if (!assigned && !existing) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'lock', title: 'Bạn không được phân công', desc: 'Bạn không phải là reviewer của nhân viên này.' })}</div>`;
    return;
  }

  const locked = existing && existing.status === 'submitted';
  const s = getSession(empId, myId);
  const qids = allQuestionIds();
  const ans = qids.filter(q => s.answers[q] && s.answers[q].score != null).length;
  const pct = qids.length ? Math.round(ans / qids.length * 100) : 0;
  const complete = qids.length > 0 && ans === qids.length;

  container.innerHTML = `
  <div class="review-layout" style="display:flex;gap:32px;align-items:flex-start">
    <div style="flex:1;min-width:0">
      <button class="back-btn" data-back>← Danh sách đánh giá</button>

      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        ${avatar(emp.name, 54)}
        <div style="flex:1">
          <h1 style="font-size:27px;font-weight:700;color:var(--ink);letter-spacing:-0.03em;line-height:1.05">${esc(emp.name)}</h1>
          <div style="font-size:14px;color:var(--sub);margin-top:3px">${esc(emp.title)}${emp.dept ? ' · ' + esc(emp.dept) : ''} · ${esc(emp.email)}</div>
        </div>
        ${statusPill(locked ? 'locked' : (existing ? existing.status : 'pending'))}
      </div>

      ${locked ? `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#EEF1F8;border:1px solid var(--line);border-radius:9px;margin-bottom:24px">
        ${icon('lock', { size: 18, color: '#5B6B8A' })}
        <div style="font-size:13.5px;color:#3D4B66;font-weight:600">Bản đánh giá đã được nộp và khóa. Bạn không thể chỉnh sửa nữa.</div>
      </div>` : ''}

      ${state.groups.map((g, gi) => `
      <div id="grp-${esc(g.id)}" class="group-anchor" style="margin-bottom:26px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:26px;height:26px;clip-path:${NOTCH(7)};background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${gi + 1}</div>
          <h2 style="font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">${esc(g.name)}</h2>
          <div style="flex:1;height:1px;background:var(--line)"></div>
          <span style="font-size:12px;font-weight:600;color:var(--faint)">${g.items.length} câu</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${g.items.map((q, qi) => {
            const a = s.answers[q.id] || { score: null, comment: '' };
            const showC = s.openComments[q.id] || a.comment;
            return `
            <div class="card" style="padding:20px;border-color:${a.score != null ? '#29ABE240' : 'var(--line)'}">
              <div style="display:flex;gap:14px">
                <div style="font-size:13px;font-weight:700;color:var(--faint);margin-top:1px;min-width:22px">${gi + 1}.${qi + 1}</div>
                <div style="flex:1">
                  <div style="font-size:15.5px;font-weight:700;color:var(--ink);margin-bottom:4px;letter-spacing:-0.01em">${esc(q.text)}</div>
                  ${q.hint ? `<div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:16px">${esc(q.hint)}</div>` : ''}
                  ${ratingScale(q.id, a.score, locked)}
                  ${showC
                    ? `<div style="margin-top:14px"><textarea class="textarea" data-comment="${esc(q.id)}" ${locked ? 'disabled' : ''} placeholder="Thêm nhận xét cụ thể (không bắt buộc)…">${esc(a.comment)}</textarea></div>`
                    : (!locked ? `<button class="comment-toggle" data-add-comment="${esc(q.id)}">${icon('plus', { size: 14, color: 'var(--blue)' })} Thêm nhận xét</button>` : '')}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}
    </div>

    <div class="review-rail" style="width:264px;flex-shrink:0;position:sticky;top:0;padding-top:52px">
      <div class="card card-hi" style="padding:20px">
        <div class="hi-tri" style="background:color-mix(in srgb, ${complete ? 'var(--ok)' : 'var(--blue)'} 11%, transparent)"></div>
        <div class="hi-body">
        <div style="font-size:12px;font-weight:700;color:var(--faint);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px">Tiến độ</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:12px">
          <span style="font-size:38px;font-weight:700;color:${complete ? 'var(--ok)' : 'var(--blue)'};letter-spacing:-0.03em">${pct}</span>
          <span style="font-size:16px;font-weight:700;color:var(--faint)">%</span>
          <span style="font-size:13px;color:var(--sub);margin-left:auto;font-weight:600">${ans}/${qids.length} câu</span>
        </div>
        ${progress(ans, qids.length, complete ? 'var(--ok)' : 'var(--blue)', 8)}

        <div style="display:flex;flex-direction:column;gap:2px;margin:18px 0 4px">
          ${state.groups.map((g, gi) => {
            const gAns = g.items.filter(q => s.answers[q.id] && s.answers[q.id].score != null).length;
            const gDone = g.items.length > 0 && gAns === g.items.length;
            return `
            <button class="group-nav-item" data-goto="${esc(g.id)}">
              <span style="width:18px;height:18px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${gDone ? 'var(--ok)' : (gAns ? '#29ABE21A' : '#EEF1F4')};color:${gDone ? '#fff' : (gAns ? 'var(--blue)' : 'var(--faint)')}">
                ${gDone ? icon('check', { size: 11, stroke: 3 }) : `<span style="font-size:10px;font-weight:700">${gi + 1}</span>`}
              </span>
              <span style="flex:1;font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name)}</span>
              <span style="font-size:11px;font-weight:600;color:var(--faint)">${gAns}/${g.items.length}</span>
            </button>`;
          }).join('')}
        </div>

        ${!locked ? `
        <div class="rail-actions" style="display:flex;flex-direction:column;gap:9px;margin-top:18px;padding-top:18px;border-top:1px solid var(--line)">
          ${btn({ label: complete ? 'Nộp đánh giá' : `Còn ${qids.length - ans} câu`, variant: 'primary', full: true, icon: complete ? 'check' : undefined, disabled: !complete, attrs: 'data-submit' })}
          ${btn({ label: s.saved ? 'Đã lưu nháp' : 'Lưu bản nháp', variant: 'ghost', full: true, icon: s.saved ? 'check' : undefined, attrs: 'data-save' })}
        </div>` : ''}
        </div>
      </div>

      ${!locked ? `
      <div style="font-size:12px;color:var(--faint);line-height:1.55;padding:14px 4px 0;text-align:center">
        ${icon('lock', { size: 12, color: 'var(--faint)', style: 'vertical-align:-2px;margin-right:4px' })}
        Sau khi nộp, bạn sẽ không thể chỉnh sửa.
      </div>` : ''}
    </div>

    <div class="review-bottombar">
      <button class="bb-toc" data-toc title="Mục lục" aria-label="Mục lục">
        ${icon('grid', { size: 18, color: 'var(--sub)', stroke: 2.2 })}
      </button>
      <div class="bb-progress">
        <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:5px">
          <span style="font-size:16px;font-weight:700;color:${complete ? 'var(--ok)' : 'var(--blue)'};letter-spacing:-0.02em">${pct}%</span>
          <span style="font-size:11.5px;color:var(--sub);font-weight:600">${ans}/${qids.length} câu</span>
        </div>
        ${progress(ans, qids.length, complete ? 'var(--ok)' : 'var(--blue)', 6)}
      </div>
      ${locked
        ? `<span class="pill pill-locked" style="height:40px;padding:0 14px">${icon('lock', { size: 13, color: '#4B3F9E' })} Đã khóa</span>`
        : `<div class="bb-actions">
            ${btn({ label: 'Lưu', variant: 'ghost', size: 'md', attrs: 'data-save-m' })}
            ${btn({ label: complete ? 'Nộp' : `Còn ${qids.length - ans}`, variant: 'primary', size: 'md', icon: complete ? 'check' : undefined, disabled: !complete, attrs: 'data-submit-m' })}
          </div>`}
    </div>
  </div>`;

  wire(container, emp, user, locked, s, qids);
}

function wire(container, emp, user, locked, s, qids) {
  container.querySelector('[data-back]').addEventListener('click', () => nav('/myreviews'));

  // jump to a group anchor inside the app scroller (plain # links would fight the hash router)
  const goto = id => {
    const el = container.querySelector(`#grp-${CSS.escape(id)}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // group anchors (rail list on desktop)
  container.querySelectorAll('[data-goto]').forEach(b =>
    b.addEventListener('click', () => goto(b.dataset.goto)));
  // mobile "Mục lục" → sections bottom-sheet (reuses goto)
  const tocBtn = container.querySelector('[data-toc]');
  if (tocBtn) tocBtn.addEventListener('click', () => openSectionsSheet(s, qids, goto));

  // show fixed bottom bar only after rail card scrolls out of viewport (phone only)
  const bottombar = container.querySelector('.review-bottombar');
  const rail = container.querySelector('.review-rail');
  if (bottombar && rail && window.matchMedia('(max-width: 640px)').matches) {
    const obs = new IntersectionObserver(([entry]) => {
      bottombar.classList.toggle('review-bottombar--visible', !entry.isIntersecting);
    }, { threshold: 0 });
    obs.observe(rail);
  }

  if (locked) return;

  // rating buttons: hover preview updates the label in place; click re-renders
  container.querySelectorAll('.rating-btn').forEach(b => {
    const qid = b.dataset.qid;
    const label = container.querySelector(`[data-rating-label="${CSS.escape(qid)}"]`);
    const current = () => s.answers[qid].score;
    b.addEventListener('mouseenter', () => {
      const n = +b.dataset.rate;
      label.textContent = `${n} — ${SCALE_LABELS[n - 1]}`;
      label.style.color = SCALE_COLORS[n - 1];
      label.classList.add('lit');
    });
    b.addEventListener('mouseleave', () => {
      const v = current();
      label.textContent = v ? `${v} — ${SCALE_LABELS[v - 1]}` : 'Chọn mức điểm từ 1 đến 5';
      label.style.color = v ? SCALE_COLORS[v - 1] : '';
      label.classList.toggle('lit', !!v);
    });
    b.addEventListener('click', () => {
      s.answers[qid].score = +b.dataset.rate;
      s.saved = false;
      requestRender();
    });
  });

  // comments: typing only mutates the session (no re-render → caret stays put)
  container.querySelectorAll('[data-comment]').forEach(t =>
    t.addEventListener('input', () => {
      s.answers[t.dataset.comment].comment = t.value;
      s.saved = false;
    }));
  container.querySelectorAll('[data-add-comment]').forEach(b =>
    b.addEventListener('click', () => {
      s.openComments[b.dataset.addComment] = true;
      requestRender();
      const ta = document.querySelector(`[data-comment="${CSS.escape(b.dataset.addComment)}"]`);
      if (ta) ta.focus();
    }));

  // ---- shared actions (bound to both desktop rail + mobile bottom bar) ----
  const doSave = async () => {
    await saveReview(s.empId, s.reviewerId, {
      status: 'draft',
      answers: s.answers,
      submittedAt: null,
    });
    s.saved = true;
    requestRender();
    setTimeout(() => { if (session === s) { s.saved = false; requestRender(); } }, 2200);
  };

  const openSubmitConfirm = () => {
    const m = openModal({
      title: 'Xác nhận nộp đánh giá',
      subtitle: `Đánh giá cho ${emp.name} sẽ được khóa sau khi nộp.`,
      width: 460,
      contentHtml: `
        <div style="padding:22px 28px 26px">
          <div style="display:flex;gap:12px;padding:14px 16px;background:var(--warn-bg);border-radius:9px;margin-bottom:22px">
            ${icon('lock', { size: 18, color: 'var(--warn)', style: 'flex-shrink:0;margin-top:1px' })}
            <div style="font-size:13.5px;color:#8A5A12;line-height:1.5">
              Sau khi nộp, bạn <b>không thể chỉnh sửa</b> các điểm số. Điểm của bạn sẽ được tính vào điểm trung bình cuối cùng.
            </div>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            ${btn({ label: 'Quay lại', variant: 'soft', attrs: 'data-cancel' })}
            ${btn({ label: 'Nộp & khóa', variant: 'primary', icon: 'check', attrs: 'data-confirm' })}
          </div>
        </div>`,
    });
    m.body.querySelector('[data-cancel]').addEventListener('click', m.close);
    m.body.querySelector('[data-confirm]').addEventListener('click', async () => {
      await saveReview(s.empId, s.reviewerId, { status: 'submitted', answers: s.answers });
      m.close();
      clearReviewSession();
      nav('/myreviews');
    });
  };

  // desktop rail buttons + mobile bottom-bar buttons share the same handlers
  container.querySelectorAll('[data-save], [data-save-m]').forEach(b =>
    b.addEventListener('click', doSave));
  container.querySelectorAll('[data-submit], [data-submit-m]').forEach(b =>
    b.addEventListener('click', openSubmitConfirm));
}

/* ---------- Sections bottom-sheet (phone) — jump between question groups ----------
   Slides up from the bottom; reuses the group-nav-item styling and the `goto`
   helper so jumping behaves exactly like the desktop rail. */
function openSectionsSheet(s, qids, goto) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  const ansTotal = qids.filter(q => s.answers[q] && s.answers[q].score != null).length;
  overlay.innerHTML = `
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 20px 14px">
        <div style="font-size:16px;font-weight:700;color:var(--ink);letter-spacing:-0.02em">Mục lục</div>
        <div style="font-size:12.5px;font-weight:600;color:var(--sub)">${ansTotal}/${qids.length} câu</div>
      </div>
      <div class="sheet-body" style="display:flex;flex-direction:column;gap:2px;padding:0 12px 8px">
        ${state.groups.map((g, gi) => {
          const gAns = g.items.filter(q => s.answers[q.id] && s.answers[q.id].score != null).length;
          const gDone = g.items.length > 0 && gAns === g.items.length;
          return `
          <button class="group-nav-item" data-sheet-goto="${esc(g.id)}" style="padding:12px 10px">
            <span style="width:20px;height:20px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${gDone ? 'var(--ok)' : (gAns ? '#29ABE21A' : '#EEF1F4')};color:${gDone ? '#fff' : (gAns ? 'var(--blue)' : 'var(--faint)')}">
              ${gDone ? icon('check', { size: 12, stroke: 3 }) : `<span style="font-size:11px;font-weight:700">${gi + 1}</span>`}
            </span>
            <span style="flex:1;font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${esc(g.name)}</span>
            <span style="font-size:12px;font-weight:700;color:${gDone ? 'var(--ok)' : 'var(--faint)'}">${gAns}/${g.items.length}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;

  function close() {
    overlay.classList.remove('open');
    window.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 240);
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-sheet-goto]').forEach(b =>
    b.addEventListener('click', () => { close(); goto(b.dataset.sheetGoto); }));
  window.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  // next frame → trigger slide-up transition
  requestAnimationFrame(() => overlay.classList.add('open'));
}
