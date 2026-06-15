// Employee form page logic.

(async function () {
  // Require login
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  // Read-only viewers cannot submit forms — send them to the records view.
  if (user.role === 'viewer') { location.href = '/admin'; return; }
  renderHeader(user);
  loadFooter();

  // Reveal "specify" detail inputs when a medical Yes is chosen
  document.querySelectorAll('input[data-detail-for]').forEach((input) => {
    const group = input.getAttribute('data-detail-for');
    const radios = document.querySelectorAll(`input[name="${group}"]`);
    const sync = () => {
      const yes = document.querySelector(`input[name="${group}"]:checked`)?.value === 'true';
      input.classList.toggle('hidden', !yes);
      if (!yes) input.value = '';
    };
    radios.forEach((r) => r.addEventListener('change', sync));
    sync();
  });

  const form = document.getElementById('empForm');
  const msg = document.getElementById('msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    if (!form.declaration_consent.checked) {
      msg.innerHTML = `<div class="alert alert-error">You must agree to the declaration before submitting.</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting…';

    try {
      const fd = new FormData(form);
      // Unchecked checkbox: ensure a value is sent
      if (!form.declaration_consent.checked) fd.set('declaration_consent', 'false');

      const result = await api('/api/employees', { method: 'POST', body: fd });
      let extra = '';
      if (result.googleSheets && result.googleSheets.ok) extra = ' It was also mirrored to Google Sheets.';
      else if (result.googleSheets && result.googleSheets.ok === false) extra = ' (Saved to database; Google Sheets sync failed — an admin can re-check.)';
      msg.innerHTML = `<div class="alert alert-success">✅ Employee details submitted successfully.${extra}</div>`;
      form.reset();
      document.querySelectorAll('input[data-detail-for]').forEach((i) => i.classList.add('hidden'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Employee Details';
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
