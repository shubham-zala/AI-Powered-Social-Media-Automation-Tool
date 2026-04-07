require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client, Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
};
const targetDbName = process.env.DB_NAME;

async function setupDatabase() {
    console.log('🚀 Starting Database Initialization...\n');

    // STEP 1: Connect to default 'postgres' database to create the new database
    const initialClient = new Client({ ...dbConfig, database: 'postgres' });
    try {
        await initialClient.connect();
        const res = await initialClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDbName]);
        if (res.rowCount === 0) {
            console.log(`[1/4] Creating database "${targetDbName}"...`);
            // CREATE DATABASE cannot run inside a parameter binding block safely in pg, so we construct it.
            await initialClient.query(`CREATE DATABASE "${targetDbName}"`);
            console.log(`✅ Database "${targetDbName}" created successfully.`);
        } else {
            console.log(`[1/4] Database "${targetDbName}" already exists.`);
        }
    } catch (err) {
        console.error('❌ Error creating database:', err.message);
        process.exit(1);
    } finally {
        await initialClient.end();
    }

    // STEP 2: Connect to the target database to establish tables
    const pool = new Pool({ ...dbConfig, database: targetDbName });

    try {
        console.log('\n[2/4] Ensuring tables exist...');

        // 1. users table
        await pool.query(`
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
        console.log('  -> users table ready');

        // 2. sources table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sources (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                url VARCHAR(500) NOT NULL,
                type VARCHAR(50) DEFAULT 'rss' CHECK (type IN ('rss', 'scraper', 'twitter')),
                reliability_score INT DEFAULT 5,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('  -> sources table ready');

        // 3. posts table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                source_id INT REFERENCES sources(id) ON DELETE CASCADE,
                original_title VARCHAR(500) NOT NULL,
                original_link VARCHAR(500) UNIQUE NOT NULL,
                original_content TEXT,
                ai_summary TEXT,
                relevance_score INT,
                generated_title VARCHAR(255),
                generated_description TEXT,
                generated_content TEXT,
                hashtags VARCHAR(255),
                image_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted', 'shortlisted')),
                twitter_id VARCHAR(100),
                platform_links JSONB DEFAULT '{}'::jsonb,
                shortlisted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                posted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('  -> posts table ready');

        // 4. settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT
            );
        `);
        console.log('  -> settings table ready');


        // STEP 3: Seed Default Users (4 entries)
        console.log('\n[3/4] Seeding default users...');
        const usersToSeed = [
            { name: 'Admin', email: 'admin@miraclesfintech.com', password: 'Admin@123', role: 'admin' }
        ];

        for (const u of usersToSeed) {
            const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [u.email]);
            if (exists.rowCount > 0) {
                console.log(`  ⏭️  Skipping: ${u.role} "${u.email}" already exists.`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(u.password, 10);
            await pool.query(
                'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                [u.name, u.email, hashedPassword, u.role]
            );
            console.log(`  ✅ Inserted ${u.role}: ${u.email} (Password: ${u.password})`);
        }

        console.log('\n[4/4] Database setup complete!');
        console.log('🎉 You are ready to start the application.');

    } catch (err) {
        console.error('\n❌ Setup failed during table creation/seeding:', err);
    } finally {
        await pool.end();
    }
}

setupDatabase();
