// Shared helpers: theme toggle, auth guard, header rendering.

(function () {
  // ---- Theme ----
  const STORAGE_KEY = 'sekar-theme';
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }
  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };
  initTheme();

  // ---- API helper ----
  window.api = async function (url, options = {}) {
    const opts = { credentials: 'same-origin', headers: {}, ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  };

  // ---- Current user ----
  window.getCurrentUser = async function () {
    try { return (await api('/api/auth/me')).user; }
    catch { return null; }
  };

  window.logout = async function () {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    location.href = '/login.html';
  };

  // ---- Header ----
  window.renderHeader = function (user) {
    const nav = document.getElementById('headerNav');
    if (!nav) return;
    let links = '';
    if (user) {
      links += `<a class="btn btn-sm btn-secondary" href="/">New Form</a>`;
      if (user.role === 'admin') links += `<a class="btn btn-sm btn-secondary" href="/admin.html">Admin</a>`;
      links += `<span class="muted" style="margin:0 6px;font-size:.85rem">${user.name}</span>`;
      links += `<button class="btn btn-sm btn-secondary" onclick="logout()">Logout</button>`;
    } else {
      links += `<a class="btn btn-sm btn-secondary" href="/login.html">Login</a>`;
      links += `<a class="btn btn-sm btn-primary" href="/register.html">Register</a>`;
    }
    nav.insertAdjacentHTML('afterbegin', links);
  };

  window.escapeHtml = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  };
})();
