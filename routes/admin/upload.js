// routes/admin/upload.js
// ------------------------------------------------------------------
// POST /api/admin/upload/image   — upload image to Supabase Storage
//   Body: multipart/form-data
//     file   — the image file
//     folder — optional subfolder: 'products' | 'farmers' | 'hero' | 'categories'
//
// Returns: { success, url }
// ------------------------------------------------------------------

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const supabase   = require('../../supabase');
const adminAuth  = require('../../middleware/adminAuth');

router.use(adminAuth);

const BUCKET    = 'market-images';
const MAX_SIZE  = 5 * 1024 * 1024;  // 5 MB
const FOLDERS   = ['products','farmers','hero','categories','general'];

// Use memory storage — stream the buffer directly to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── POST /api/admin/upload/image ──────────────────────────────────
router.post('/image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided' });

  const folder  = FOLDERS.includes(req.body.folder) ? req.body.folder : 'general';
  const ext     = req.file.originalname.split('.').pop().toLowerCase();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

  if (uploadError) return res.status(400).json({ message: uploadError.message });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

  res.status(201).json({ success: true, url: data.publicUrl, fileName });
});

// ── DELETE /api/admin/upload/image ───────────────────────────────
// Body: { fileName } — the path returned from upload (e.g. 'products/123.jpg')
router.delete('/image', async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) return res.status(400).json({ message: 'fileName is required' });

  const { error } = await supabase.storage.from(BUCKET).remove([fileName]);
  if (error) return res.status(400).json({ message: error.message });

  res.json({ success: true, message: 'Image deleted' });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File is too large. Max 5 MB.' });
  }
  res.status(400).json({ message: err.message });
});

module.exports = router;