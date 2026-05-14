// routes/admin/customers.js
// ------------------------------------------------------------------
// GET    /api/admin/customers               — list (paginated, searchable)
// GET    /api/admin/customers/:phone        — single customer + orders + addresses
// PATCH  /api/admin/customers/:phone/block  — block customer
// PATCH  /api/admin/customers/:phone/unblock— unblock customer
// GET    /api/admin/customers/:phone/orders — order history
// DELETE /api/admin/customers/:phone        — delete customer account
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all customers (built from orders + users tables) ─────────
router.get('/', async (req, res) => {
  const {
    page   = 1,
    limit  = 20,
    search = '',
    status = '',   // 'active' | 'blocked'
  } = req.query;

  try {
    // Pull all users
    let userQuery = supabase
      .from('users')
      .select('id, phone, full_name, profile_pic, is_blocked, blocked_reason, created_at');

    if (search) {
      userQuery = userQuery.or(`phone.ilike.%${search}%,full_name.ilike.%${search}%`);
    }
    if (status === 'blocked') userQuery = userQuery.eq('is_blocked', true);
    if (status === 'active')  userQuery = userQuery.eq('is_blocked', false);

    const { data: users, error: userErr } = await userQuery.order('created_at', { ascending: false });
    if (userErr) throw userErr;

    // Aggregate order stats per phone
    const { data: orderStats, error: orderErr } = await supabase
      .from('orders')
      .select('user_phone, total');
    if (orderErr) throw orderErr;

    const statsMap = {};
    (orderStats || []).forEach(o => {
      const p = o.user_phone;
      if (!p) return;
      if (!statsMap[p]) statsMap[p] = { orderCount: 0, totalSpent: 0 };
      statsMap[p].orderCount++;
      statsMap[p].totalSpent += parseFloat(o.total || 0);
    });

    const enriched = (users || []).map(u => ({
      ...u,
      orderCount: statsMap[u.phone]?.orderCount || 0,
      totalSpent: statsMap[u.phone]?.totalSpent || 0,
    }));

    // Manual pagination (already filtered above)
    const from  = (parseInt(page) - 1) * parseInt(limit);
    const slice = enriched.slice(from, from + parseInt(limit));

    res.json({
      success:    true,
      customers:  slice,
      total:      enriched.length,
      page:       parseInt(page),
      totalPages: Math.ceil(enriched.length / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET single customer ───────────────────────────────────────────
router.get('/:phone', async (req, res) => {
  const { phone } = req.params;

  const [
    { data: user  },
    { data: orders },
    { data: addresses },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('phone', phone).maybeSingle(),
    supabase.from('orders').select('id,date,total,status,created_at').eq('user_phone', phone).order('id', { ascending: false }).limit(20),
    supabase.from('addresses').select('*').eq('phone', phone),
  ]);

  const orderCount = (orders || []).length;
  const totalSpent = (orders || []).reduce((s, o) => s + parseFloat(o.total || 0), 0);

  res.json({
    success: true,
    customer: { ...(user || { phone }), orderCount, totalSpent },
    orders: orders || [],
    addresses: addresses || [],
  });
});

// ── GET order history ─────────────────────────────────────────────
router.get('/:phone/orders', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);

  const { data, count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('user_phone', req.params.phone)
    .order('id', { ascending: false })
    .range(from, from + parseInt(limit) - 1);

  if (error) return res.status(400).json({ message: error.message });
  res.json({
    success: true,
    orders: data,
    total: count,
    page: parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
  });
});

// ── PATCH block ───────────────────────────────────────────────────
router.patch('/:phone/block', async (req, res) => {
  const { reason = 'Blocked by admin' } = req.body;

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('phone', req.params.phone)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('users')
      .update({ is_blocked: true, blocked_reason: reason })
      .eq('phone', req.params.phone));
  } else {
    ({ error } = await supabase
      .from('users')
      .insert([{ phone: req.params.phone, is_blocked: true, blocked_reason: reason }]));
  }

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Customer blocked' });
});

// ── PATCH unblock ─────────────────────────────────────────────────
router.patch('/:phone/unblock', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .update({ is_blocked: false, blocked_reason: null })
    .eq('phone', req.params.phone);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Customer unblocked' });
});

// ── DELETE customer ───────────────────────────────────────────────
router.delete('/:phone', async (req, res) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('phone', req.params.phone);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Customer account deleted' });
});

module.exports = router;