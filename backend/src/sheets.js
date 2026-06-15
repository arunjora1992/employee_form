/**
 * Google Sheets mirror.
 *
 * Appends each submitted employee record as a row to a Google Sheet.
 * This is OPTIONAL and config-driven — if credentials are not provided the
 * app logs a notice and continues (Postgres remains the source of truth).
 *
 * To enable:
 *   1. Create a Google Cloud service account and download its JSON key.
 *   2. Share your target Google Sheet with the service account email (Editor).
 *   3. Set env vars:
 *        GOOGLE_SHEETS_ENABLED=true
 *        GOOGLE_SHEET_ID=<the long id from the sheet URL>
 *        GOOGLE_SERVICE_ACCOUNT_JSON=/run/secrets/gcp-sa.json   (path to key file)
 *      or GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64 of the key file contents>
 */
const fs = require('fs');
const { google } = require('googleapis');

const HEADER = [
  'Submitted At', 'Full Name', 'Date of Birth', 'Blood Group', 'Gender', 'Marital Status',
  'Personal Phone', 'Email', 'Permanent Address', 'Designation', 'Division',
  'Joining Month/Year', 'Reporting To', 'Referenced By', 'Reference Phone',
  'PAN Card No', 'Aadhaar Card No', 'ESI Applicable', 'ESI No', 'Proof 1', 'Proof 2',
  'Emergency Contact Person', 'Relationship', 'Emergency Contact No',
  'Highest Qualification', 'College Name', 'College Location', 'School Name', 'School Location',
  'Prev Organization', 'Prev Position', 'Prev Salary', 'Prev From', 'Prev To',
  'Reason For Leaving', 'Prev Contact Name', 'Prev Contact Position', 'Prev Contact Number',
  'Operations', 'Operations Detail', 'Allergies', 'Allergies Detail',
  'Regular Medication', 'Medication Detail', 'Specific Doctor', 'Doctor Detail',
  'Declaration Certificate', 'Place', 'Declaration Date', 'Signature', 'Consent',
];

let sheetsClient = null;
let initialised = false;

function isEnabled() {
  return String(process.env.GOOGLE_SHEETS_ENABLED).toLowerCase() === 'true';
}

function loadCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (b64) return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (path && fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf8'));
  throw new Error('No Google service-account credentials found.');
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  const credentials = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/** Ensure the header row exists (only writes it once, if the sheet is empty). */
async function ensureHeader() {
  if (initialised) return;
  const sheets = await getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A1:A1' });
  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'RAW',
      requestBody: { values: [HEADER] },
    });
  }
  initialised = true;
}

function rowFromEmployee(e) {
  const yn = (v) => (v ? 'Yes' : 'No');
  return [
    e.created_at ? new Date(e.created_at).toISOString() : new Date().toISOString(),
    e.full_name, e.date_of_birth, e.blood_group, e.gender, e.marital_status,
    e.personal_phone, e.email, e.permanent_address, e.designation, e.division,
    e.joining_month_year, e.reporting_to, e.referenced_by, e.reference_phone,
    e.pan_card_no, e.aadhaar_card_no, yn(e.esi_applicable), e.esi_no, e.proof_1, e.proof_2,
    e.emergency_contact_person, e.emergency_relationship, e.emergency_contact_no,
    e.highest_qualification, e.college_name, e.college_location, e.school_name, e.school_location,
    e.prev_organization, e.prev_position, e.prev_salary, e.prev_period_from, e.prev_period_to,
    e.prev_reason_for_leaving, e.prev_contact_name, e.prev_contact_position, e.prev_contact_number,
    yn(e.medical_operations), e.medical_operations_detail, yn(e.medical_allergies), e.medical_allergies_detail,
    yn(e.medical_medication), e.medical_medication_detail, yn(e.medical_doctor), e.medical_doctor_detail,
    e.declaration_certificate, e.declaration_place, e.declaration_date, e.declaration_signature,
    yn(e.declaration_consent),
  ].map((v) => (v === null || v === undefined ? '' : String(v)));
}

/** Append one employee row. Never throws — failures are logged so a Sheets
 *  outage cannot block a successful DB submission. */
async function appendEmployee(employee) {
  if (!isEnabled()) return { skipped: true };
  try {
    await ensureHeader();
    const sheets = await getClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [rowFromEmployee(employee)] },
    });
    return { ok: true };
  } catch (err) {
    console.error('Google Sheets append failed (record still saved in DB):', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { appendEmployee, isEnabled };
