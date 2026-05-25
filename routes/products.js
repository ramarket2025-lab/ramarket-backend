const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/products — list all products (with optional category filter & search)
router.get('/', async (req, res) => {
  const { category, search } = req.query;

  let query = supabase.from('products').select('*');
  if (category) query = query.eq('category', category);
  if (search)   query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return res.status(400).json(error);
  res.json(data);
});

// GET /api/products/:id — single product
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ message: "Product not found" });
  res.json(data);
});

module.exports = router;