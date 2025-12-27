const { Pool } = require('pg');

function createPool() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionString: process.env.DATABASE_URL,
    max: process.env.DB_MAX ? Number(process.env.DB_MAX) : 10,
  });
  return pool;
}

async function waitForDb(pool, { attempts = 30, delayMs = 500 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('SELECT 1 AS ok');
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr || new Error('Database not ready');
}

module.exports = { createPool, waitForDb };
