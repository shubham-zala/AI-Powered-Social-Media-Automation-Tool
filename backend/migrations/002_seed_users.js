/**
 * Seed script: Create demo user and approver accounts
 * Run once: node migrations/002_seed_users.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

const seedUsers = async () => {
    try {
        const users = [
            { name: 'Demo User', email: 'user@miraclesfintech.com', password: 'User@123', role: 'user' },
            { name: 'Demo Approver', email: 'approver@miraclesfintech.com', password: 'Approver@123', role: 'approver' },
        ];

        for (const u of users) {
            // Skip if already exists
            const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [u.email]);
            if (exists.rowCount > 0) {
                console.log(`⏭️  ${u.role} "${u.email}" already exists, skipping.`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(u.password, 10);
            await pool.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                [u.name, u.email, hashedPassword, u.role]
            );
            console.log(`✅ Created ${u.role}: ${u.email} / ${u.password}`);
        }

        console.log('\n🎉 Seed complete!');
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await pool.end();
    }
};

seedUsers();
