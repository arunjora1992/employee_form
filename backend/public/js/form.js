// Employee form page logic — handles both new submissions and editing an
// existing record (when the URL carries ?id=<uuid>).

(async function () {
  // Require login
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  // Read-only viewers cannot submit forms — send them to the records view.
  if (user.role === 'viewer') { location.href = '/admin'; return; }

  const editId = new URLSearchParams(location.search).get('id');
  // Editing an existing record is an admin action.
  if (editId && user.role !== 'admin') { location.href = '/admin'; return; }

  renderHeader(user);
  loadFooter();

  const form = document.getElementById('empForm');
  const msg = document.getElementById('msg');
  const submitBtn = document.getElementById('submitBtn');

  // Reveal "specify" detail inputs when a medical Yes is chosen
  const detailInputs = document.querySelectorAll('input[data-detail-for]');
  detailInputs.forEach((input) => {
    const group = input.getAttribute('data-detail-for');
    const radios = document.querySelectorAll(`input[name="${group}"]`);
    const sync = () => {
      const yes = document.querySelector(`input[name="${group}"]:checked`)?.value === 'true';
      input.classList.toggle('hidden', !yes);
      if (!yes) input.value = '';
    };
    radios.forEach((r) => r.addEventListener('change', sync));
    input._sync = sync;
    sync();
  });

  const DATE_FIELDS = new Set(['date_of_birth', 'declaration_date']);

  function ymd(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  // ---- Edit mode: prefill the form from an existing record ----
  if (editId) {
    document.title = 'Edit Employee · Sekar & Co';
    const titleEl = document.getElementById('formTitle');
    const introEl = document.getElementById('formIntro');
    if (titleEl) titleEl.textContent = 'Edit Employee Details';
    if (introEl) introEl.textContent = 'Update the fields below and save your changes.';
    submitBtn.textContent = 'Save Changes';
    submitBtn.disabled = true;
    try {
      const { employee } = await api(`/api/employees/${editId}`);
      prefill(employee);
      submitBtn.disabled = false;
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">Could not load record: ${escapeHtml(err.message)}</div>`;
      submitBtn.disabled = false;
      return;
    }
  }

  function prefill(e) {
    Object.keys(e || {}).forEach((key) => {
      const val = e[key];
      const els = form.elements[key];
      if (!els) return;
      const nodeList = els instanceof RadioNodeList || els instanceof NodeList ? els : [els];

      // Radio group (gender, marital_status, esi_applicable, medical_*)
      if (nodeList.length && nodeList[0] && nodeList[0].type === 'radio') {
        const want = typeof val === 'boolean' ? String(val) : (val === null || val === undefined ? '' : String(val));
        nodeList.forEach((r) => { r.checked = (r.value === want); });
        return;
      }
      const el = nodeList[0] || els;
      if (!el || !el.type) return;
      if (el.type === 'checkbox') { el.checked = !!val; return; }
      if (el.type === 'file') return; // handled separately
      if (DATE_FIELDS.has(key)) { el.value = ymd(val); return; }
      el.value = (val === null || val === undefined) ? '' : String(val);
    });

    // Re-run medical detail visibility after radios are set
    detailInputs.forEach((i) => i._sync && i._sync());

    // Photo: show the current image; uploading a new one is optional
    const cur = document.getElementById('currentPhoto');
    const hint = document.getElementById('photoHint');
    if (hint) hint.textContent = 'Leave empty to keep the current photo. JPG / PNG / WEBP, max 5 MB.';
    if (cur) {
      cur.innerHTML = e.photo_path
        ? `<div style="margin-top:8px"><img src="${escapeHtml(e.photo_path)}" alt="Current photo" style="height:90px;border-radius:8px;border:1px solid var(--border);object-fit:cover" /><div class="hint">Current photo</div></div>`
        : '';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    if (!form.declaration_consent.checked) {
      msg.innerHTML = `<div class="alert alert-error">You must agree to the declaration before ${editId ? 'saving' : 'submitting'}.</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> ${editId ? 'Saving…' : 'Submitting…'}`;

    try {
      const fd = new FormData(form);
      if (!form.declaration_consent.checked) fd.set('declaration_consent', 'false');
      // Don't send an empty file part on edit (keeps the existing photo)
      if (editId) {
        const photo = form.elements['photo'];
        if (photo && (!photo.files || !photo.files.length)) fd.delete('photo');
      }

      if (editId) {
        await api(`/api/employees/${editId}`, { method: 'PUT', body: fd });
        msg.innerHTML = `<div class="alert alert-success">✅ Changes saved. <a href="/admin">Back to records</a></div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const result = await api('/api/employees', { method: 'POST', body: fd });
        let extra = '';
        if (result.googleSheets && result.googleSheets.ok) extra = ' It was also mirrored to Google Sheets.';
        else if (result.googleSheets && result.googleSheets.ok === false) extra = ' (Saved to database; Google Sheets sync failed — an admin can re-check.)';
        msg.innerHTML = `<div class="alert alert-success">✅ Employee details submitted successfully.${extra}</div>`;
        form.reset();
        detailInputs.forEach((i) => i.classList.add('hidden'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editId ? 'Save Changes' : 'Submit Employee Details';
    }
  });

  async function loadFooter() {
    try {
      const cfg = await getConfig();
      const c = cfg.contact || {};
      const office = (o) => o ? `
        <div>
          <h4>${escapeHtml(o.label || '')}</h4>
          <p>${escapeHtml(o.address || '')}</p>
          ${o.phones && o.phones.length ? `<p>📞 ${o.phones.map(escapeHtml).join(', ')}</p>` : ''}
          ${o.email ? `<p>✉️ ${escapeHtml(o.email)}</p>` : ''}
        </div>` : '';
      document.getElementById('footer').innerHTML = `
        <div>
          <h4>${escapeHtml(cfg.shopName)}</h4>
          <p class="muted">${escapeHtml(cfg.tagline)}</p>
          <p class="muted">${escapeHtml(cfg.footerNote || '')}</p>
          ${c.emails && c.emails.length ? `<p class="muted">${c.emails.map(escapeHtml).join(' · ')}</p>` : ''}
        </div>
        ${office(c.headOffice)}
        ${office(c.branch)}`;
    } catch { /* footer optional */ }
  }
})();
