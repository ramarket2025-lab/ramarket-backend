const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// Add to cart
router.post('/add', async (req, res) => {
  const { user_id, product_id, qty } = req.body;

  const { data, error } = await supabase
    .from('cart')
    .insert([{ user_id, product_id, qty }])
    .select(); // ✅ IMPORTANT

  if (error) return res.status(400).json(error);

  res.json(data);
});

// Get cart
router.get('/:user_id', async (req, res) => {
  const { data, error } = await supabase
    .from('cart')
    .select('*')
    .eq('user_id', req.params.user_id);

  if (error) return res.status(400).json(error);

  res.json(data);
});

// Remove item
router.delete('/remove/:id', async (req, res) => {
  const { error } = await supabase
    .from('cart')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json(error);

  res.json({ success: true });
});

module.exports = router;