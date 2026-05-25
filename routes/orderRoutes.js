const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/orders/place — place a new order
router.post('/place', async (req, res) => {
  const {
    user_phone, items, total, subtotal, discount, coupon,
    payment_method, payment_status, razorpay_payment_id,
    address, address_id, shipping_address, date
  } = req.body;

  if (!user_phone || !items || !total) {
    return res.status(400).json({ message: "user_phone, items and total are required" });
  }

  const now = new Date().toISOString();

  const { data: savedOrder, error } = await supabase
    .from('orders')
    .insert([{
      user_phone,
      total,
      subtotal:            subtotal || total,
      discount:            discount || 0,
      coupon:              coupon || null,
      status:              'Processing',
      payment_method:      payment_method || 'Cash on Delivery',
      payment_status:      payment_status || 'Pending',
      razorpay_payment_id: razorpay_payment_id || null,
      payment_id:          razorpay_payment_id || null,
      items,
      address:             address || null,
      address_id:          address_id || null,
      shipping_address:    shipping_address || null,
      date:                date || new Date().toLocaleString('en-IN'),
      tracking_id:         null,
      courier:             null,
      last_update:         now,
    }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, order_id: savedOrder.id, order: savedOrder });
});

// GET /api/orders/user/:phone — get all orders for a user
router.get('/user/:phone', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_phone', req.params.phone)
    .order('id', { ascending: false });

  if (error) return res.status(400).json(error);
  res.json(data);
});

// GET /api/orders/:id — get single order by ID
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Order not found" });
  res.json(data);
});

module.exports = router;