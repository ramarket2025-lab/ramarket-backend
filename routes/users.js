const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/users/address  (legacy — kept for backward compat)
// Updates address field on users table
router.post('/address', async (req, res) => {
  const { user_id, address } = req.body;
  if (!user_id) return res.status(400).json({ message: "user_id required" });

  const { data, error } = await supabase
    .from('users')
    .update({ address })
    .eq('id', user_id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, user: data });
});

module.exports = router;