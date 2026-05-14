// routes/admin/analytics.js
// ------------------------------------------------------------------
// GET /api/admin/analytics/overview      — KPI summary (single call)
// GET /api/admin/analytics/revenue       — monthly revenue breakdown
// GET /api/admin/analytics/orders        — monthly order counts + status
// GET /api/admin/analytics/products      — best-selling products
// GET /api/admin/analytics/customers     — new customers per month
// GET /api/admin/analytics/payments      — payment method breakdown
// GET /api/admin/analytics/delivery      — delivery boy performance
// GET /api/admin/analytics/export        — CSV of monthly report
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ─── helper: build month bucket keys ─────────────────────────────
function buildMonthBuckets(months) {
  const buckets = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    buckets[key] = { label, revenue: 0, orders: 0, delivered: 0, cancelled: 0, newCustomers: 0 };
  }
  return buckets;
}

function cutoffDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

// ── GET /overview ─────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  const months = parseInt(req.query.months || 6);
  const since  = cutoffDate(months);

  const [
    { data: orders },
    { data: users  },
    { count: productCount },
  ] = await Promise.all([
    supabase.from('orders').select('total, status, payment_method, created_at').gte('created_at', since),
    supabase.from('users').select('created_at').gte('created_at', since),
    supabase.from('products').select('*', { count: 'exact', head: true }),
  ]);

  const allOrders   = orders || [];
  const delivered   = allOrders.filter(o => o.status === 'Delivered');
  const cancelled   = allOrders.filter(o => o.status === 'Cancelled');
  const totalRevenue = delivered.reduce((s, o) => s + parseFloat(o.total || 0), 0);
  const avgOrder     = allOrders.length ? (totalRevenue / allOrders.length) : 0;
  const deliveryRate = allOrders.length ? ((delivered.length / allOrders.length) * 100) : 0;

  res.json({
    success: true,
    overview: {
      months,
      totalRevenue:   parseFloat(totalRevenue.toFixed(2)),
      totalOrders:    allOrders.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      avgOrderValue:  parseFloat(avgOrder.toFixed(2)),
      deliveryRate:   parseFloat(deliveryRate.toFixed(1)),
      newCustomers:   (users || []).length,
      totalProducts:  productCount || 0,
    }
  });
});

// ── GET /revenue ──────────────────────────────────────────────────
router.get('/revenue', async (req, res) => {
  const months  = parseInt(req.query.months || 6);
  const buckets = buildMonthBuckets(months);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('total, status, created_at')
    .gte('created_at', cutoffDate(months))
    .order('created_at');

  if (error) return res.status(400).json({ message: error.message });

  (orders || []).forEach(o => {
    const d   = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) return;
    buckets[key].revenue += parseFloat(o.total || 0);
    buckets[key].orders++;
    if (o.status === 'Delivered') buckets[key].delivered++;
    if (o.status === 'Cancelled') buckets[key].cancelled++;
  });

  const rows = Object.values(buckets).map(b => ({
    ...b,
    revenue:  parseFloat(b.revenue.toFixed(2)),
    avgOrder: b.orders ? parseFloat((b.revenue / b.orders).toFixed(2)) : 0,
  }));

  res.json({ success: true, months, data: rows });
});

// ── GET /orders ───────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  const months = parseInt(req.query.months || 6);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('status, payment_method, created_at')
    .gte('created_at', cutoffDate(months));

  if (error) return res.status(400).json({ message: error.message });

  const statusCount  = {};
  const paymentCount = {};
  (orders || []).forEach(o => {
    const st = o.status || 'Processing';
    statusCount[st] = (statusCount[st] || 0) + 1;
    const pm = (o.payment_method || '').toLowerCase().includes('cash')
      ? 'Cash on Delivery' : 'Online Payment';
    paymentCount[pm] = (paymentCount[pm] || 0) + 1;
  });

  res.json({
    success: true,
    statusBreakdown:  Object.entries(statusCount).map(([status, count]) => ({ status, count })),
    paymentBreakdown: Object.entries(paymentCount).map(([method, count]) => ({ method, count })),
  });
});

// ── GET /products (best sellers) ──────────────────────────────────
router.get('/products', async (req, res) => {
  const months = parseInt(req.query.months || 6);
  const topN   = parseInt(req.query.limit || 10);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('items')
    .gte('created_at', cutoffDate(months));

  if (error) return res.status(400).json({ message: error.message });

  const productSales = {};
  (orders || []).forEach(o => {
    (o.items || []).forEach(item => {
      const name = item.name || 'Unknown';
      const qty  = item.qty || item.quantity || 1;
      const rev  = parseFloat(item.price || 0) * qty;
      if (!productSales[name]) productSales[name] = { name, qty: 0, revenue: 0 };
      productSales[name].qty     += qty;
      productSales[name].revenue += rev;
    });
  });

  const sorted = Object.values(productSales)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, topN)
    .map(p => ({ ...p, revenue: parseFloat(p.revenue.toFixed(2)) }));

  res.json({ success: true, products: sorted, total: Object.keys(productSales).length });
});

// ── GET /customers ────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  const months  = parseInt(req.query.months || 6);
  const buckets = buildMonthBuckets(months);

  const { data: users, error } = await supabase
    .from('users')
    .select('created_at')
    .gte('created_at', cutoffDate(months));

  if (error) return res.status(400).json({ message: error.message });

  (users || []).forEach(u => {
    const d   = new Date(u.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (buckets[key]) buckets[key].newCustomers++;
  });

  res.json({
    success: true,
    data: Object.values(buckets).map(b => ({ label: b.label, newCustomers: b.newCustomers })),
  });
});

// ── GET /payments ─────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  const months = parseInt(req.query.months || 6);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('payment_method, total, status')
    .gte('created_at', cutoffDate(months));

  if (error) return res.status(400).json({ message: error.message });

  const map = {};
  (orders || []).forEach(o => {
    const pm = (o.payment_method || '').toLowerCase().includes('cash')
      ? 'Cash on Delivery' : 'Online Payment';
    if (!map[pm]) map[pm] = { method: pm, count: 0, revenue: 0 };
    map[pm].count++;
    if (o.status === 'Delivered') map[pm].revenue += parseFloat(o.total || 0);
  });

  res.json({
    success: true,
    payments: Object.values(map).map(p => ({ ...p, revenue: parseFloat(p.revenue.toFixed(2)) })),
  });
});

// ── GET /delivery (delivery boy performance) ──────────────────────
router.get('/delivery', async (req, res) => {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select('delivery_boy_id, delivery_status, cod_amount, delivery_boys(full_name, phone)');

  if (error) return res.status(400).json({ message: error.message });

  const perfMap = {};
  (data || []).forEach(a => {
    const id   = a.delivery_boy_id;
    const name = a.delivery_boys?.full_name || 'Unknown';
    if (!perfMap[id]) {
      perfMap[id] = { id, name, phone: a.delivery_boys?.phone, total: 0, delivered: 0, failed: 0, codCollected: 0 };
    }
    perfMap[id].total++;
    if (a.delivery_status === 'Delivered')       perfMap[id].delivered++;
    if (a.delivery_status === 'Failed Delivery') perfMap[id].failed++;
    if (a.delivery_status === 'Delivered')       perfMap[id].codCollected += parseFloat(a.cod_amount || 0);
  });

  const performance = Object.values(perfMap).map(p => ({
    ...p,
    successRate:  p.total ? parseFloat(((p.delivered / p.total) * 100).toFixed(1)) : 0,
    codCollected: parseFloat(p.codCollected.toFixed(2)),
  })).sort((a, b) => b.delivered - a.delivered);

  res.json({ success: true, performance });
});

// ── GET /export (CSV of monthly report) ──────────────────────────
router.get('/export', async (req, res) => {
  const months  = parseInt(req.query.months || 6);
  const buckets = buildMonthBuckets(months);

  const { data: orders } = await supabase
    .from('orders')
    .select('total, status, created_at')
    .gte('created_at', cutoffDate(months));

  (orders || []).forEach(o => {
    const d   = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!buckets[key]) return;
    buckets[key].revenue += parseFloat(o.total || 0);
    buckets[key].orders++;
    if (o.status === 'Delivered') buckets[key].delivered++;
    if (o.status === 'Cancelled') buckets[key].cancelled++;
  });

  const rows  = Object.values(buckets);
  const header = ['Month','Orders','Revenue (₹)','Delivered','Cancelled','Avg Order Value (₹)'];
  const csvRows = rows.map(b => {
    const avg = b.orders ? (b.revenue / b.orders).toFixed(2) : '0.00';
    return [b.label, b.orders, b.revenue.toFixed(2), b.delivered, b.cancelled, avg]
      .map(v => `"${v}"`).join(',');
  });

  const csv = [header.join(','), ...csvRows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="analytics_${months}m.csv"`);
  res.send(csv);
});

module.exports = router;