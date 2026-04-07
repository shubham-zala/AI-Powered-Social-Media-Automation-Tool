require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME, // Ensure this DB exists first
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const createTables = async () => {
  try {
    // Create sources table
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
    console.log('Created sources table');

    // Create posts table
    await pool.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id SERIAL PRIMARY KEY,
                source_id INT REFERENCES sources(id) ON DELETE CASCADE,
                original_title VARCHAR(500) NOT NULL,
                original_link VARCHAR(500) UNIQUE NOT NULL,
                original_content TEXT, -- Full scraped content
                ai_summary TEXT,       -- AI generated summary
                relevance_score INT,   -- 0-10 score
                generated_title VARCHAR(255),
                generated_description TEXT,
                generated_content TEXT,
                hashtags VARCHAR(255),
                image_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'posted')),
                twitter_id VARCHAR(100),
                posted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
    `);
    console.log('Created posts table');

    // Create settings table (for current template etc)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      );
    `);
    console.log('Created settings table');

    console.log('Database initialization complete');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
};

createTables();
