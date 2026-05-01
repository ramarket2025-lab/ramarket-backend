const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Login/Register user after Firebase OTP
router.post('/login', async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ message: "Mobile required" });
  }

  const { data, error } = await supabase
    .from('users')
    .upsert([{ phone: mobile }]);

  if (error) return res.status(400).json(error);

  res.json({ success: true, user: data });
});

module.exports = router;