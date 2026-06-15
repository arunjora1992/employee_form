/**
 * CSV and PDF exporters for employee records (individual & bulk).
 */
const PDFDocument = require('pdfkit');

// Ordered field list grouped by the form's 8 sections.
const SECTIONS = [
  ['Personal Information', [
    ['full_name', 'Full Name'], ['date_of_birth', 'Date of Birth'], ['blood_group', 'Blood Group'],
    ['gender', 'Gender'], ['marital_status', 'Marital Status'], ['personal_phone', 'Personal Phone'],
    ['email', 'Email'], ['permanent_address', 'Permanent Address'],
  ]],
  ['Employment & Joining', [
    ['designation', 'Designation'], ['division', 'Division'], ['joining_month_year', 'Joining Month/Year'],
    ['reporting_to', 'Reporting To'], ['referenced_by', 'Referenced By'], ['reference_phone', 'Reference Phone'],
  ]],
  ['Identity & Statutory', [
    ['pan_card_no', 'PAN Card No'], ['aadhaar_card_no', 'Aadhaar Card No'], ['esi_applicable', 'ESI Applicable'],
    ['esi_no', 'ESI No'], ['proof_1', 'Proof 1'], ['proof_2', 'Proof 2'],
  ]],
  ['Emergency Contact', [
    ['emergency_contact_person', 'Contact Person'], ['emergency_relationship', 'Relationship'],
    ['emergency_contact_no', 'Contact No'],
  ]],
  ['Educational Qualifications', [
    ['highest_qualification', 'Highest Qualification'], ['college_name', 'College/Institution'],
    ['college_location', 'College Location'], ['school_name', 'School'], ['school_location', 'School Location'],
  ]],
  ['Previous Work', [
    ['prev_organization', 'Organization'], ['prev_position', 'Position Held'], ['prev_salary', 'Salary Drawn'],
    ['prev_period_from', 'Period From'], ['prev_period_to', 'Period To'],
    ['prev_reason_for_leaving', 'Reason for Leaving'], ['prev_contact_name', 'Contact Name'],
    ['prev_contact_position', 'Contact Position'], ['prev_contact_number', 'Contact Number'],
  ]],
  ['Medical Record', [
    ['medical_operations', 'Operations'], ['medical_operations_detail', 'Operations Detail'],
    ['medical_allergies', 'Allergies'], ['medical_allergies_detail', 'Allergies Detail'],
    ['medical_medication', 'Regular Medication'], ['medical_medication_detail', 'Medication Detail'],
    ['medical_doctor', 'Specific Doctor'], ['medical_doctor_detail', 'Doctor Detail'],
  ]],
  ['Declaration', [
    ['declaration_certificate', 'Certificate'], ['declaration_place', 'Place'],
    ['declaration_date', 'Date'], ['declaration_signature', 'Signature'],
    ['declaration_consent', 'Consent Given'], ['created_at', 'Submitted At'],
  ]],
];

const BOOL_FIELDS = new Set([
  'esi_applicable', 'medical_operations', 'medical_allergies', 'medical_medication',
  'medical_doctor', 'declaration_consent',
]);

// Flat [key,label] list for CSV
const FLAT = SECTIONS.flatMap(([, fields]) => fields);

const DATE_FIELDS = new Set(['date_of_birth', 'declaration_date']);

function ymd(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function fmt(key, value) {
  if (value === null || value === undefined || value === '') return '';
  if (BOOL_FIELDS.has(key)) return value ? 'Yes' : 'No';
  if (DATE_FIELDS.has(key)) return ymd(value);
  if (key === 'created_at') {
    try { return new Date(value).toLocaleString(); } catch { return String(value); }
  }
  return String(value);
}

// ---- CSV --------------------------------------------------------------------
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(records) {
  const header = FLAT.map(([, label]) => csvCell(label)).join(',');
  const lines = records.map((r) => FLAT.map(([key]) => csvCell(fmt(key, r[key]))).join(','));
  return '﻿' + [header, ...lines].join('\r\n'); // BOM for Excel
}

// ---- PDF --------------------------------------------------------------------
function pdfHeader(doc, shopName, subtitle) {
  doc.fillColor('#1b3a5b').fontSize(20).font('Helvetica-Bold').text(shopName || 'Sekar & Co', { align: 'center' });
  doc.moveDown(0.1);
  doc.fillColor('#b87333').fontSize(12).font('Helvetica').text(subtitle, { align: 'center' });
  doc.moveTo(doc.page.margins.left, doc.y + 6)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 6)
    .strokeColor('#f5a623').lineWidth(2).stroke();
  doc.moveDown(1);
}

/** Stream an individual full-detail PDF to `res`. */
function streamEmployeePDF(res, employee, shopName) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  pdfHeader(doc, shopName, 'Employee Details');

  doc.fillColor('#1b2733').fontSize(15).font('Helvetica-Bold').text(employee.full_name || 'Employee');
  if (employee.designation || employee.division) {
    doc.fontSize(10).font('Helvetica').fillColor('#5b6b7a')
      .text([employee.designation, employee.division].filter(Boolean).join(' · '));
  }
  doc.moveDown(0.6);

  for (const [section, fields] of SECTIONS) {
    doc.fillColor('#d4880a').fontSize(11).font('Helvetica-Bold').text(section);
    doc.moveDown(0.2);
    for (const [key, label] of fields) {
      const val = fmt(key, employee[key]);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#5b6b7a')
        .text(`${label}: `, { continued: true })
        .font('Helvetica').fillColor('#1b2733').text(val || '—');
    }
    doc.moveDown(0.5);
  }
  doc.end();
}

/** Stream a bulk summary-table PDF of many records to `res`. */
function streamListPDF(res, records, shopName) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
  doc.pipe(res);
  pdfHeader(doc, shopName, `Employee Records (${records.length})`);

  const cols = [
    ['full_name', 'Name', 150],
    ['designation', 'Designation', 130],
    ['division', 'Division', 110],
    ['personal_phone', 'Phone', 100],
    ['email', 'Email', 170],
    ['created_at', 'Submitted', 110],
  ];
  const startX = doc.page.margins.left;
  let y = doc.y;

  const drawRow = (cells, opts = {}) => {
    let x = startX;
    doc.fontSize(9).font(opts.head ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(opts.head ? '#ffffff' : '#1b2733');
    const rowH = 20;
    if (opts.head) doc.rect(startX, y, cols.reduce((a, [, , w]) => a + w, 0), rowH).fill('#1b3a5b');
    doc.fillColor(opts.head ? '#ffffff' : '#1b2733');
    cells.forEach((text, i) => {
      doc.text(String(text || '—'), x + 4, y + 6, { width: cols[i][2] - 8, ellipsis: true, lineBreak: false });
      x += cols[i][2];
    });
    y += rowH;
    doc.moveTo(startX, y).lineTo(x, y).strokeColor('#d8dee8').lineWidth(0.5).stroke();
  };

  drawRow(cols.map(([, label]) => label), { head: true });
  for (const r of records) {
    if (y > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage({ size: 'A4', margin: 40, layout: 'landscape' });
      y = doc.page.margins.top;
      drawRow(cols.map(([, label]) => label), { head: true });
    }
    drawRow(cols.map(([key]) => fmt(key, r[key])));
  }
  doc.end();
}

function safeFileName(name) {
  return String(name || 'employee').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
}

module.exports = { toCSV, streamEmployeePDF, streamListPDF, safeFileName };
