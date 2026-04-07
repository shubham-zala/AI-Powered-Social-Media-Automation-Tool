/**
 * Migration: Create users table + update posts table for multi-stage workflow
 * 
 * Run: node migrations/001_create_users_table.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'approver', 'user')),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ Created users table');

        // 2. Seed default Admin user
        const hashedPassword = await bcrypt.hash('Admin@123', 10);
        await client.query(`
            INSERT INTO users (name, email, password_hash, role)
            VALUES ('Admin', 'admin@miraclesfintech.com', $1, 'admin')
            ON CONFLICT (email) DO NOTHING;
        `, [hashedPassword]);
        console.log('✅ Seeded default admin user (admin@miraclesfintech.com / Admin@123)');

        // 3. Add shortlisted_by and approved_by columns to posts table
        // Use DO block to check if columns exist before adding
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'shortlisted_by') THEN
                    ALTER TABLE posts ADD COLUMN shortlisted_by INTEGER REFERENCES users(id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'approved_by') THEN
                    ALTER TABLE posts ADD COLUMN approved_by INTEGER REFERENCES users(id);
                END IF;
            END $$;
        `);
        console.log('✅ Added shortlisted_by and approved_by columns to posts');

        // 4. Update status constraint to include 'shortlisted'
        // Drop old constraint if exists and create new one
        await client.query(`
            DO $$
            BEGIN
                -- Try to drop old constraint (may not exist or have different name)
                BEGIN
                    ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
                EXCEPTION WHEN undefined_object THEN
                    -- Constraint doesn't exist, that's fine
                END;
                
                -- Add new constraint allowing shortlisted
                BEGIN
                    ALTER TABLE posts ADD CONSTRAINT posts_status_check 
                        CHECK (status IN ('pending', 'shortlisted', 'approved', 'rejected', 'posted'));
                EXCEPTION WHEN duplicate_object THEN
                    -- Constraint already exists
                END;
            END $$;
        `);
        console.log('✅ Updated status constraint to include shortlisted');

        await client.query('COMMIT');
        console.log('\n🎉 Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
