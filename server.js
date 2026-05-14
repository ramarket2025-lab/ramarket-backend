const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Existing routes ──────────────────────────────────────────
app.use('/api/auth',     require('./routes/authRoutes'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/orders',   require('./routes/orderRoutes'));
app.use('/api/users',    require('./routes/users'));

// ── Admin routes (new) ───────────────────────────────────────
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

app.get('/', (req, res) => res.send('RA Market API Running 🚀'));

app.listen(5000, () => console.log('Server running on port 5000 🚀'));