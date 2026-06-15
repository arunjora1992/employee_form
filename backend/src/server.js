require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const auth = require('./auth');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const settingsRoutes = require('./routes/settings');
const userRoutes = require('./routes/users');
const settings = require('./settings');
const { seedDemoEmployees } = require('./seed');
const { runMigrations } = require('./migrate');
const { isEnabled: sheetsEnabled } = require('./sheets');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);

// Public shop config (used by the frontend for branding & customization)
app.get('/api/config', async (req, res) => {
  try {
    const config = await settings.getConfig();
    res.json({ ...config, googleSheets: sheetsEnabled() });
  } catch (err) {
    console.error('Config error:', err.message);
    res.status(500).json({ error: 'Could not load configuration.' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

// Uploaded photos
app.use('/uploads', express.static(UPLOAD_DIR));

// Static frontend
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

// Clean, named page routes (no .html in the address bar)
const PAGES = {
  '/': 'index.html',
  '/form': 'index.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/admin': 'admin.html',
  '/settings': 'settings.html',
  '/users': 'users.html',
};
for (const [route, file] of Object.entries(PAGES)) {
  app.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
}

// Fallback for unknown non-API routes -> the form (login guard handles auth)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function start() {
  await db.waitForDb();
  await runMigrations();
  await auth.seedAdmin();
  await settings.seedConfig();
  await seedDemoEmployees();
  app.listen(PORT, () => {
    console.log(`Sekar & Co Employee Portal running on http://localhost:${PORT}`);
    console.log(`Google Sheets mirror: ${sheetsEnabled() ? 'ENABLED' : 'disabled'}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
