// Admin dashboard logic.

(async function () {
  const user = await getCurrentUser();
  if (!user) { location.href = '/login.html'; return; }
  if (user.role !== 'admin') {
    document.body.innerHTML = '<div class="container"><div class="card alert alert-error">Administrator access required.</div></div>';
    return;
  }
  renderHeader(user);

  const rowsEl = document.getElementById('rows');
  const msg = document.getElementById('msg');
  const countBadge = document.getElementById('countBadge');
  const searchEl = document.getElementById('search');
  let cache = [];

  function fmtDate(d) {
    if (!d) return '—';
    try { return new Date(d).toLocaleString(); } catch { return d; }
  }

  async function load(search = '') {
    rowsEl.innerHTML = '<tr><td colspan="7" class="center muted">Loading…</td></tr>';
    try {
      const url = '/api/employees' + (search ? `?search=${encodeURIComponent(search)}` : '');
      const data = await api(url);
      cache = data.employees;
      countBadge.textContent = `${cache.length} record${cache.length === 1 ? '' : 's'}`;
      if (!cache.length) {
        rowsEl.innerHTML = '<tr><td colspan="7" class="center muted">No employee records found.</td></tr>';
        return;
      }
      rowsEl.innerHTML = cache.map((e) => `
        <tr>
          <td><strong>${escapeHtml(e.full_name)}</strong></td>
          <td>${escapeHtml(e.designation) || '—'}</td>
          <td>${escapeHtml(e.division) || '—'}</td>
          <td>${escapeHtml(e.personal_phone) || '—'}</td>
          <td>${escapeHtml(e.email) || '—'}</td>
          <td class="muted">${fmtDate(e.created_at)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-secondary" data-view="${e.id}">View</button>
            <button class="btn btn-sm btn-danger" data-del="${e.id}">Delete</button>
          </td>
        </tr>`).join('');
    } catch (err) {
      rowsEl.innerHTML = `<tr><td colspan="7" class="center">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  // Event delegation for View / Delete
  rowsEl.addEventListener('click', async (e) => {
    const viewId = e.target.getAttribute('data-view');
    const delId = e.target.getAttribute('data-del');
    if (viewId) return showDetail(viewId);
    if (delId) {
      if (!confirm('Delete this employee record? This cannot be undone.')) return;
      try {
        await api(`/api/employees/${delId}`, { method: 'DELETE' });
        load(searchEl.value.trim());
      } catch (err) {
        msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }
  });

  const kv = (k, v) => `<div class="kv"><div class="k">${escapeHtml(k)}</div><div class="v">${v === null || v === undefined || v === '' ? '—' : escapeHtml(v)}</div></div>`;
  const yn = (b) => (b ? 'Yes' : 'No');

  function showDetail(id) {
    const e = cache.find((x) => x.id === id);
    if (!e) return;
    const modal = document.getElementById('modal');
    const photo = e.photo_path
      ? `<img class="detail-photo" src="${escapeHtml(e.photo_path)}" alt="Photo" />`
      : '';
    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div>
          <h3 style="margin:0">${escapeHtml(e.full_name)}</h3>
          <p class="muted" style="margin:2px 0">${escapeHtml(e.designation) || ''} ${e.division ? '· ' + escapeHtml(e.division) : ''}</p>
        </div>
        ${photo}
      </div>
      <div class="detail-grid">
        <div class="sub">Personal Information</div>
        ${kv('Date of Birth', e.date_of_birth)}
        ${kv('Blood Group', e.blood_group)}
        ${kv('Gender', e.gender)}
        ${kv('Marital Status', e.marital_status)}
        ${kv('Personal Phone', e.personal_phone)}
        ${kv('Email', e.email)}
        ${kv('Permanent Address', e.permanent_address)}

        <div class="sub">Employment &amp; Joining</div>
        ${kv('Designation', e.designation)}
        ${kv('Division', e.division)}
        ${kv('Joining Month/Year', e.joining_month_year)}
        ${kv('Reporting To', e.reporting_to)}
        ${kv('Referenced By', e.referenced_by)}
        ${kv('Reference Phone', e.reference_phone)}

        <div class="sub">Identity &amp; Statutory</div>
        ${kv('PAN Card No', e.pan_card_no)}
        ${kv('Aadhaar Card No', e.aadhaar_card_no)}
        ${kv('ESI Applicable', yn(e.esi_applicable))}
        ${kv('ESI No', e.esi_no)}
        ${kv('Proof 1', e.proof_1)}
        ${kv('Proof 2', e.proof_2)}

        <div class="sub">Emergency Contact</div>
        ${kv('Contact Person', e.emergency_contact_person)}
        ${kv('Relationship', e.emergency_relationship)}
        ${kv('Contact No', e.emergency_contact_no)}

        <div class="sub">Educational Qualifications</div>
        ${kv('Highest Qualification', e.highest_qualification)}
        ${kv('College/Institution', e.college_name)}
        ${kv('College Location', e.college_location)}
        ${kv('School', e.school_name)}
        ${kv('School Location', e.school_location)}

        <div class="sub">Previous Work</div>
        ${kv('Organization', e.prev_organization)}
        ${kv('Position Held', e.prev_position)}
        ${kv('Salary Drawn', e.prev_salary)}
        ${kv('Period From', e.prev_period_from)}
        ${kv('Period To', e.prev_period_to)}
        ${kv('Reason for Leaving', e.prev_reason_for_leaving)}
        ${kv('Contact Name', e.prev_contact_name)}
        ${kv('Contact Position', e.prev_contact_position)}
        ${kv('Contact Number', e.prev_contact_number)}

        <div class="sub">Medical Record</div>
        ${kv('Operations', yn(e.medical_operations) + (e.medical_operations_detail ? ' — ' + e.medical_operations_detail : ''))}
        ${kv('Allergies', yn(e.medical_allergies) + (e.medical_allergies_detail ? ' — ' + e.medical_allergies_detail : ''))}
        ${kv('Regular Medication', yn(e.medical_medication) + (e.medical_medication_detail ? ' — ' + e.medical_medication_detail : ''))}
        ${kv('Specific Doctor', yn(e.medical_doctor) + (e.medical_doctor_detail ? ' — ' + e.medical_doctor_detail : ''))}

        <div class="sub">Declaration</div>
        ${kv('Certificate', e.declaration_certificate)}
        ${kv('Place', e.declaration_place)}
        ${kv('Date', e.declaration_date)}
        ${kv('Signature', e.declaration_signature)}
        ${kv('Consent Given', yn(e.declaration_consent))}
        ${kv('Submitted At', fmtDate(e.created_at))}
      </div>
      <div class="center" style="margin-top:20px">
        <button class="btn btn-secondary" id="closeModal">Close</button>
      </div>`;
    document.getElementById('modalBackdrop').classList.add('open');
    document.getElementById('closeModal').onclick = closeModal;
  }

  function closeModal() { document.getElementById('modalBackdrop').classList.remove('open'); }
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });

  // Search (debounced) + refresh
  let t;
  searchEl.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => load(searchEl.value.trim()), 300);
  });
  document.getElementById('refreshBtn').addEventListener('click', () => load(searchEl.value.trim()));

  load();
})();
