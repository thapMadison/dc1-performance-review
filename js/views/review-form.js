/* ═══════════════════════════════════════════════════════════════
   REVIEW FORM — grouped questions · hint · 1–5 scale · optional
   comment · sticky progress rail · draft / submit → locked.
   Answers live in a local working copy; the store is only written
   on "Lưu nháp" / "Nộp" (so typing never fights re-renders).
═══════════════════════════════════════════════════════════════ */

import { esc, icon, avatar, statusPill, ratingScale, progress, emptyState, openModal, btn, SCALE_LABELS, SCALE_COLORS, NOTCH, GROUP_COLORS, reviewPeriodStatus, bandColor, wireCollapsibles, toast } from '../ui.js';
import { state, allQuestionIds, reviewOf, saveReview, classify } from '../store.js';
import { nav } from '../router.js';
import { requestRender } from '../bus.js';
import { STATUS } from '../constants.js';

// Per-group progress + live average (computed from the working session copy).
// Unscored questions are excluded from the average so the rail reflects only
// what the reviewer has actually graded so far.
function groupRailStats(g, s) {
  const scores = g.items.map(q => s.answers[q.id] && s.answers[q.id].score).filter(v => v != null);
  const ans = scores.length;
  const total = g.items.length;
  const done = total > 0 && ans === total;
  const avg = ans ? scores.reduce((a, b) => a + b, 0) / ans : null;
  const band = avg != null ? classify(Math.round(avg * 10) / 10) : null;
  return { ans, total, done, avg, band, avgStr: avg != null ? (Math.round(avg * 10) / 10).toFixed(1) : null };
}

// "TB X.X" chip colored by band classification.
function avgChip(st, { big = false } = {}) {
  if (st.avgStr == null) return '';
  const c = st.band ? bandColor(st.band.id) : 'var(--sub)';
  const fs = big ? '12px' : '11px';
  return `
    <span style="display:inline-flex;align-items:center;background:color-mix(in srgb,${c} 12%,transparent);padding:2px 7px;border-radius:999px;white-space:nowrap">
      <span style="font-size:${fs};font-weight:700;color:${c}">TB ${st.avgStr}</span>
    </span>`;
}

// One question group card: collapsible header + a 1–5 rating row and an
// optional comment box per question. Output matches the original inline map.
function questionGroupHtml(g, gi, s, locked) {
  const color = GROUP_COLORS[gi % GROUP_COLORS.length];
  return `
      <div id="grp-${esc(g.id)}" class="card group-anchor" style="margin-bottom:26px;padding:0;overflow:hidden;border-left:3px solid ${color}">
        <button class="rf-group-toggle" data-rf-toggle="${esc(g.id)}" style="display:flex;align-items:center;gap:11px;padding:14px 20px;width:100%;border:none;border-bottom:1px solid var(--line);background:#FAFBFC;cursor:pointer;text-align:left;transition:background .14s">
          <div style="width:26px;height:26px;clip-path:${NOTCH(7)};background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${gi + 1}</div>
          <h2 style="font-size:16.5px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;flex:1">${esc(g.name)}</h2>
          <span style="font-size:12px;font-weight:600;color:var(--faint);margin-right:8px">${g.items.length} câu</span>
          <svg class="rf-chevron" data-rf-chevron="${esc(g.id)}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .22s"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="rf-group-body" data-rf-body="${esc(g.id)}" style="display:flex;flex-direction:column;gap:0">
          ${g.items.map((q, qi) => {
            const a = s.answers[q.id] || { score: null, comment: '' };
            const showC = s.openComments[q.id] || a.comment;
            return `
            <div style="padding:20px;${qi < g.items.length - 1 ? 'border-bottom:1px solid var(--line);' : ''}${a.score != null ? 'background:#FAFEFF;' : ''}">
              <div style="display:flex;gap:14px">
                <div style="font-size:13px;font-weight:700;color:${color};margin-top:1px;min-width:22px">${gi + 1}.${qi + 1}</div>
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
      </div>`;
}

// Required "overall comment" card shown below the question groups.
function overallSectionHtml(s, hasOverall, locked) {
  return `
      <div id="grp-overall" class="card group-anchor" style="margin-bottom:26px;padding:0;overflow:hidden;border-left:3px solid var(--blue)">
        <div style="display:flex;align-items:center;gap:11px;padding:14px 20px;border-bottom:1px solid var(--line);background:#FAFBFC">
          <div style="width:26px;height:26px;clip-path:${NOTCH(7)};background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon('edit', { size: 13, color: '#fff' })}</div>
          <h2 style="font-size:16.5px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;flex:1">Nhận xét tổng quan <span style="color:var(--danger)">*</span></h2>
          <span style="font-size:12px;font-weight:700;color:${hasOverall || locked ? 'var(--ok)' : 'var(--danger)'};display:inline-flex;align-items:center;gap:4px">${hasOverall || locked ? icon('check', { size: 13, color: 'var(--ok)', stroke: 3 }) : ''}Bắt buộc</span>
        </div>
        <div style="padding:20px">
          <div style="font-size:13px;color:var(--sub);line-height:1.5;margin-bottom:14px">Nhận xét chung về nhân viên: điểm mạnh, điểm cần cải thiện, hoặc bất kỳ ý kiến tổng thể nào ngoài từng câu hỏi. Cần nhập trước khi nộp (có thể lưu nháp mà chưa nhập).</div>
          <textarea class="textarea" data-overall ${locked ? 'disabled' : ''} style="min-height:120px" placeholder="Viết nhận xét tổng quan của bạn…">${esc(s.overallComment)}</textarea>
        </div>
      </div>`;
}

// Rail "live average + band" pill — only shown once the reviewer has scored
// at least one question. Average excludes unscored questions.
function overallBandRowHtml(qids, s) {
  const allScores = qids.map(q => s.answers[q] && s.answers[q].score).filter(v => v != null);
  if (!allScores.length) return '';
  const overall = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const overallRounded = Math.round(overall * 100) / 100;
  const overallBand = classify(overallRounded);
  const bc = overallBand ? bandColor(overallBand.id) : 'var(--sub)';
  return `
          <div style="display:flex;align-items:center;gap:10px;margin-top:16px;padding:11px 13px;background:color-mix(in srgb, ${bc} 8%, transparent);border:1.5px solid color-mix(in srgb, ${bc} 30%, transparent);border-radius:9px">
            ${overallBand ? `<span style="display:inline-flex;align-items:center;gap:6px;background:${bc};padding:4px 9px;border-radius:999px;flex-shrink:0">
              <span style="width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.25);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">${esc(overallBand.id)}</span>
              <span style="font-size:11.5px;font-weight:700;color:#fff">${esc(overallBand.label)}</span>
            </span>` : ''}
            <span style="margin-left:auto;font-size:22px;font-weight:700;color:${bc};letter-spacing:-0.02em">${overallRounded.toFixed(2)}<span style="font-size:12px;color:var(--faint);font-weight:600">/5</span></span>
          </div>`;
}

// One in-progress form session at a time (reset when empId/reviewer changes)
let session = null;

function getSession(empId, reviewerId) {
  const existing = reviewOf(empId, reviewerId);
  if (session && session.empId === empId && session.reviewerId === reviewerId) {
    // Reuse the live session, EXCEPT when it was created before the reviewer's
    // saved review arrived from the backend (the reviews/ node loads in a later
    // phase, so on a fresh page load the session is first built empty). Once the
    // data lands, rebuild from it — but only while the reviewer hasn't started
    // editing, so we never clobber in-progress local edits.
    if (session.hydrated || session.dirty || !existing) return session;
  }
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
  const overallComment = (existing && existing.overallComment) || '';
  // hydrated = this session was built from real backend data (or there is
  // genuinely none yet, in which case a later non-null `existing` will rebuild).
  session = { empId, reviewerId, answers, openComments, overallComment, saved: false, dirty: false, hydrated: !!existing };
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
  // Reviewers learn their assignment from the reverse-index (state.assignments);
  // managers/leaders have the employee's reviewerIds loaded directly.
  const assigned = myId && (!!(state.assignments && state.assignments[empId]) || (emp.reviewerIds || {})[myId]);
  if (!assigned && !existing) {
    container.innerHTML = `<div class="card">${emptyState({ icon: 'lock', title: 'Bạn không được phân công', desc: 'Bạn không phải là reviewer của nhân viên này.' })}</div>`;
    return;
  }

  const submittedLocked = existing && existing.status === STATUS.SUBMITTED;
  const periodStatus = reviewPeriodStatus();
  const periodLocked = !periodStatus.active;
  const locked = submittedLocked || periodLocked;
  const s = getSession(empId, myId);
  const qids = allQuestionIds();
  const ans = qids.filter(q => s.answers[q] && s.answers[q].score != null).length;
  const pct = qids.length ? Math.round(ans / qids.length * 100) : 0;
  const complete = qids.length > 0 && ans === qids.length;
  // Submit requires every question scored AND an overall comment.
  // (Drafts may be saved without the overall comment.)
  const hasOverall = !!(s.overallComment && s.overallComment.trim());
  const canSubmit = complete && hasOverall;
  // Submit-button label reflects the current blocker (scores first, then comment).
  const submitLabel = !complete ? `Còn ${qids.length - ans} câu`
    : !hasOverall ? 'Cần nhận xét tổng quan'
    : 'Nộp đánh giá';
  const submitLabelShort = !complete ? `Còn ${qids.length - ans}`
    : !hasOverall ? 'Cần nhận xét'
    : 'Nộp';

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
        ${statusPill(locked ? STATUS.LOCKED : (existing ? existing.status : STATUS.PENDING))}
      </div>

      ${locked ? `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#EEF1F8;border:1px solid var(--line);border-radius:9px;margin-bottom:24px">
        ${icon('lock', { size: 18, color: '#5B6B8A' })}
        <div style="font-size:13.5px;color:#3D4B66;font-weight:600">
          ${submittedLocked ? 'Bản đánh giá đã được nộp và khóa. Bạn không thể chỉnh sửa nữa.'
            : periodStatus.beforeStart ? 'Kỳ đánh giá chưa bắt đầu. Bạn chỉ có thể xem.'
            : 'Kỳ đánh giá đã kết thúc. Bạn chỉ có thể xem.'}
        </div>
      </div>` : ''}

      ${state.groups.map((g, gi) => questionGroupHtml(g, gi, s, locked)).join('')}

      ${overallSectionHtml(s, hasOverall, locked)}
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

        ${overallBandRowHtml(qids, s)}

        <div style="display:flex;flex-direction:column;gap:4px;margin:18px 0 4px">
          ${state.groups.map((g, gi) => {
            const color = GROUP_COLORS[gi % GROUP_COLORS.length];
            const st = groupRailStats(g, s);
            return `
            <button class="group-nav-item group-nav-item--stacked" data-goto="${esc(g.id)}" style="border-left:2px solid ${st.done ? 'var(--ok)' : color}">
              <span style="width:18px;height:18px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${st.done ? 'var(--ok)' : color + '22'};color:${st.done ? '#fff' : color};margin-top:1px">
                ${st.done ? icon('check', { size: 11, stroke: 3 }) : `<span style="font-size:10px;font-weight:700">${gi + 1}</span>`}
              </span>
              <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
                <span style="display:flex;align-items:center;gap:8px">
                  <span style="flex:1;font-size:12.5px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.name)}</span>
                  <span style="font-size:11px;font-weight:600;color:${st.done ? 'var(--ok)' : 'var(--faint)'};flex-shrink:0">${st.ans}/${st.total}</span>
                </span>
                ${st.avgStr != null ? `<span style="display:flex">${avgChip(st)}</span>` : ''}
              </span>
            </button>`;
          }).join('')}
        </div>

        ${!locked ? `
        <div class="rail-actions" style="display:flex;flex-direction:column;gap:9px;margin-top:18px;padding-top:18px;border-top:1px solid var(--line)">
          ${btn({ label: submitLabel, variant: 'primary', full: true, icon: canSubmit ? 'check' : undefined, disabled: !canSubmit, attrs: 'data-submit' })}
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
            ${btn({ label: submitLabelShort, variant: 'primary', size: 'md', icon: canSubmit ? 'check' : undefined, disabled: !canSubmit, attrs: 'data-submit-m' })}
          </div>`}
    </div>
  </div>`;

  wire(container, emp, user, locked, s, qids);
}

function wire(container, emp, user, locked, s, qids) {
  container.querySelector('[data-back]').addEventListener('click', () => nav('/myreviews'));

  // group collapse / expand
  wireCollapsibles(container, {
    toggleAttr: 'data-rf-toggle', bodyAttr: 'data-rf-body', chevronAttr: 'data-rf-chevron',
    collapsedClass: 'rf-group-body--collapsed',
  });

  // jump to a group anchor — auto-expand the group if it is collapsed
  const goto = id => {
    const body = container.querySelector(`[data-rf-body="${CSS.escape(id)}"]`);
    const chevron = container.querySelector(`[data-rf-chevron="${CSS.escape(id)}"]`);
    if (body && body.classList.contains('rf-group-body--collapsed')) {
      body.classList.remove('rf-group-body--collapsed');
      if (chevron) chevron.style.transform = '';
    }
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
      s.dirty = true;
      requestRender();
    });
  });

  // comments: typing only mutates the session (no re-render → caret stays put)
  container.querySelectorAll('[data-comment]').forEach(t =>
    t.addEventListener('input', () => {
      s.answers[t.dataset.comment].comment = t.value;
      s.saved = false;
      s.dirty = true;
    }));
  container.querySelectorAll('[data-add-comment]').forEach(b =>
    b.addEventListener('click', () => {
      s.openComments[b.dataset.addComment] = true;
      s.dirty = true;
      requestRender();
      const ta = document.querySelector(`[data-comment="${CSS.escape(b.dataset.addComment)}"]`);
      if (ta) ta.focus();
    }));

  // overall comment: like per-question comments, typing only mutates the
  // session (caret stays put). But the empty↔non-empty transition flips
  // whether the form can be submitted, so re-render on that crossing only
  // (and refocus the recreated textarea, caret at the end).
  const overallTa = container.querySelector('[data-overall]');
  if (overallTa) overallTa.addEventListener('input', () => {
    const was = !!(s.overallComment && s.overallComment.trim());
    s.overallComment = overallTa.value;
    s.saved = false;
    s.dirty = true;
    const now = !!(s.overallComment && s.overallComment.trim());
    if (was !== now) {
      requestRender();
      const ta = document.querySelector('[data-overall]');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
  });

  // ---- shared actions (bound to both desktop rail + mobile bottom bar) ----
  const doSave = async () => {
    try {
      await saveReview(s.empId, s.reviewerId, {
        status: STATUS.DRAFT,
        answers: s.answers,
        overallComment: s.overallComment,
        submittedAt: null,
      });
    } catch (e) {
      toast(e && e.code === 'PERIOD_LOCKED'
        ? (e.message || 'Kỳ đánh giá đã đóng hoặc chưa bắt đầu.')
        : 'Không lưu được bản nháp. Vui lòng thử lại.', { type: 'error' });
      return;
    }
    s.saved = true;
    // The saved review is now the source of truth; mark the session as
    // hydrated so an incoming backend echo never rebuilds it from scratch.
    s.hydrated = true;
    s.dirty = false;
    toast('Đã lưu bản nháp thành công.');
    requestRender();
    setTimeout(() => { if (session === s) { s.saved = false; requestRender(); } }, 2200);
  };

  const openSubmitConfirm = () => {
    // safety net — the button is already disabled until this holds
    if (!(s.overallComment && s.overallComment.trim())) {
      const card = container.querySelector('#grp-overall');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const ta = container.querySelector('[data-overall]');
      if (ta) ta.focus();
      return;
    }
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
      try {
        await saveReview(s.empId, s.reviewerId, { status: STATUS.SUBMITTED, answers: s.answers, overallComment: s.overallComment });
      } catch (e) {
        toast(e && e.code === 'PERIOD_LOCKED'
          ? (e.message || 'Kỳ đánh giá đã đóng hoặc chưa bắt đầu.')
          : 'Không nộp được đánh giá. Vui lòng thử lại.', { type: 'error' });
        return;
      }
      m.close();
      clearReviewSession();
      toast('Đã nộp đánh giá thành công.');
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
          const color = GROUP_COLORS[gi % GROUP_COLORS.length];
          const st = groupRailStats(g, s);
          return `
          <button class="group-nav-item" data-sheet-goto="${esc(g.id)}" style="padding:12px 10px;border-left:2px solid ${st.done ? 'var(--ok)' : color};align-items:center">
            <span style="width:20px;height:20px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${st.done ? 'var(--ok)' : color + '22'};color:${st.done ? '#fff' : color}">
              ${st.done ? icon('check', { size: 12, stroke: 3 }) : `<span style="font-size:11px;font-weight:700">${gi + 1}</span>`}
            </span>
            <span style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left">${esc(g.name)}</span>
            ${st.avgStr != null ? avgChip(st, { big: true }) : ''}
            <span style="font-size:12px;font-weight:700;color:${st.done ? 'var(--ok)' : 'var(--faint)'};flex-shrink:0">${st.ans}/${st.total}</span>
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
