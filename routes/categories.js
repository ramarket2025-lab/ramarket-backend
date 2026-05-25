const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// GET /api/categories — list all categories
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id');

  if (error) return res.status(400).json(error);
  res.json(data);
});

module.exports = router;