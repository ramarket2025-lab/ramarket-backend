const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('API Running 🚀');
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/users'));
// Server
app.listen(5000, () => console.log('Server running on port 5000 🚀'));