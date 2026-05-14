// routes/admin/notifications.js
// ------------------------------------------------------------------
// POST /api/admin/notifications/broadcast     — send to all customers
// POST /api/admin/notifications/order/:id     — send order status update
// POST /api/admin/notifications/delivery/:id  — notify delivery boy
// GET  /api/admin/notifications/logs          — recent notification logs
// ------------------------------------------------------------------
// This module stores FCM push tokens in a 'push_tokens' table and
// sends notifications via Firebase Cloud Messaging REST API.
// Requires FIREBASE_SERVER_KEY in .env
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';
const FCM_KEY = process.env.FIREBASE_SERVER_KEY;

// ─── helper: send one FCM message ────────────────────────────────
async function sendFCM(tokens, title, body, data = {}) {
  if (!FCM_KEY) {
    console.warn('FIREBASE_SERVER_KEY not set — notification skipped');
    return { skipped: true };
  }
  if (!tokens || !tokens.length) return { skipped: true, reason: 'no tokens' };

  const payload = {
    registration_ids: tokens,
    notification: { title, body, sound: 'default' },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    priority: 'high',
  };

  const response = await fetch(FCM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${FCM_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// ─── helper: log notification ─────────────────────────────────────
async function logNotification(type, title, body, targetCount) {
  await supabase.from('notification_logs').insert([{
    type, title, body, target_count: targetCount, sent_at: new Date().toISOString()
  }]).select();
}

// ── POST broadcast ────────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
  const { title, body, data = {} } = req.body;
  if (!title || !body) return res.status(400).json({ message: 'title and body are required' });

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('role', 'customer');

  const tokenList = (tokens || []).map(t => t.token).filter(Boolean);
  const result    = await sendFCM(tokenList, title, body, data);

  await logNotification('broadcast', title, body, tokenList.length);
  res.json({ success: true, sent: tokenList.length, fcmResult: result });
});

// ── POST order status notification ───────────────────────────────
router.post('/order/:id', async (req, res) => {
  const { status, message } = req.body;
  const orderId = req.params.id;

  // Fetch order customer phone
  const { data: order } = await supabase
    .from('orders')
    .select('user_phone, status')
    .eq('id', orderId)
    .single();

  if (!order) return res.status(404).json({ message: 'Order not found' });

  const { data: tokenRow } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('phone', order.user_phone)
    .maybeSingle();

  const title = `Order #${orderId} Update`;
  const body  = message || `Your order status has been updated to: ${status || order.status}`;

  const result = await sendFCM(
    tokenRow?.token ? [tokenRow.token] : [],
    title, body,
    { orderId: String(orderId), status: status || order.status }
  );

  await logNotification('order_update', title, body, 1);
  res.json({ success: true, fcmResult: result });
});

// ── POST delivery boy notification ────────────────────────────────
router.post('/delivery/:id', async (req, res) => {
  const { title, body, data = {} } = req.body;
  const boyId = req.params.id;

  const { data: boy } = await supabase
    .from('delivery_boys')
    .select('phone, full_name')
    .eq('id', boyId)
    .single();

  if (!boy) return res.status(404).json({ message: 'Delivery boy not found' });

  const { data: tokenRow } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('phone', boy.phone)
    .eq('role', 'delivery')
    .maybeSingle();

  const notifTitle = title || 'New Assignment';
  const notifBody  = body  || `Hello ${boy.full_name}, you have a new delivery assignment.`;

  const result = await sendFCM(
    tokenRow?.token ? [tokenRow.token] : [],
    notifTitle, notifBody,
    { deliveryBoyId: String(boyId), ...data }
  );

  await logNotification('delivery_boy', notifTitle, notifBody, 1);
  res.json({ success: true, fcmResult: result });
});

// ── GET notification logs ─────────────────────────────────────────
router.get('/logs', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);

  const { data, count, error } = await supabase
    .from('notification_logs')
    .select('*', { count: 'exact' })
    .order('sent_at', { ascending: false })
    .range(from, from + parseInt(limit) - 1);

  if (error) return res.status(400).json({ message: error.message });
  res.json({
    success:    true,
    logs:       data,
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
  });
});

module.exports = router;