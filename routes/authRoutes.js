const express = require('express');
const router  = express.Router();
const supabase = require('../supabase');

// POST /api/auth/login — login or register after OTP
router.post('/login', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ message: 'Mobile required' });

  const { data, error } = await supabase
    .from('users')
    .upsert([{ phone: mobile }], { onConflict: 'phone' })
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, user: data });
});

// GET /api/auth/me?phone=9876543210 — get current user profile
router.get('/me', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ message: 'Phone required' });

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error) return res.status(404).json({ message: 'User not found' });
  res.json(data);
});

// PUT /api/auth/profile — update name and/or profile_pic
// FIX: only update columns that actually exist in your users table
router.put('/profile', async (req, res) => {
  const { phone, name, profile_pic } = req.body;
  if (!phone) return res.status(400).json({ message: 'Phone required' });

  const updates = {};
  if (name !== undefined)        updates.name        = name;
  if (profile_pic !== undefined) updates.profile_pic = profile_pic;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'Nothing to update' });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('phone', phone)
    .select()
    .single();

  // FIX: if error is "no rows", user doesn't exist yet — create them first
  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ message: 'User not found. Login first.' });
    }
    return res.status(400).json(error);
  }
  res.json({ success: true, user: data });
});

module.exports = router;
