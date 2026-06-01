const express  = require('express');
const router   = express.Router();
const supabase = require('../supabase');

// POST /api/cart/add — add item or increment qty if already in cart
router.post('/add', async (req, res) => {
  const { user_id, product_id, qty } = req.body;
  if (!user_id || !product_id) {
    return res.status(400).json({ message: 'user_id and product_id required' });
  }

  const { data: existing } = await supabase
    .from('cart')
    .select('*')
    .eq('user_id', user_id)
    .eq('product_id', product_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('cart')
      .update({ qty: existing.qty + (qty || 1) })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) return res.status(400).json(error);
    return res.json(data);
  }

  const { data, error } = await supabase
    .from('cart')
    .insert([{ user_id, product_id, qty: qty || 1 }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json(data);
});

// GET /api/cart/:user_id — get cart items
// FIX: removed products(*) join which was causing 400.
// If your Supabase has a foreign key from cart.product_id → products.id,
// you can re-enable the join. Otherwise this returns cart rows only.
router.get('/:user_id', async (req, res) => {
  const { data, error } = await supabase
    .from('cart')
    .select('*')
    .eq('user_id', req.params.user_id);

  if (error) return res.status(400).json(error);
  res.json(data);
});

// PATCH /api/cart/update/:id — update quantity of a cart item
router.patch('/update/:id', async (req, res) => {
  const { qty } = req.body;
  if (!qty || qty < 1) return res.status(400).json({ message: 'qty must be >= 1' });

  const { data, error } = await supabase
    .from('cart')
    .update({ qty })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json(data);
});

// DELETE /api/cart/remove/:id — remove a single cart item
router.delete('/remove/:id', async (req, res) => {
  const { error } = await supabase
    .from('cart')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json(error);
  res.json({ success: true });
});

// DELETE /api/cart/clear/:user_id — remove all items for a user
router.delete('/clear/:user_id', async (req, res) => {
  const { error } = await supabase
    .from('cart')
    .delete()
    .eq('user_id', req.params.user_id);

  if (error) return res.status(400).json(error);
  res.json({ success: true });
});

module.exports = router;
