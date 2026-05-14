// routes/admin/products.js
// ------------------------------------------------------------------
// GET    /api/admin/products            — list with pagination + search
// GET    /api/admin/products/:id        — single product
// POST   /api/admin/products            — create
// PUT    /api/admin/products/:id        — update
// DELETE /api/admin/products/:id        — delete
// PATCH  /api/admin/products/:id/stock  — update stock only
// GET    /api/admin/products/low-stock  — items below threshold
// ------------------------------------------------------------------

const express   = require('express');
const router    = express.Router();
const supabase  = require('../../supabase');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

// ── GET all (paginated + searchable) ─────────────────────────────
router.get('/', async (req, res) => {
  const {
    page      = 1,
    limit     = 10,
    search    = '',
    category  = '',
    type      = '',
    sort      = 'id',
    order     = 'asc',
  } = req.query;

  const from = (parseInt(page) - 1) * parseInt(limit);
  const to   = from + parseInt(limit) - 1;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });

  if (search)   query = query.ilike('name', `%${search}%`);
  if (category) query = query.eq('category', category);
  if (type)     query = query.eq('product_type', type);

  const allowedSorts = ['id','name','price','stock','created_at'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'id';
  query = query.order(sortCol, { ascending: order !== 'desc' }).range(from, to);

  const { data, count, error } = await query;
  if (error) return res.status(400).json({ message: error.message });

  res.json({
    success:    true,
    products:   data,
    total:      count,
    page:       parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit)),
  });
});

// ── GET low-stock (must be before /:id) ──────────────────────────
router.get('/low-stock', async (req, res) => {
  const threshold = parseInt(req.query.threshold || 10);

  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock, category, image')
    .lt('stock', threshold)
    .order('stock');

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, products: data, total: data.length });
});

// ── GET single ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: 'Product not found' });
  res.json({ success: true, product: data });
});

// ── POST create ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    name, price, unit, category, description,
    stock, images, image, farmer_id, product_type,
    key_features, about_product, health_benefits, cooking_instructions,
  } = req.body;

  if (!name || !price || !unit || !category) {
    return res.status(400).json({ message: 'name, price, unit and category are required' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name, price, unit, category, description,
      stock: stock ?? 100,
      images: images || [],
      image:  image  || (images && images[0]) || '',
      farmer_id:            farmer_id            || null,
      product_type:         product_type         || null,
      key_features:         key_features         || [],
      about_product:        about_product        || '',
      health_benefits:      health_benefits      || [],
      cooking_instructions: cooking_instructions || [],
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.status(201).json({ success: true, product: data });
});

// ── PUT full update ───────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const allowed = [
    'name','price','unit','category','description','stock',
    'images','image','farmer_id','product_type',
    'key_features','about_product','health_benefits','cooking_instructions',
  ];

  const updates = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, product: data });
});

// ── PATCH stock only ─────────────────────────────────────────────
router.patch('/:id/stock', async (req, res) => {
  const { stock } = req.body;
  if (stock === undefined) return res.status(400).json({ message: 'stock is required' });

  const { data, error } = await supabase
    .from('products')
    .update({ stock: parseInt(stock) })
    .eq('id', req.params.id)
    .select('id, name, stock')
    .single();

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, product: data });
});

// ── DELETE ────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ message: error.message });
  res.json({ success: true, message: 'Product deleted' });
});

module.exports = router;