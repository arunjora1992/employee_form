require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const auth = require('./auth');
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
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

// Public shop config (used by the frontend for branding)
app.get('/api/config', (req, res) => {
  res.json({
    shopName: 'Sekar & Co',
    tagline: 'Quality is Permanent',
    googleSheets: sheetsEnabled(),
    contact: {
      headOffice: {
        address: '13/3, Gowripuram, 3rd Cross, L.G.B Back Side, Karur - 639002',
        phones: ['04324 241796', '04324 240796', '04324 241797'],
        email: 'sekarandcokrr@gmail.com',
      },
      branch: {
        address: '1/141F, Karur to Salem By Pass Road, Near Over Bridge, Mudhalaipatti, Namakkal - 637003',
        phones: ['94423 86796', '90920 31796', '94870 75796', '97870 76796'],
        email: 'sekarandconkl@gmail.com',
      },
      emails: ['sales@sekarandco.in', 'accounts@sekarandco.in', 'info@sekarandco.in'],
    },
  });
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

// SPA-ish fallback to login for unknown non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function start() {
  await db.waitForDb();
  await auth.seedAdmin();
  app.listen(PORT, () => {
    console.log(`Sekar & Co Employee Portal running on http://localhost:${PORT}`);
    console.log(`Google Sheets mirror: ${sheetsEnabled() ? 'ENABLED' : 'disabled'}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
