// routes/admin/dashboard.js
// ------------------------------------------------------------------
// GET /api/admin/dashboard/stats   — all KPI counts in one call
// GET /api/admin/dashboard/recent  — last 10 orders + recent customers
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET /api/admin/dashboard/stats ────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      { count: categories },
      { count: products },
      { count: farmers },
      { count: orders },
      { count: customers },
      { count: deliveryBoys },
      { count: pendingDeliveryBoys },
      { count: coupons },
      revenueResult,
    ] = await Promise.all([
      supabase.from('categories').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('farmers').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('delivery_boys').select('*', { count: 'exact', head: true }).eq('status', 'Approved'),
      supabase.from('delivery_boys').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('orders').select('total').eq('status', 'Delivered'),
    ]);

    const totalRevenue = (revenueResult.data || []).reduce(
      (sum, o) => sum + parseFloat(o.total || 0), 0
    );

    res.json({
      success: true,
      stats: {
        categories:           categories || 0,
        products:             products   || 0,
        farmers:              farmers    || 0,
        orders:               orders     || 0,
        customers:            customers  || 0,
        deliveryBoys:         deliveryBoys || 0,
        pendingDeliveryBoys:  pendingDeliveryBoys || 0,
        activeCoupons:        coupons    || 0,
        totalRevenue:         parseFloat(totalRevenue.toFixed(2)),
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/admin/dashboard/recent ───────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const [{ data: orders }, { data: customers }] = await Promise.all([
      supabase
        .from('orders')
        .select('id, user_phone, total, status, date, created_at, payment_method')
        .order('id', { ascending: false })
        .limit(10),
      supabase
        .from('users')
        .select('id, phone, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    res.json({ success: true, recentOrders: orders || [], recentCustomers: customers || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;