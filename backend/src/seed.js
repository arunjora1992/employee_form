/**
 * Optional demo data seeder. Inserts two dummy employee records the first time
 * the app boots with an empty employees table. Controlled by env SEED_DEMO
 * (default 'true'); set SEED_DEMO=false to disable.
 */
const db = require('./db');

const DUMMIES = [
  {
    full_name: 'Rajesh Kumar', date_of_birth: '1990-03-15', blood_group: 'B+',
    gender: 'Male', marital_status: 'Married', personal_phone: '9842512345',
    email: 'rajesh.kumar@example.com',
    permanent_address: '24, Thiruvalluvar Street, Gandhipuram, Karur - 639001',
    designation: 'Senior Sales Executive', division: 'Electricals',
    joining_month_year: 'April 2018', reporting_to: 'Chandrasekaran',
    referenced_by: 'Murugan', reference_phone: '9843011223',
    pan_card_no: 'ABCPK1234L', aadhaar_card_no: '4521 7788 9012',
    esi_applicable: true, esi_no: 'ESI-TN-5567',
    proof_1: 'Aadhaar Card', proof_2: 'PAN Card',
    emergency_contact_person: 'Lakshmi Kumar', emergency_relationship: 'Wife',
    emergency_contact_no: '9842598765',
    highest_qualification: 'B.Com', college_name: 'Government Arts College',
    college_location: 'Karur', school_name: 'Municipal Higher Secondary School',
    school_location: 'Karur',
    prev_organization: 'Vasanth Electricals', prev_position: 'Sales Associate',
    prev_salary: '18000', prev_period_from: 'Jun 2014', prev_period_to: 'Mar 2018',
    prev_reason_for_leaving: 'Better career opportunity',
    prev_contact_name: 'Suresh', prev_contact_position: 'Manager',
    prev_contact_number: '9843344556',
    medical_operations: false, medical_operations_detail: null,
    medical_allergies: true, medical_allergies_detail: 'Penicillin',
    medical_medication: false, medical_medication_detail: null,
    medical_doctor: false, medical_doctor_detail: null,
    declaration_certificate: 'Degree', declaration_place: 'Karur',
    declaration_date: '2018-04-02', declaration_signature: 'Rajesh Kumar',
    declaration_consent: true,
  },
  {
    full_name: 'Priya Sundaram', date_of_birth: '1996-11-28', blood_group: 'O+',
    gender: 'Female', marital_status: 'Single', personal_phone: '9787065432',
    email: 'priya.sundaram@example.com',
    permanent_address: '7/3, Bharathi Nagar, Mudhalaipatti, Namakkal - 637003',
    designation: 'Accounts Officer', division: 'Plumbing & Pipes',
    joining_month_year: 'January 2022', reporting_to: 'Rajesh Kumar',
    referenced_by: 'Kavitha', reference_phone: '9842677889',
    pan_card_no: 'FGHPS5678M', aadhaar_card_no: '7812 3344 5566',
    esi_applicable: false, esi_no: null,
    proof_1: 'Aadhaar Card', proof_2: 'Driving Licence',
    emergency_contact_person: 'Sundaram R', emergency_relationship: 'Father',
    emergency_contact_no: '9842611223',
    highest_qualification: 'M.Com', college_name: 'Kongu Arts and Science College',
    college_location: 'Erode', school_name: 'Sri Vidya Mandir',
    school_location: 'Namakkal',
    prev_organization: null, prev_position: null, prev_salary: null,
    prev_period_from: null, prev_period_to: null, prev_reason_for_leaving: null,
    prev_contact_name: null, prev_contact_position: null, prev_contact_number: null,
    medical_operations: false, medical_operations_detail: null,
    medical_allergies: false, medical_allergies_detail: null,
    medical_medication: true, medical_medication_detail: 'Thyroxine (hypothyroidism)',
    medical_doctor: true, medical_doctor_detail: 'Dr. Anand, Namakkal',
    declaration_certificate: 'Post Graduate', declaration_place: 'Namakkal',
    declaration_date: '2022-01-03', declaration_signature: 'Priya Sundaram',
    declaration_consent: true,
  },
];

const COLS = [
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

async function seedDemoEmployees() {
  if (String(process.env.SEED_DEMO || 'true').toLowerCase() !== 'true') return;
  const { rows } = await db.query('SELECT count(*)::int AS c FROM employees');
  if (rows[0].c > 0) return; // never overwrite real data
  const placeholders = COLS.map((_, i) => `$${i + 1}`).join(', ');
  for (const e of DUMMIES) {
    await db.query(
      `INSERT INTO employees (${COLS.join(', ')}) VALUES (${placeholders})`,
      COLS.map((c) => (e[c] === undefined ? null : e[c]))
    );
  }
  console.log(`Seeded ${DUMMIES.length} demo employee records.`);
}

module.exports = { seedDemoEmployees };
