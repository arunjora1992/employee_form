const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../auth');
const settings = require('../settings');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname.match(/\.[a-zA-Z0-9]+$/) || ['.png'])[0];
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Logo must be a PNG, JPG, WEBP or SVG image.'));
  },
});

// Full config (admin) — used to populate the settings form
router.get('/', auth.requireAdmin, async (req, res) => {
  res.json({ config: await settings.getConfig() });
});

// Update config (admin)
router.put('/', auth.requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const patch = {};
    const strFields = ['shopName', 'tagline', 'logoEmoji', 'primaryColor', 'headerColor', 'footerNote', 'idCardFooter'];
    for (const f of strFields) if (typeof b[f] === 'string') patch[f] = b[f].trim();

    if (b.contact && typeof b.contact === 'object') {
      patch.contact = {};
      for (const office of ['headOffice', 'branch']) {
        const o = b.contact[office];
        if (o && typeof o === 'object') {
          patch.contact[office] = {
            label: typeof o.label === 'string' ? o.label.trim() : undefined,
            address: typeof o.address === 'string' ? o.address.trim() : undefined,
            email: typeof o.email === 'string' ? o.email.trim() : undefined,
            phones: Array.isArray(o.phones)
              ? o.phones.map((p) => String(p).trim()).filter(Boolean)
              : undefined,
          };
        }
      }
      if (Array.isArray(b.contact.emails)) {
        patch.contact.emails = b.contact.emails.map((e) => String(e).trim()).filter(Boolean);
      }
    }
    const config = await settings.saveConfig(patch);
    res.json({ config });
  } catch (err) {
    console.error('Update settings error:', err.message);
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

// Upload a logo image (admin)
router.post('/logo', auth.requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No logo file received.' });
    const config = await settings.saveConfig({ logoPath: `/uploads/${req.file.filename}` });
    res.json({ config });
  } catch (err) {
    console.error('Logo upload error:', err.message);
    res.status(500).json({ error: err.message || 'Logo upload failed.' });
  }
});

// Remove the uploaded logo (revert to emoji) (admin)
router.delete('/logo', auth.requireAdmin, async (req, res) => {
  const config = await settings.saveConfig({ logoPath: null });
  res.json({ config });
});

module.exports = router;
