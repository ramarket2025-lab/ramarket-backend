// routes/admin/orders.js
// ------------------------------------------------------------------
// GET    /api/admin/orders                     — list (paginated, filtered)
// GET    /api/admin/orders/export              — CSV export
// GET    /api/admin/orders/:id                 — single order detail
// PUT    /api/admin/orders/:id/status          — update status
// PUT    /api/admin/orders/:id/tracking        — set tracking info
// PUT    /api/admin/orders/:id/assign          — assign delivery boy
// GET    /api/admin/orders/:id/invoice         — invoice data (for PDF)
// DELETE /api/admin/orders/:id                 — cancel/delete order
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

const VALID_STATUSES = ['Processing','Confirmed','Packed','Shipped','Delivered','Cancelled'];

// ── GET all orders (paginated + filtered) ────────────────────────
router.get('/', async (req, res) => {
  const {
    page    = 1,
    limit   = 15,
    status  = '',
    payment = '',
    search  = '',
    from    = '',
    to      = '',
    sort    = 'id',
    order   = 'desc',
  } = req.query;

  const start = (parseInt(page) - 1) * parseInt(limit);
  const end   = start + parseInt(limit) - 1;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' });

  if (status)  query = query.eq('status', status);
  if (payment) query = query.ilike('payment_method', `%${payment}%`);
  if (search)  query = query.or(`user_phone.ilike.%${search}%,id::text.ilike.%${search}%`);
  if (from)    query = query.gte('created_at', from);
  if (to)      query = query.lte('created_at', to);

  const allowedSorts = ['id','total','created_at','status'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'id';
  query = query.order(sortCol, { ascending: order !== 'desc' }).range(start, end);

  const { data, count, error } = await query;
  if (error) return res.status(400).json({ message: error.message });

  res.json({
    success:    true,
    orders:     data,
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
  });
});

// ── GET export CSV (all orders matching filters) ──────────────────
router.get('/export', async (req, res) => {
  const { status = '', from = '', to = '' } = req.query;

  let query = supabase
    .from('orders')
    .select('id, user_phone, total, status, payment_method, date, created_at, tracking_id, courier')
    .order('id', { ascending: false });

  if (status) query = query.eq('status', status);
  if (from)   query = query.gte('created_at', from);
  if (to)     query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) return res.status(400).json({ message: error.message });

  const headers = ['Order ID','Phone','Total','Status','Payment','Date','Tracking','Courier'];
  const rows = data.map(o => [
    o.id, o.user_phone, o.total, o.status,
    o.payment_method, o.date || o.created_at,
    o.tracking_id || '', o.courier || '',
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send(csv);
});

// ── GET single order ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Order not found' });

  // Fetch assignment if any
  const { data: assignment } = await supabase
    .from('delivery_assignments')
    .select('*, delivery_boys(full_name, phone)')
    .eq('order_id', req.params.id)
    .maybeSingle();

  res.json({ success: true, order: data, assignment: assignment || null });
});

// ── PUT update order status ───────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status, last_update: new Date().toLocaleString('en-IN') })
    .eq('id', req.params.id)
    .select('id, status')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, order: data });
});

// ── PUT set tracking info ─────────────────────────────────────────
router.put('/:id/tracking', async (req, res) => {
  const { tracking_id, courier, status } = req.body;

  const updates = {
    last_update: new Date().toLocaleString('en-IN'),
  };
  if (tracking_id !== undefined) updates.tracking_id  = tracking_id;
  if (courier     !== undefined) updates.courier      = courier;
  if (status && VALID_STATUSES.includes(status)) updates.status = status;

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, status, tracking_id, courier')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, order: data });
});

// ── PUT assign delivery boy ───────────────────────────────────────
router.put('/:id/assign', async (req, res) => {
  const { delivery_boy_id, cod_amount } = req.body;

  if (!delivery_boy_id) {
    return res.status(400).json({ message: 'delivery_boy_id is required' });
  }

  // Upsert assignment
  const { data: existing } = await supabase
    .from('delivery_assignments')
    .select('id')
    .eq('order_id', req.params.id)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase
      .from('delivery_assignments')
      .update({
        delivery_boy_id,
        cod_amount: cod_amount || 0,
        delivery_status: 'Assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('order_id', req.params.id));
  } else {
    ({ error } = await supabase
      .from('delivery_assignments')
      .insert([{
        order_id: parseInt(req.params.id),
        delivery_boy_id,
        cod_amount: cod_amount || 0,
        delivery_status: 'Assigned',
      }]));
  }

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Delivery boy assigned successfully' });
});

// ── GET invoice data ─────────────────────────────────────────────
router.get('/:id/invoice', async (req, res) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Order not found' });

  const items = order.items || [];
  const subtotal = order.subtotal !== undefined
    ? parseFloat(order.subtotal)
    : items.reduce((s, i) => s + parseFloat(i.price || 0) * (i.qty || i.quantity || 1), 0);
  const discount = parseFloat(order.discount || 0);
  const total    = order.total !== undefined ? parseFloat(order.total) : (subtotal - discount);

  res.json({
    success: true,
    invoice: {
      orderId:    order.id,
      date:       order.date || order.created_at,
      status:     order.status,
      customer:   order.address || {},
      items,
      subtotal,
      discount,
      total,
      payment: {
        method:    order.payment_method || order.paymentMethod,
        status:    order.payment_status || order.paymentStatus,
        paymentId: order.payment_id     || order.paymentId,
      },
      tracking: {
        trackingId: order.tracking_id || order.trackingId,
        courier:    order.courier,
      },
    }
  });
});

// ── DELETE order ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Order deleted' });
});

module.exports = router;