const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/auth/login
// Login / register user after Firebase OTP verification
router.post('/login', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ message: "Mobile required" });

  const { data, error } = await supabase
    .from('users')
    .upsert([{ phone: mobile }], { onConflict: 'phone' })
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, user: data });
});

// GET /api/auth/me?phone=9876543210
// Get current user profile
router.get('/me', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ message: "Phone required" });

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error) return res.status(404).json({ message: "User not found" });
  res.json(data);
});

// PUT /api/auth/profile
// Update user name / profile_pic
router.put('/profile', async (req, res) => {
  const { phone, name, profile_pic } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone required" });

  const updates = {};
  if (name)        updates.name        = name;
  if (profile_pic) updates.profile_pic = profile_pic;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('phone', phone)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, user: data });
});

module.exports = router;