// routes/admin/adminAuth.js
// ------------------------------------------------------------------
// POST /api/admin/auth/login   — validate credentials, return JWT
// POST /api/admin/auth/refresh — issue a fresh token
// GET  /api/admin/auth/me      — return decoded admin info from token
// ------------------------------------------------------------------

const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const adminAuth = require('../../middleware/adminAuth');

const SECRET  = process.env.ADMIN_JWT_SECRET || 'ramarket_admin_secret';
const EXPIRES = '8h';

// Credentials live in .env so they can be rotated without a redeploy.
// ADMIN_USERNAME and ADMIN_PASSWORD must be set there.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ── POST /api/admin/auth/login ─────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    SECRET,
    { expiresIn: EXPIRES }
  );

  res.json({
    success: true,
    token,
    expiresIn: EXPIRES,
    admin: { username, role: 'admin' }
  });
});

// ── POST /api/admin/auth/refresh ───────────────────────────────────
router.post('/refresh', adminAuth, (req, res) => {
  const token = jwt.sign(
    { username: req.admin.username, role: 'admin' },
    SECRET,
    { expiresIn: EXPIRES }
  );
  res.json({ success: true, token, expiresIn: EXPIRES });
});

// ── GET /api/admin/auth/me ─────────────────────────────────────────
router.get('/me', adminAuth, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ── POST /api/admin/auth/logout ────────────────────────────────────
// JWT is stateless; logout is handled client-side by discarding the token.
// This endpoint exists so the client can call it for a consistent UX.
router.post('/logout', adminAuth, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;