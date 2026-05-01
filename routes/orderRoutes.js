const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// 🟢 Place Order
router.post('/place', async (req, res) => {
  const { user_id, items, total } = req.body;

  if (!user_id || !items || !total) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // 1️⃣ Insert into orders table
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ user_id, total }])
      .select();

    if (orderError) return res.status(400).json(orderError);

    const order_id = orderData[0].id;

    // 2️⃣ Insert into order_items table
    const itemsToInsert = items.map(item => ({
      order_id,
      product_id: item.product_id,
      quantity: item.qty,
      price: item.price || 0
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) return res.status(400).json(itemsError);

    res.json({
      success: true,
      order_id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🟢 Get Orders with Items
router.get('/:user_id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        product_id,
        quantity,
        price
      )
    `)
    .eq('user_id', req.params.user_id);

  if (error) return res.status(400).json(error);

  res.json(data);
});

module.exports = router;