require('./services/logger'); // Initialize logger (captures console)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db');
const app = express();
const port = process.env.PORT || 3000;

const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/authRoutes');
const { authenticate } = require('./middleware/auth');

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json()); // Built-in body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Health Check (public)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Routes (public - no token required for login)
app.use('/api/auth', authRoutes);

// Apply authentication to all other /api/* routes
app.use('/api', authenticate, apiRoutes);

// Test DB Connection
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
