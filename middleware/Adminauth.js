// middleware/adminAuth.js
// ------------------------------------------------------------------
// Lightweight admin auth middleware.
// The adminAuth route issues a signed JWT on login; every other admin
// route runs this middleware first to verify the token.
// ------------------------------------------------------------------

const jwt = require('jsonwebtoken');

module.exports = function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'ramarket_admin_secret');
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};