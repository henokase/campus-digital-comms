const { Pool } = require('pg');

function getDbConfigFromEnv() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 5432);
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  return { host, port, database, user, password };
}

const pool = new Pool(getDbConfigFromEnv());

module.exports = { pool };
