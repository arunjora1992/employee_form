// Admin user-management page.

(async function () {
  const user = await getCurrentUser();
  if (!user) { location.href = '/login'; return; }
  if (user.role !== 'admin') {
    document.body.innerHTML = '<div class="container"><div class="card alert alert-error">Administrator access required.</div></div>';
    return;
  }
  renderHeader(user);

  const rowsEl = document.getElementById('rows');
  const msg = document.getElementById('msg');
  const createForm = document.getElementById('createForm');
  let currentUserId = user.id;

  const ROLE_LABEL = { admin: 'Admin', viewer: 'Read-only', user: 'Employee' };
  const ROLE_OPTIONS = (sel) =>
    ['admin', 'viewer', 'user'].map((r) => `<option value="${r}"${r === sel ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`).join('');

  function fmtDate(d) { try { return new Date(d).toLocaleDateString(); } catch { return d; } }
  function flash(html, kind = 'success') {
    msg.innerHTML = `<div class="alert alert-${kind}">${html}</div>`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function load() {
    rowsEl.innerHTML = '<tr><td colspan="5" class="center muted">Loading…</td></tr>';
    try {
      const data = await api('/api/users');
      currentUserId = data.currentUserId;
      rowsEl.innerHTML = data.users.map((u) => {
        const isSelf = u.id === currentUserId;
        return `
        <tr>
          <td><strong>${escapeHtml(u.name)}</strong>${isSelf ? ' <span class="stat-badge">you</span>' : ''}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>
            <select class="role-select" data-id="${u.id}" ${isSelf ? 'title="You cannot change your own role here"' : ''}>
              ${ROLE_OPTIONS(u.role)}
            </select>
          </td>
          <td class="muted">${fmtDate(u.created_at)}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-secondary" data-pw="${u.id}">Reset Password</button>
            <button class="btn btn-sm btn-danger" data-del="${u.id}" ${isSelf ? 'disabled' : ''}>Delete</button>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      rowsEl.innerHTML = `<tr><td colspan="5" class="center">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('createBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating…';
    try {
      await api('/api/users', {
        method: 'POST',
        body: {
          name: createForm.name.value.trim(),
          email: createForm.email.value.trim(),
          password: createForm.password.value,
          role: createForm.role.value,
        },
      });
      createForm.reset();
      flash('✅ User created.');
      load();
    } catch (err) {
      flash(escapeHtml(err.message), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Create User';
    }
  });

  // Role change
  rowsEl.addEventListener('change', async (e) => {
    const sel = e.target.closest('.role-select');
    if (!sel) return;
    try {
      await api(`/api/users/${sel.dataset.id}`, { method: 'PATCH', body: { role: sel.value } });
      flash('✅ Role updated.');
    } catch (err) {
      flash(escapeHtml(err.message), 'error');
      load();
    }
  });

  // Delete / reset password
  rowsEl.addEventListener('click', async (e) => {
    const delId = e.target.getAttribute('data-del');
    const pwId = e.target.getAttribute('data-pw');
    if (delId) {
      if (!confirm('Delete this user account?')) return;
      try { await api(`/api/users/${delId}`, { method: 'DELETE' }); flash('✅ User deleted.'); load(); }
      catch (err) { flash(escapeHtml(err.message), 'error'); }
    }
    if (pwId) {
      const pw = prompt('Enter a new password for this user (min 6 characters):');
      if (!pw) return;
      try { await api(`/api/users/${pwId}`, { method: 'PATCH', body: { password: pw } }); flash('✅ Password reset.'); }
      catch (err) { flash(escapeHtml(err.message), 'error'); }
    }
  });

  load();
})();
