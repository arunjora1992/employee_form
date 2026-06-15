const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSIGNABLE_ROLES = ['admin', 'viewer', 'user'];

// List users (admin)
router.get('/', auth.requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows, currentUserId: req.user.id });
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

// Create a user with a chosen role (admin)
router.post('/', auth.requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });

    const lc = email.toLowerCase();
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [lc]);
    if (exists.rows.length) return res.status(409).json({ error: 'An account with this email already exists.' });

    const hash = await auth.hashPassword(password);
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [name.trim(), lc, hash, role]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('Create user error:', err.message);
    res.status(500).json({ error: 'Could not create user.' });
  }
});

// Update a user's role and/or password (admin)
router.patch('/:id', auth.requireAdmin, async (req, res) => {
  try {
    const { role, password } = req.body || {};
    const target = (await db.query('SELECT id, role FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!target) return res.status(404).json({ error: 'User not found.' });

    if (role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      // Prevent removing the last admin (including demoting yourself).
      if (target.role === 'admin' && role !== 'admin') {
        const admins = await db.query("SELECT count(*)::int AS c FROM users WHERE role = 'admin'");
        if (admins.rows[0].c <= 1) return res.status(400).json({ error: 'Cannot demote the last administrator.' });
      }
      await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    }
    if (password !== undefined) {
      if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await auth.hashPassword(password), req.params.id]);
    }
    const { rows } = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.params.id]);
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ error: 'Could not update user.' });
  }
});

// Delete a user (admin)
router.delete('/:id', auth.requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const target = (await db.query('SELECT role FROM users WHERE id = $1', [req.params.id])).rows[0];
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') {
      const admins = await db.query("SELECT count(*)::int AS c FROM users WHERE role = 'admin'");
      if (admins.rows[0].c <= 1) return res.status(400).json({ error: 'Cannot delete the last administrator.' });
    }
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: 'Could not delete user.' });
  }
});

module.exports = router;
