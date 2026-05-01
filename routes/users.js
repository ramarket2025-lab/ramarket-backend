const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Update address
router.post('/address', async (req, res) => {
  const { user_id, address } = req.body;

  const { data, error } = await supabase
    .from('users')
    .update({ address })
    .eq('id', user_id);

  if (error) return res.status(400).json(error);

  res.json(data);
});

module.exports = router;