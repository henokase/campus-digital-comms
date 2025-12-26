require('dotenv').config();

const { Pool } = require('pg');

const { createApp } = require('./app');
const { createPublisher } = require('./publisher');

function getDbConfigFromEnv() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 5432);
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  return { host, port, database, user, password };
}

async function main() {
  const pool = new Pool(getDbConfigFromEnv());
  const publisher = await createPublisher();

  const app = createApp({ pool, publisher });
  const port = Number(process.env.PORT || 3002);

  const server = app.listen(port, () => {
    console.log(`announcement-service listening on ${port}`);
  });

  async function shutdown() {
    try {
      server.close();
    } catch {}
    try {
      await publisher.close();
    } catch {}
    try {
      await pool.end();
    } catch {}
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
