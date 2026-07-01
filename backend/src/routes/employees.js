const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const auth = require('../auth');
const sheets = require('../sheets');
const settings = require('../settings');
const exporters = require('../exporters');

const router = express.Router();

// Shared query for admin listing/search/export
async function fetchEmployees(search) {
  const s = (search || '').trim();
  if (s) {
    const { rows } = await db.query(
      `SELECT * FROM employees
       WHERE lower(full_name) LIKE $1 OR lower(coalesce(email,'')) LIKE $1
          OR lower(coalesce(designation,'')) LIKE $1 OR lower(coalesce(division,'')) LIKE $1
       ORDER BY created_at DESC`,
      [`%${s.toLowerCase()}%`]
    );
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM employees ORDER BY created_at DESC');
  return rows;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG or WEBP images are allowed.'));
  },
});

// Coerce helpers ------------------------------------------------------------
const bool = (v) => v === true || v === 'true' || v === 'on' || v === 'Yes' || v === '1';
const nn = (v) => (v === undefined || v === '' ? null : v); // empty -> null
const dateOrNull = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// Ordered column list mirrored between INSERT and the value builder
const FIELDS = [
  'full_name', 'date_of_birth', 'blood_group', 'gender', 'marital_status',
  'personal_phone', 'email', 'permanent_address',
  'designation', 'division', 'joining_month_year', 'reporting_to', 'referenced_by', 'reference_phone',
  'pan_card_no', 'aadhaar_card_no', 'esi_applicable', 'esi_no', 'proof_1', 'proof_2',
  'emergency_contact_person', 'emergency_relationship', 'emergency_contact_no',
  'highest_qualification', 'college_name', 'college_location', 'school_name', 'school_location',
  'prev_organization', 'prev_position', 'prev_salary', 'prev_period_from', 'prev_period_to',
  'prev_reason_for_leaving', 'prev_contact_name', 'prev_contact_position', 'prev_contact_number',
  'medical_operations', 'medical_operations_detail', 'medical_allergies', 'medical_allergies_detail',
  'medical_medication', 'medical_medication_detail', 'medical_doctor', 'medical_doctor_detail',
  'declaration_certificate', 'declaration_place', 'declaration_date', 'declaration_signature',
  'declaration_consent',
];

function buildValues(b, photoPath) {
  return [
    nn(b.full_name), dateOrNull(b.date_of_birth), nn(b.blood_group), nn(b.gender), nn(b.marital_status),
    nn(b.personal_phone), nn(b.email), nn(b.permanent_address),
    nn(b.designation), nn(b.division), nn(b.joining_month_year), nn(b.reporting_to), nn(b.referenced_by), nn(b.reference_phone),
    nn(b.pan_card_no), nn(b.aadhaar_card_no), bool(b.esi_applicable), nn(b.esi_no), nn(b.proof_1), nn(b.proof_2),
    nn(b.emergency_contact_person), nn(b.emergency_relationship), nn(b.emergency_contact_no),
    nn(b.highest_qualification), nn(b.college_name), nn(b.college_location), nn(b.school_name), nn(b.school_location),
    nn(b.prev_organization), nn(b.prev_position), nn(b.prev_salary), nn(b.prev_period_from), nn(b.prev_period_to),
    nn(b.prev_reason_for_leaving), nn(b.prev_contact_name), nn(b.prev_contact_position), nn(b.prev_contact_number),
    bool(b.medical_operations), nn(b.medical_operations_detail), bool(b.medical_allergies), nn(b.medical_allergies_detail),
    bool(b.medical_medication), nn(b.medical_medication_detail), bool(b.medical_doctor), nn(b.medical_doctor_detail),
    nn(b.declaration_certificate), nn(b.declaration_place), dateOrNull(b.declaration_date), nn(b.declaration_signature),
    bool(b.declaration_consent),
    photoPath,             // photo_path
  ];
}

// Create a new employee record (any authenticated user) ---------------------
router.post('/', auth.requireRole('admin', 'user'), upload.single('photo'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.full_name || !String(b.full_name).trim()) {
      return res.status(400).json({ error: 'Full Name is required.' });
    }
    const photoPath = req.file ? `/uploads/${req.file.filename}` : null;
    const cols = [...FIELDS, 'photo_path', 'submitted_by'];
    const values = [...buildValues(b, photoPath), req.user.id];
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await db.query(
      `INSERT INTO employees (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    const employee = rows[0];

    // Mirror to Google Sheets (non-blocking failure)
    const sheetResult = await sheets.appendEmployee(employee);

    res.status(201).json({ id: employee.id, employee, googleSheets: sheetResult });
  } catch (err) {
    console.error('Create employee error:', err.message);
    res.status(500).json({ error: err.message || 'Could not save employee record.' });
  }
});

// Update an existing employee record (admin) --------------------------------
router.put('/:id', auth.requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.full_name || !String(b.full_name).trim()) {
      return res.status(400).json({ error: 'Full Name is required.' });
    }
    const { rows: existing } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Employee not found.' });

    // Field values (buildValues appends photo_path at the end — drop it here).
    const fieldValues = buildValues(b, null).slice(0, FIELDS.length);
    const sets = FIELDS.map((c, i) => `${c} = $${i + 1}`);
    const values = [...fieldValues];

    // Replace photo only when a new file is uploaded; otherwise keep the old one.
    if (req.file) {
      values.push(`/uploads/${req.file.filename}`);
      sets.push(`photo_path = $${values.length}`);
    }
    sets.push('updated_at = now()');
    values.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE employees SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    // Best-effort cleanup of the replaced photo file.
    if (req.file && existing[0].photo_path) {
      const old = path.join(UPLOAD_DIR, path.basename(existing[0].photo_path));
      fs.unlink(old, () => {});
    }

    res.json({ id: rows[0].id, employee: rows[0] });
  } catch (err) {
    console.error('Update employee error:', err.message);
    res.status(500).json({ error: err.message || 'Could not update employee record.' });
  }
});

// List employees (admin) ----------------------------------------------------
router.get('/', auth.requireViewer, async (req, res) => {
  try {
    const employees = await fetchEmployees(req.query.search);
    res.json({ employees });
  } catch (err) {
    console.error('List employees error:', err.message);
    res.status(500).json({ error: 'Could not load employees.' });
  }
});

// Bulk export (admin) — define BEFORE '/:id' so 'export' is not read as an id --
router.get('/export/csv', auth.requireViewer, async (req, res) => {
  try {
    const employees = await fetchEmployees(req.query.search);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
    res.send(exporters.toCSV(employees));
  } catch (err) {
    console.error('CSV export error:', err.message);
    res.status(500).json({ error: 'Could not export CSV.' });
  }
});

router.get('/export/pdf', auth.requireViewer, async (req, res) => {
  try {
    const employees = await fetchEmployees(req.query.search);
    const cfg = await settings.getConfig();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.pdf"');
    exporters.streamListPDF(res, employees, cfg.shopName);
  } catch (err) {
    console.error('PDF export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Could not export PDF.' });
  }
});

// Individual export (admin) -------------------------------------------------
router.get('/:id/export/csv', auth.requireViewer, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found.' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',
      `attachment; filename="${exporters.safeFileName(rows[0].full_name)}.csv"`);
    res.send(exporters.toCSV(rows));
  } catch (err) {
    console.error('CSV export error:', err.message);
    res.status(500).json({ error: 'Could not export CSV.' });
  }
});

router.get('/:id/export/pdf', auth.requireViewer, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found.' });
    const cfg = await settings.getConfig();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${exporters.safeFileName(rows[0].full_name)}.pdf"`);
    exporters.streamEmployeePDF(res, rows[0], cfg.shopName);
  } catch (err) {
    console.error('PDF export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Could not export PDF.' });
  }
});

// ID card (admin) — printable portrait PDF in ID-card format ----------------
router.get('/:id/idcard', auth.requireViewer, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found.' });
    const cfg = await settings.getConfig();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename="${exporters.safeFileName(rows[0].full_name)}-id-card.pdf"`);
    exporters.streamEmployeeIDCard(res, rows[0], cfg, UPLOAD_DIR);
  } catch (err) {
    console.error('ID card export error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Could not generate ID card.' });
  }
});

// Single employee (admin) ---------------------------------------------------
router.get('/:id', auth.requireViewer, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found.' });
    res.json({ employee: rows[0] });
  } catch (err) {
    console.error('Get employee error:', err.message);
    res.status(500).json({ error: 'Could not load employee.' });
  }
});

// Delete employee (admin) ---------------------------------------------------
router.delete('/:id', auth.requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Employee not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete employee error:', err.message);
    res.status(500).json({ error: 'Could not delete employee.' });
  }
});

module.exports = router;
