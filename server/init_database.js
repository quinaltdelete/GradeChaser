require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        area TEXT,
        sub_area TEXT,
        country TEXT,
        book_grade TEXT, 
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS route_relationships (
        id SERIAL PRIMARY KEY,
        easier_route_id INT REFERENCES routes(id) ON DELETE CASCADE,
        harder_route_id INT REFERENCES routes(id) ON DELETE CASCADE,
        weight INT DEFAULT 1,  -- Number of confirmations
        UNIQUE (easier_route_id, harder_route_id)  -- Prevent duplicate edges
      );

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_votes (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        easier_route_id INT REFERENCES routes(id) ON DELETE CASCADE,
        harder_route_id INT REFERENCES routes(id) ON DELETE CASCADE,
        UNIQUE (user_id, easier_route_id, harder_route_id)  -- Prevent duplicate votes
      );
    `);

    console.log("Tables created successfully.");
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    pool.end();
  }
};

createTables();
