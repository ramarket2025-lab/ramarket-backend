const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────
app.get('/', (req, res) => res.send('RA Market API Running 🚀'));

// ── Customer App Routes ───────────────────────────────────────────
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/products',    require('./routes/products'));
app.use('/api/categories',  require('./routes/categories'));   // FIX: was missing
app.use('/api/farmers',     require('./routes/farmers'));      // FIX: was missing
app.use('/api/hero-slides', require('./routes/heroSlides'));   // FIX: was missing
app.use('/api/cart',        require('./routes/cart'));
app.use('/api/addresses',   require('./routes/addresses'));    // FIX: was missing
app.use('/api/coupons',     require('./routes/coupons'));      // FIX: was missing
app.use('/api/orders',      require('./routes/orderRoutes'));
app.use('/api/users',       require('./routes/users'));

// ── Delivery App Routes ───────────────────────────────────────────
app.use('/api/delivery',    require('./routes/delivery'));     // FIX: was missing

// ── Admin Panel Routes ────────────────────────────────────────────
app.use('/api/admin/auth',          require('./routes/admin/adminAuth'));
app.use('/api/admin/dashboard',     require('./routes/admin/dashboard'));
app.use('/api/admin/categories',    require('./routes/admin/categories'));
app.use('/api/admin/products',      require('./routes/admin/products'));
app.use('/api/admin/farmers',       require('./routes/admin/farmers'));
app.use('/api/admin/orders',        require('./routes/admin/orders'));
app.use('/api/admin/hero-slides',   require('./routes/admin/heroSlides'));
app.use('/api/admin/coupons',       require('./routes/admin/coupons'));
app.use('/api/admin/customers',     require('./routes/admin/customers'));
app.use('/api/admin/analytics',     require('./routes/admin/analytics'));
app.use('/api/admin/delivery-boys', require('./routes/admin/deliveryBoys'));
app.use('/api/admin/wallets',       require('./routes/admin/wallets'));
app.use('/api/admin/policies',      require('./routes/admin/policies'));
app.use('/api/admin/upload',        require('./routes/admin/upload'));
app.use('/api/admin/notifications', require('./routes/admin/notifications'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
