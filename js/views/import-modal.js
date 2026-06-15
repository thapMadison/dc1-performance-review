/* ═══════════════════════════════════════════════════════════════
   IMPORT — Excel import (SheetJS) for questions & employees.
   Drag-drop / file picker → preview table → replace-all confirm.
   Question format:  ID (tùy chọn) | Nhóm | Câu hỏi | Gợi ý
   Employee format:  Tên | Email | Vị trí | Phòng ban | Email Reviewer (';')
═══════════════════════════════════════════════════════════════ */

import { esc, icon, openModal, btn } from '../ui.js';
import { importQuestions, importEmployees } from '../store.js';

const SAMPLE_QUESTIONS = [
  ['ID (tùy chọn)', 'Nhóm', 'Câu hỏi', 'Gợi ý'],
  ['CM01', 'Năng lực chuyên môn', 'Chất lượng công việc', 'Sản phẩm bàn giao chính xác, ít lỗi, đạt chuẩn kỳ vọng.'],
  ['CM02', 'Năng lực chuyên môn', 'Kiến thức chuyên môn', 'Nắm vững kiến thức cần thiết và liên tục cập nhật.'],
  ['KN01', 'Kỹ năng làm việc', 'Làm việc nhóm', 'Hợp tác và hỗ trợ đồng nghiệp hiệu quả.'],
  ['KN02', 'Kỹ năng làm việc', 'Giao tiếp', 'Truyền đạt rõ ràng, lắng nghe và phản hồi.'],
  ['TĐ01', 'Thái độ & Văn hóa', 'Tinh thần trách nhiệm', 'Chịu trách nhiệm với công việc của bản thân.'],
];
const SAMPLE_EMPLOYEES = [
  ['Tên', 'Email', 'Vị trí', 'Phòng ban', 'Email Reviewer (cách nhau dấu ;)'],
  ['Trần Văn Sơn', 'son@madison.tech', 'Mobile Engineer', 'Engineering', 'trang@madison.tech'],
  ['Lý Thu Trang', 'trang@madison.tech', 'UX Researcher', 'Product', 'khoa@madison.tech'],
  ['Phan Đình Khoa', 'khoa@madison.tech', 'DevOps Engineer', 'Engineering', 'son@madison.tech;trang@madison.tech'],
];

function downloadTemplate(kind) {
  const rows = kind === 'questions' ? SAMPLE_QUESTIONS : SAMPLE_EMPLOYEES;
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, kind === 'questions' ? 'Câu hỏi' : 'Nhân viên');
  XLSX.writeFile(wb, kind === 'questions' ? 'mau_cau_hoi.xlsx' : 'mau_nhan_vien.xlsx');
}

function parseRows(rows, kind) {
  const body = rows.filter(r => r.some(c => String(c == null ? '' : c).trim() !== '')).slice(1);
  if (kind === 'questions') {
    return body.map(r => ({
      customId: String(r[0] || '').trim(),
      group: String(r[1] || '').trim(),
      text: String(r[2] || '').trim(),
      hint: String(r[3] || '').trim(),
    })).filter(r => r.group && r.text);
  }
  return body.map(r => ({
    name: String(r[0] || '').trim(),
    email: String(r[1] || '').trim(),
    title: String(r[2] || '').trim(),
    dept: String(r[3] || '').trim(),
    reviewers: String(r[4] || '').split(/[;,]/).map(s => s.trim()).filter(Boolean),
  })).filter(r => r.name && r.email);
}

export function openImportModal(kind) {
  let rows = null;
  let fileName = '';
  let err = '';

  const cols = kind === 'questions'
    ? ['ID', 'Nhóm', 'Câu hỏi', 'Gợi ý']
    : ['Tên', 'Email', 'Vị trí', 'Phòng ban', 'Reviewer'];

  const m = openModal({
    title: kind === 'questions' ? 'Import bộ câu hỏi' : 'Import danh sách nhân viên',
    subtitle: kind === 'questions'
      ? 'Tải lên file Excel chứa các câu hỏi đánh giá theo nhóm.'
      : 'Tải lên file Excel chứa nhân viên và reviewer tương ứng.',
    width: 680,
    contentHtml: '',
  });

  function handleFile(file) {
    err = '';
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const parsed = parseRows(aoa, kind);
        if (!parsed.length) { err = 'Không tìm thấy dữ liệu hợp lệ. Kiểm tra lại định dạng cột.'; paint(); return; }
        rows = parsed;
        fileName = file.name;
        paint();
      } catch (ex) {
        err = 'Không đọc được file. Đảm bảo đây là file Excel (.xlsx).';
        paint();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmImport() {
    if (kind === 'questions') {
      const map = {};
      const order = [];
      rows.forEach(r => { if (!map[r.group]) { map[r.group] = []; order.push(r.group); } map[r.group].push(r); });
      const groups = order.map((gname, gi) => ({
        id: `g${gi + 1}_${Date.now().toString(36)}`,
        name: gname,
        items: map[gname].map((r, qi) => ({
          id: r.customId || `q${gi}_${qi}_${Math.random().toString(36).slice(2, 6)}`,
          text: r.text,
          hint: r.hint,
        })),
      }));
      importQuestions(groups);
    } else {
      // resolve reviewer emails within the imported list itself
      // (the import replaces the whole employee list)
      const ts = Date.now().toString(36);
      const list = rows.map((r, i) => ({
        id: `e_${ts}_${i}`,
        name: r.name, email: r.email, title: r.title || '—', dept: r.dept || '',
        order: i,
        reviewers: r.reviewers,
      }));
      const emailToId = {};
      list.forEach(e => { const k = e.email.toLowerCase(); if (!emailToId[k]) emailToId[k] = e.id; });
      importEmployees(list.map(({ reviewers, ...e }) => {
        const reviewerIds = {};
        reviewers.forEach(em => { const id = emailToId[em.toLowerCase()]; if (id && id !== e.id) reviewerIds[id] = true; });
        return { ...e, reviewerIds };
      }));
    }
    m.close();
  }

  function dropzoneHtml() {
    return `
      <div class="dropzone" data-dz>
        <div style="width:52px;height:52px;border-radius:11px;background:var(--blue-hi);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">
          ${icon('upload', { size: 24, color: 'var(--blue)' })}
        </div>
        <div style="font-size:15.5px;font-weight:700;color:var(--ink);margin-bottom:4px">Kéo thả file Excel vào đây</div>
        <div style="font-size:13px;color:var(--sub)">hoặc bấm để chọn file · .xlsx, .xls, .csv</div>
        <input data-file type="file" accept=".xlsx,.xls,.csv" style="display:none">
      </div>

      ${err ? `<div style="margin-top:14px;padding:11px 14px;background:var(--danger-bg);color:var(--danger);border-radius:8px;font-size:13px;font-weight:600">${esc(err)}</div>` : ''}

      <div style="display:flex;align-items:center;gap:10px;margin-top:18px;justify-content:space-between">
        <button class="link-btn" data-template>${icon('download', { size: 15, color: 'var(--blue)' })} Tải file mẫu</button>
        ${btn({ label: 'Dùng dữ liệu mẫu', variant: 'soft', size: 'sm', attrs: 'data-sample' })}
      </div>

      <div style="margin-top:20px;padding:14px 16px;background:var(--bg);border-radius:9px;border:1px solid var(--line)">
        <div class="u-label" style="margin-bottom:8px">Định dạng cột mong đợi</div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${cols.map(c => `<span style="font-size:12px;font-weight:600;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:5px;padding:4px 9px">${esc(c)}</span>`).join('')}
        </div>
      </div>`;
  }

  function previewHtml() {
    // for the employee preview, resolve reviewer emails within the new list
    const emailToName = {};
    if (kind === 'employees') rows.forEach(r => { const k = r.email.toLowerCase(); if (!emailToName[k]) emailToName[k] = r.name; });

    return `
      <div style="display:flex;align-items:center;gap:11px;padding:12px 14px;background:var(--ok-bg);border-radius:9px;margin-bottom:16px">
        ${icon('check', { size: 18, color: 'var(--ok)', stroke: 3 })}
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:#147A50">Đọc thành công ${rows.length} ${kind === 'questions' ? 'câu hỏi' : 'nhân viên'}</div>
          <div style="font-size:12.5px;color:#2E9E6E;display:flex;align-items:center;gap:5px">${icon('file', { size: 12, color: '#2E9E6E' })}${esc(fileName)}</div>
        </div>
        <button class="text-underline-btn" data-reset>Chọn lại</button>
      </div>

      <div style="border:1px solid var(--line);border-radius:9px;max-height:280px;overflow:auto">
        <table style="width:100%;min-width:520px;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--bg);position:sticky;top:0">
              ${cols.map(c => `<th style="text-align:left;padding:10px 12px;font-weight:700;color:var(--sub);font-size:11px;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid var(--line)">${esc(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="${i < rows.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}">
                ${kind === 'questions' ? `
                  <td style="padding:10px 12px;color:var(--blue);font-weight:700;font-family:monospace;font-size:12.5px">${r.customId ? esc(r.customId) : '<span style="color:var(--faint)">—</span>'}</td>
                  <td style="padding:10px 12px;font-weight:600;color:var(--ink)">${esc(r.group)}</td>
                  <td style="padding:10px 12px;color:var(--ink)">${esc(r.text)}</td>
                  <td style="padding:10px 12px;color:var(--sub);font-size:12.5px">${r.hint ? esc(r.hint) : '—'}</td>
                ` : `
                  <td style="padding:10px 12px;font-weight:600;color:var(--ink)">${esc(r.name)}</td>
                  <td style="padding:10px 12px;color:var(--sub)">${esc(r.email)}</td>
                  <td style="padding:10px 12px;color:var(--ink)">${esc(r.title || '—')}</td>
                  <td style="padding:10px 12px;color:var(--sub);font-size:12.5px">${esc(r.dept || '—')}</td>
                  <td style="padding:10px 12px">
                    ${r.reviewers.length ? r.reviewers.map(em => {
                      const name = emailToName[em.toLowerCase()];
                      return `<span style="display:inline-block;font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;margin-right:4px;background:${name ? '#29ABE215' : 'var(--danger-bg)'};color:${name ? 'var(--blue)' : 'var(--danger)'}">${esc(name || em + ' ?')}</span>`;
                    }).join('') : '<span style="color:var(--faint)">—</span>'}
                  </td>
                `}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-top:18px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px;font-size:12.5px;color:var(--warn);display:flex;align-items:center;gap:6px">
          ${icon('help', { size: 14, color: 'var(--warn)' })} Import sẽ thay thế toàn bộ ${kind === 'questions' ? 'bộ câu hỏi' : 'danh sách nhân viên'} hiện tại.
        </div>
        ${btn({ label: 'Huỷ', variant: 'soft', attrs: 'data-reset' })}
        ${btn({ label: `Import ${rows.length} dòng`, variant: 'primary', icon: 'check', attrs: 'data-confirm' })}
      </div>`;
  }

  function paint() {
    m.body.innerHTML = `<div style="padding:22px 28px 26px">${rows ? previewHtml() : dropzoneHtml()}</div>`;

    if (!rows) {
      const dz = m.body.querySelector('[data-dz]');
      const fileInput = m.body.querySelector('[data-file]');
      dz.addEventListener('click', () => fileInput.click());
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
      dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('drag');
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
      m.body.querySelector('[data-template]').addEventListener('click', () => downloadTemplate(kind));
      m.body.querySelector('[data-sample]').addEventListener('click', () => {
        rows = parseRows(kind === 'questions' ? SAMPLE_QUESTIONS : SAMPLE_EMPLOYEES, kind);
        fileName = 'Dữ liệu mẫu';
        err = '';
        paint();
      });
    } else {
      m.body.querySelectorAll('[data-reset]').forEach(b =>
        b.addEventListener('click', () => { rows = null; fileName = ''; paint(); }));
      m.body.querySelector('[data-confirm]').addEventListener('click', confirmImport);
    }
  }

  paint();
}
