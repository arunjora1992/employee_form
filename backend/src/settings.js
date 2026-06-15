/**
 * Shop branding & customization, stored in the `settings` table under the
 * single key 'shop_config'. Falls back to DEFAULT_CONFIG (sourced from
 * sekarandco.com) the first time the app boots, then becomes editable by an
 * admin via the Settings page.
 */
const db = require('./db');

const CONFIG_KEY = 'shop_config';

const DEFAULT_CONFIG = {
  shopName: 'Sekar & Co',
  tagline: 'Quality is Permanent',
  logoEmoji: '⚡',          // shown when no logo image is uploaded
  logoPath: null,           // /uploads/... when an admin uploads a logo
  primaryColor: '#f5a623',  // electric amber accent
  headerColor: '#1b3a5b',   // deep blue header
  footerNote: 'Electricals · Plumbing/Pipes · Paints · Building Construction Materials',
  contact: {
    headOffice: {
      label: 'Head Office — Karur',
      address: '13/3, Gowripuram, 3rd Cross, L.G.B Back Side, Karur - 639002',
      phones: ['04324 241796', '04324 240796', '04324 241797'],
      email: 'sekarandcokrr@gmail.com',
    },
    branch: {
      label: 'Branch — Namakkal',
      address: '1/141F, Karur to Salem By Pass Road, Near Over Bridge, Mudhalaipatti, Namakkal - 637003',
      phones: ['94423 86796', '90920 31796', '94870 75796', '97870 76796'],
      email: 'sekarandconkl@gmail.com',
    },
    emails: ['sales@sekarandco.in', 'accounts@sekarandco.in', 'info@sekarandco.in'],
  },
};

/** Deep-merge stored config over defaults so new default keys always appear. */
function mergeConfig(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_CONFIG };
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    contact: {
      ...DEFAULT_CONFIG.contact,
      ...(stored.contact || {}),
      headOffice: { ...DEFAULT_CONFIG.contact.headOffice, ...(stored.contact?.headOffice || {}) },
      branch: { ...DEFAULT_CONFIG.contact.branch, ...(stored.contact?.branch || {}) },
      emails: stored.contact?.emails || DEFAULT_CONFIG.contact.emails,
    },
  };
}

async function getConfig() {
  try {
    const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [CONFIG_KEY]);
    return mergeConfig(rows[0]?.value);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

async function saveConfig(patch) {
  const current = await getConfig();
  const next = mergeConfig({ ...current, ...patch });
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [CONFIG_KEY, next]
  );
  return next;
}

/** Seed the default config row once (idempotent). */
async function seedConfig() {
  const { rows } = await db.query('SELECT 1 FROM settings WHERE key = $1', [CONFIG_KEY]);
  if (!rows.length) {
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [CONFIG_KEY, DEFAULT_CONFIG]);
    console.log('Seeded default shop configuration.');
  }
}

module.exports = { getConfig, saveConfig, seedConfig, DEFAULT_CONFIG };
