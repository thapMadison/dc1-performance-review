/* ═══════════════════════════════════════════════════════════════
   PAS — push finalized results to the company system (PAS-Madison).

   Endpoint:  PUT {PAS_API_BASE}/api/manager/assessments/{assessmentId}/draft
   Auth:      Bearer <token> (manager's PAS token, kept in localStorage on
              the manager's own machine only — never written to Firebase).
   Body:      { managerResponses, finalResponses, managerComment, finalComment }
              where each *Responses = [{ criteriaId, score }].

   Per the product decision, the tool sends the employee's FINAL score for
   each criterion (manager override, or the auto-average when unedited) —
   NOT the per-reviewer scores. managerResponses mirrors finalResponses and
   managerComment mirrors finalComment (matches the reference request).

   The question ids in this tool ARE the PAS criteriaId UUIDs, so `q.id`
   is sent straight through with no mapping.
═══════════════════════════════════════════════════════════════ */

import { state, allQuestionIds, finalForQuestion, fractionalQuestionsOf, getBackend } from './store.js';

export const PAS_API_BASE = 'https://api.pas-madison.madlab.tech';

const TOKEN_KEY = 'madison_pr_pas_token';

/* ─────────── Token (localStorage, manager's machine only) ─────────── */
export function getPasToken() {
  try { return (localStorage.getItem(TOKEN_KEY) || '').trim(); }
  catch (_) { return ''; }
}
export function setPasToken(t) {
  try { localStorage.setItem(TOKEN_KEY, (t || '').trim()); } catch (_) { /* private mode */ }
}
export function clearPasToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (_) { /* ignore */ }
}
export function hasPasToken() { return !!getPasToken(); }

/* ─────────── Employee lookup helper ─────────── */
export function assessmentIdOf(empId) {
  const emp = state.employees.find(e => e.id === empId);
  return emp && emp.assessmentId ? String(emp.assessmentId).trim() : '';
}

/* ─────────── Payload ───────────
   finalResponses covers EVERY question in the current question set (the
   count is derived from allQuestionIds(), not hardcoded). Callers gate on
   pasBlockers() first, so by the time we build the payload every score is a
   whole number 1–5. */
export function buildDraftPayload(empId, finalComment) {
  const responses = allQuestionIds().map(qid => ({
    criteriaId: qid,
    score: finalForQuestion(empId, qid).score,
  }));
  const comment = (finalComment || '').trim();
  return {
    managerResponses: responses,
    finalResponses: responses,
    managerComment: comment,
    finalComment: comment,
  };
}

/* ─────────── Blockers ───────────
   Reasons the employee can't be submitted yet. Empty array = ready.
   `finalComment` is passed in (it lives in the working copy of the caller /
   in state.finalComments), so this stays a pure function of current state. */
export function pasBlockers(empId, finalComment) {
  const out = [];
  const qids = allQuestionIds();

  if (!assessmentIdOf(empId)) out.push('Nhân viên chưa có Assessment ID (import từ PAS).');

  if (!qids.length) {
    out.push('Chưa có bộ câu hỏi.');
  } else {
    const missing = qids.filter(qid => finalForQuestion(empId, qid).score == null).length;
    if (missing) out.push(`Còn ${missing}/${qids.length} tiêu chí chưa có điểm final.`);
    const frac = fractionalQuestionsOf(empId).length;
    if (frac) out.push(`Còn ${frac} tiêu chí có điểm final lẻ — cần làm tròn về số nguyên 1–5.`);
  }

  if (!(finalComment || '').trim()) out.push('Chưa có nhận xét final.');
  // Demo mode simulates the PAS call, so it needs no real token.
  const isDemo = getBackend() && getBackend().isDemo;
  if (!isDemo && !hasPasToken()) out.push('Chưa có token PAS.');

  return out;
}

/* ─────────── Submit ───────────
   Rejects with an Error; when the failure is auth-related the error carries
   code 'PAS_TOKEN' so the modal can prompt for a fresh token. In demo mode
   we simulate a successful call so the whole UI flow can be walked without a
   real PAS token. */
export async function submitToPas(empId, finalComment) {
  const assessmentId = assessmentIdOf(empId);
  if (!assessmentId) throw new Error('Thiếu Assessment ID.');
  const payload = buildDraftPayload(empId, finalComment);

  if (getBackend() && getBackend().isDemo) {
    await new Promise(r => setTimeout(r, 600));
    return { ok: true, demo: true };
  }

  const token = getPasToken();
  if (!token) {
    const err = new Error('Chưa có token PAS.');
    err.code = 'PAS_TOKEN';
    throw err;
  }

  let res;
  try {
    res = await fetch(`${PAS_API_BASE}/api/manager/assessments/${encodeURIComponent(assessmentId)}/draft`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    throw new Error('Không kết nối được tới PAS. Kiểm tra mạng rồi thử lại.');
  }

  if (res.status === 401 || res.status === 403) {
    const err = new Error('Token PAS hết hạn hoặc không hợp lệ — dán token mới.');
    err.code = 'PAS_TOKEN';
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch (_) { /* ignore */ }
    throw new Error(`PAS trả về lỗi ${res.status}.${detail ? ' ' + detail : ''}`);
  }

  try { return await res.json(); } catch (_) { return { ok: true }; }
}
