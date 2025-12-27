const { Pool } = require('pg');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl });
  }

  const host = requireEnv('DB_HOST');
  const port = Number(process.env.DB_PORT || 5432);
  const database = requireEnv('DB_NAME');
  const user = requireEnv('DB_USER');
  const password = requireEnv('DB_PASSWORD');

  return new Pool({ host, port, database, user, password });
}

async function waitForDb(pool, { attempts = 30, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr || new Error('DB not reachable');
}

module.exports = { createPool, waitForDb };
