// routes/admin/coupons.js
// ------------------------------------------------------------------
// GET    /api/admin/coupons             — list all coupons
// GET    /api/admin/coupons/:id         — single coupon
// POST   /api/admin/coupons             — create coupon
// PUT    /api/admin/coupons/:id         — update coupon
// PATCH  /api/admin/coupons/:id/toggle  — enable / disable
// DELETE /api/admin/coupons/:id         — delete coupon
// POST   /api/admin/coupons/validate    — validate a code (for testing)
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── POST validate (no admin guard — reachable by storefront too) ──
// Place BEFORE router.use(adminAuth) if you want public access; here
// it stays admin-only because the storefront validates via its own flow.
router.post('/validate', async (req, res) => {
  const { code, order_total } = req.body;
  if (!code) return res.status(400).json({ message: 'code is required' });

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .single();

  if (error || !data) return res.status(404).json({ valid: false, message: 'Coupon not found or inactive' });

  if (order_total !== undefined && parseFloat(order_total) < parseFloat(data.min_order || 0)) {
    return res.status(400).json({
      valid: false,
      message: `Minimum order amount is ₹${data.min_order}`,
    });
  }

  const discount = data.type === 'percent'
    ? parseFloat(order_total || 0) * (parseFloat(data.value) / 100)
    : parseFloat(data.value);

  res.json({ valid: true, coupon: data, discount: parseFloat(discount.toFixed(2)) });
});

// ── GET all ───────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { active } = req.query;

  let query = supabase.from('coupons').select('*').order('id', { ascending: false });
  if (active !== undefined) query = query.eq('active', active === 'true');

  const { data, error } = await query;
  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, coupons: data, total: data.length });
});

// ── GET single ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Coupon not found' });
  res.json({ success: true, coupon: data });
});

// ── POST create ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { code, type, value, min_order = 0, active = true } = req.body;

  if (!code || !type || value === undefined) {
    return res.status(400).json({ message: 'code, type and value are required' });
  }
  if (!['flat', 'percent'].includes(type)) {
    return res.status(400).json({ message: "type must be 'flat' or 'percent'" });
  }

  const { data, error } = await supabase
    .from('coupons')
    .insert([{ code: code.toUpperCase(), type, value, min_order, active }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ success: true, coupon: data });
});

// ── PUT update ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const allowed = ['code','type','value','min_order','active'];
  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
  if (updates.code) updates.code = updates.code.toUpperCase();

  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, coupon: data });
});

// ── PATCH toggle active ───────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  const { data: current, error: fetchErr } = await supabase
    .from('coupons')
    .select('active')
    .eq('id', req.params.id)
    .single();

  if (fetchErr) return res.status(404).json({ message: 'Coupon not found' });

  const { data, error } = await supabase
    .from('coupons')
    .update({ active: !current.active })
    .eq('id', req.params.id)
    .select('id, code, active')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, coupon: data });
});

// ── DELETE ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Coupon deleted' });
});

module.exports = router;