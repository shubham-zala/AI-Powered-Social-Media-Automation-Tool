/**
 * Migration: Update user foreign key constraints to allow deletion
 * 
 * Run: node migrations/002_update_user_constraints.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

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

        console.log('🔄 Updating foreign key constraints for users...');

        // 1. Drop and re-add approved_by constraint
        await client.query(`
            DO $$
            BEGIN
                -- Drop the existing constraint if it exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'posts_approved_by_fkey' 
                    AND table_name = 'posts'
                ) THEN
                    ALTER TABLE posts DROP CONSTRAINT posts_approved_by_fkey;
                END IF;

                -- Add it back with ON DELETE SET NULL
                ALTER TABLE posts 
                ADD CONSTRAINT posts_approved_by_fkey 
                FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
            END $$;
        `);
        console.log('✅ Updated approved_by constraint to ON DELETE SET NULL');

        // 2. Drop and re-add shortlisted_by constraint
        await client.query(`
            DO $$
            BEGIN
                -- Drop the existing constraint if it exists
                IF EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'posts_shortlisted_by_fkey' 
                    AND table_name = 'posts'
                ) THEN
                    ALTER TABLE posts DROP CONSTRAINT posts_shortlisted_by_fkey;
                END IF;

                -- Add it back with ON DELETE SET NULL
                ALTER TABLE posts 
                ADD CONSTRAINT posts_shortlisted_by_fkey 
                FOREIGN KEY (shortlisted_by) REFERENCES users(id) ON DELETE SET NULL;
            END $$;
        `);
        console.log('✅ Updated shortlisted_by constraint to ON DELETE SET NULL');

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
