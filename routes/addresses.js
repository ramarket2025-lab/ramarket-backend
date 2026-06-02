const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/addresses?phone=9876543210 — list user's addresses
router.get('/', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ message: "phone required" });

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('phone', phone)
    .order('is_default', { ascending: false });

  if (error) return res.status(400).json(error);
  res.json(data);
});

// POST /api/addresses — add new address
router.post('/', async (req, res) => {
  const {
    phone, label,
    full_name, receiver_phone,
    address, house_no, apartment, landmark,
    city, state, pincode,
    is_default
  } = req.body;

  // Required fields validation
  if (!phone)         return res.status(400).json({ message: "phone required" });
  if (!full_name)     return res.status(400).json({ message: "full_name (receiver name) required" });
  if (!receiver_phone) return res.status(400).json({ message: "receiver_phone required" });
  if (!house_no)      return res.status(400).json({ message: "house_no required" });
  if (!city)          return res.status(400).json({ message: "city required" });
  if (!state)         return res.status(400).json({ message: "state required" });
  if (!pincode)       return res.status(400).json({ message: "pincode required" });
  if (!/^\d{6}$/.test(pincode))
                      return res.status(400).json({ message: "pincode must be 6 digits" });
  if (!/^\d{10}$/.test(receiver_phone))
                      return res.status(400).json({ message: "receiver_phone must be 10 digits" });

  const { data, error } = await supabase
    .from('addresses')
    .insert([{
      phone,
      label          : label || 'Home',
      full_name,
      receiver_phone,
      address        : address || '',
      house_no,
      apartment      : apartment || '',
      landmark       : landmark || '',
      city,
      state,
      pincode,
      is_default     : is_default || false
    }])
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// PUT /api/addresses/:id — update address
router.put('/:id', async (req, res) => {
  const {
    label, full_name, receiver_phone,
    address, house_no, apartment, landmark,
    city, state, pincode
  } = req.body;

  // Build update object only with provided fields
  const updates = {};
  if (label          !== undefined) updates.label           = label;
  if (full_name      !== undefined) updates.full_name       = full_name;
  if (receiver_phone !== undefined) {
    if (!/^\d{10}$/.test(receiver_phone))
      return res.status(400).json({ message: "receiver_phone must be 10 digits" });
    updates.receiver_phone = receiver_phone;
  }
  if (address        !== undefined) updates.address         = address;
  if (house_no       !== undefined) updates.house_no        = house_no;
  if (apartment      !== undefined) updates.apartment       = apartment;
  if (landmark       !== undefined) updates.landmark        = landmark;
  if (city           !== undefined) updates.city            = city;
  if (state          !== undefined) updates.state           = state;
  if (pincode        !== undefined) {
    if (!/^\d{6}$/.test(pincode))
      return res.status(400).json({ message: "pincode must be 6 digits" });
    updates.pincode = pincode;
  }

  const { data, error } = await supabase
    .from('addresses')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// PATCH /api/addresses/:id/default — set as default (clears others for same phone)
router.patch('/:id/default', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "phone required" });

  // Clear default from all user addresses
  await supabase.from('addresses').update({ is_default: false }).eq('phone', phone);

  // Set new default
  const { data, error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json(error);
  res.json({ success: true, address: data });
});

// DELETE /api/addresses/:id — delete address
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json(error);
  res.json({ success: true });
});

module.exports = router;
