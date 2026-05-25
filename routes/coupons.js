const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// POST /api/coupons/validate — validate a coupon code
router.post('/validate', async (req, res) => {
  const { code, order_total } = req.body;
  if (!code) return res.status(400).json({ message: "Coupon code required" });

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .maybeSingle();

  if (error) return res.status(400).json(error);
  if (!data)  return res.status(404).json({ valid: false, message: "Invalid or inactive coupon" });

  if (data.min_order && order_total < data.min_order) {
    return res.json({
      valid: false,
      message: `Minimum order ₹${data.min_order} required`
    });
  }

  let discount = 0;
  if (data.type === 'flat')    discount = data.value;
  if (data.type === 'percent') discount = Math.round((order_total * data.value) / 100);

  res.json({ valid: true, coupon: data, discount });
});

module.exports = router;