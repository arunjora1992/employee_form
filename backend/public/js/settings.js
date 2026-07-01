// Admin settings / customization page.

(async function () {
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  if (user.role !== 'admin') {
    document.body.innerHTML = '<div class="container"><div class="card alert alert-error">Administrator access required.</div></div>';
    return;
  }
  renderHeader(user);

  const form = document.getElementById('settingsForm');
  const msg = document.getElementById('msg');
  const logoPreview = document.getElementById('logoPreview');

  function setVal(name, value) { if (form[name]) form[name].value = value ?? ''; }

  function renderLogoPreview(cfg) {
    if (cfg.logoPath) {
      logoPreview.innerHTML = `<img src="${escapeHtml(cfg.logoPath)}?t=${Date.now()}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px" />`;
      logoPreview.style.background = 'transparent';
    } else {
      logoPreview.textContent = cfg.logoEmoji || '⚡';
      logoPreview.style.background = cfg.primaryColor || 'var(--amber)';
    }
  }

  async function loadSettings() {
    const { config } = await api('/api/settings');
    setVal('shopName', config.shopName);
    setVal('tagline', config.tagline);
    setVal('footerNote', config.footerNote);
    setVal('idCardFooter', config.idCardFooter);
    setVal('primaryColor', config.primaryColor || '#f5a623');
    setVal('headerColor', config.headerColor || '#1b3a5b');
    setVal('logoEmoji', config.logoEmoji);
    const ho = config.contact?.headOffice || {};
    const br = config.contact?.branch || {};
    setVal('ho_label', ho.label); setVal('ho_email', ho.email);
    setVal('ho_address', ho.address); setVal('ho_phones', (ho.phones || []).join(', '));
    setVal('br_label', br.label); setVal('br_email', br.email);
    setVal('br_address', br.address); setVal('br_phones', (br.phones || []).join(', '));
    setVal('emails', (config.contact?.emails || []).join(', '));
    renderLogoPreview(config);
    return config;
  }

  const splitList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving…';
    try {
      const payload = {
        shopName: form.shopName.value,
        tagline: form.tagline.value,
        footerNote: form.footerNote.value,
        idCardFooter: form.idCardFooter.value,
        primaryColor: form.primaryColor.value,
        headerColor: form.headerColor.value,
        logoEmoji: form.logoEmoji.value,
        contact: {
          headOffice: {
            label: form.ho_label.value, email: form.ho_email.value,
            address: form.ho_address.value, phones: splitList(form.ho_phones.value),
          },
          branch: {
            label: form.br_label.value, email: form.br_email.value,
            address: form.br_address.value, phones: splitList(form.br_phones.value),
          },
          emails: splitList(form.emails.value),
        },
      };
      const { config } = await api('/api/settings', { method: 'PUT', body: payload });
      applyBranding(config);
      renderLogoPreview(config);
      msg.innerHTML = '<div class="alert alert-success">✅ Settings saved. Branding updated across the portal.</div>';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Save Settings';
    }
  });

  // Logo upload (immediate)
  document.getElementById('logoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    msg.innerHTML = '';
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const { config } = await api('/api/settings/logo', { method: 'POST', body: fd });
      applyBranding(config);
      renderLogoPreview(config);
      msg.innerHTML = '<div class="alert alert-success">✅ Logo uploaded.</div>';
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
    e.target.value = '';
  });

  // Remove uploaded logo
  document.getElementById('removeLogo').addEventListener('click', async () => {
    try {
      const { config } = await api('/api/settings/logo', { method: 'DELETE' });
      applyBranding(config);
      renderLogoPreview(config);
      msg.innerHTML = '<div class="alert alert-info">Uploaded logo removed — using emoji fallback.</div>';
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  });

  await loadSettings();
})();
