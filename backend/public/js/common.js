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
    location.href = '/login';
  };

  // ---- Header ----
  window.renderHeader = function (user) {
    const nav = document.getElementById('headerNav');
    if (!nav) return;
    let links = '';
    if (user) {
      // Employees & admins can fill the form; read-only viewers cannot.
      if (user.role === 'user' || user.role === 'admin') {
        links += `<a class="btn btn-sm btn-secondary" href="/">New Form</a>`;
      }
      if (user.role === 'admin' || user.role === 'viewer') {
        links += `<a class="btn btn-sm btn-secondary" href="/admin">Records</a>`;
      }
      if (user.role === 'admin') {
        links += `<a class="btn btn-sm btn-secondary" href="/users">Users</a>`;
        links += `<a class="btn btn-sm btn-secondary" href="/settings">Settings</a>`;
      }
      const roleBadge = { admin: 'Admin', viewer: 'Read-only', user: 'Employee' }[user.role] || '';
      links += `<span class="header-user">${escapeHtml(user.name)}${roleBadge ? ` · ${roleBadge}` : ''}</span>`;
      links += `<button class="btn btn-sm btn-secondary" onclick="logout()">Logout</button>`;
    } else {
      links += `<a class="btn btn-sm btn-secondary" href="/login">Login</a>`;
      links += `<a class="btn btn-sm btn-primary" href="/register">Register</a>`;
    }
    nav.insertAdjacentHTML('afterbegin', links);
  };

  // ---- Dynamic branding (logo, name, tagline, colors, favicon) ----
  let _configCache = null;
  window.getConfig = async function () {
    if (_configCache) return _configCache;
    _configCache = await api('/api/config');
    return _configCache;
  };

  window.applyBranding = function (cfg) {
    if (!cfg) return;
    // Accent + header colors
    if (cfg.primaryColor) document.documentElement.style.setProperty('--amber', cfg.primaryColor);
    if (cfg.headerColor) {
      document.documentElement.style.setProperty(
        '--header-bg',
        `linear-gradient(135deg, ${cfg.headerColor} 0%, color-mix(in srgb, ${cfg.headerColor} 78%, #ffffff) 100%)`
      );
    }
    // Brand logo + name + tagline
    const logoEl = document.querySelector('.brand .logo');
    if (logoEl) {
      if (cfg.logoPath) {
        logoEl.innerHTML = `<img src="${escapeHtml(cfg.logoPath)}" alt="logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px" />`;
        logoEl.style.background = 'transparent';
        logoEl.style.boxShadow = 'none';
      } else if (cfg.logoEmoji) {
        logoEl.textContent = cfg.logoEmoji;
      }
    }
    const nameEl = document.querySelector('.brand h1');
    if (nameEl && cfg.shopName) nameEl.textContent = cfg.shopName.toUpperCase();
    // Page tab title prefix
    if (cfg.shopName) document.title = document.title.replace(/Sekar & Co/gi, cfg.shopName);
  };

  // Auto-apply branding on every page that includes common.js
  window.initBranding = async function () {
    try { applyBranding(await getConfig()); } catch { /* keep static fallback */ }
  };
  initBranding();

  window.escapeHtml = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  };
})();
