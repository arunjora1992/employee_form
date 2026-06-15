/**
 * Lightweight idempotent migrations applied on startup, so already-running
 * databases (with a persisted volume) pick up schema changes without a reset.
 */
const db = require('./db');

async function runMigrations() {
  // Allow the 'viewer' (read-only) role on the existing users.role check.
  await db.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  await db.query(
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'viewer'))`
  );
  console.log('Migrations applied.');
}

module.exports = { runMigrations };
