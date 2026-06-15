// Employee form page logic.

(async function () {
  // Require login
  const user = await getCurrentUser();
  if (!user) { location.href = '/login.html'; return; }
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
      const cfg = await api('/api/config');
      const c = cfg.contact;
      document.getElementById('footer').innerHTML = `
        <div>
          <h4>${escapeHtml(cfg.shopName)}</h4>
          <p class="muted">${escapeHtml(cfg.tagline)}</p>
          <p class="muted">Electricals · Plumbing/Pipes · Paints · Building Construction Materials</p>
        </div>
        <div>
          <h4>Head Office — Karur</h4>
          <p>${escapeHtml(c.headOffice.address)}</p>
          <p>📞 ${c.headOffice.phones.map(escapeHtml).join(', ')}</p>
          <p>✉️ ${escapeHtml(c.headOffice.email)}</p>
        </div>
        <div>
          <h4>Branch — Namakkal</h4>
          <p>${escapeHtml(c.branch.address)}</p>
          <p>📞 ${c.branch.phones.map(escapeHtml).join(', ')}</p>
          <p>✉️ ${escapeHtml(c.branch.email)}</p>
        </div>`;
    } catch { /* footer optional */ }
  }
})();
