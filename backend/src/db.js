const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'sekar',
  password: process.env.DB_PASSWORD || 'sekar_secret',
  database: process.env.DB_NAME || 'sekar_employees',
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Wait for the database to accept connections (the db container may still be
 * booting when the app starts under docker-compose).
 */
async function waitForDb(retries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('Connected to PostgreSQL.');
      return;
    } catch (err) {
      console.log(`DB not ready (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to PostgreSQL after multiple attempts.');
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  waitForDb,
};
