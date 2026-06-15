const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_TTL = '7d';
const COOKIE_NAME = 'sekar_token';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Express middleware — requires a valid auth token. */
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

/** Roles: 'admin' (full), 'viewer' (read-only records), 'user' (fills forms). */
const ROLES = ['admin', 'viewer', 'user'];

/** Express middleware factory — requires the user to hold one of `roles`. */
function requireRole(...roles) {
  return (req, res, next) =>
    requireAuth(req, res, () => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'You do not have permission for this action.' });
      }
      next();
    });
}

/** Requires admin. */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    next();
  });
}

/** Allows admin or read-only viewer (for record viewing/export). */
const requireViewer = requireRole('admin', 'viewer');

/** Seed an initial admin user from environment variables (idempotent). */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrator';
  if (!email || !password) {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.');
    return;
  }
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    console.log(`Admin user ${email} already exists.`);
    return;
  }
  const hash = await hashPassword(password);
  await db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [name, email.toLowerCase(), hash, 'admin']
  );
  console.log(`Seeded admin user: ${email}`);
}

module.exports = {
  COOKIE_NAME,
  ROLES,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  hashPassword,
  verifyPassword,
  requireAuth,
  requireRole,
  requireAdmin,
  requireViewer,
  seedAdmin,
};
