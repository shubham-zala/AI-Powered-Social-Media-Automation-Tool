const jwt = require('jsonwebtoken');
const pool = require('../db');

/**
 * Middleware: Verify JWT token and attach user to request
 * Extracts token from Authorization: Bearer <token> header
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists and is active
        const result = await pool.query(
            'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication error' });
    }
};

/**
 * Middleware: Check if user has one of the allowed roles
 * Must be used AFTER authenticate middleware
 * 
 * Usage: authorize('admin', 'approver')
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

module.exports = { authenticate, authorize };
