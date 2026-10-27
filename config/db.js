const { Pool } = require("pg");
require("dotenv").config();

const isCloudPostgres = Boolean(
  (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) ||
  (process.env.PGHOST && !["localhost", "127.0.0.1"].includes(process.env.PGHOST)) ||
  process.env.PGSSL === "true"
);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      max: 10,
    }
  : {
      host: process.env.PGHOST || "localhost",
      port: parseInt(process.env.PGPORT || "5432", 10),
      database: process.env.PGDATABASE || "reelmitra",
      user: process.env.PGUSER || "vaibhav",
      password: process.env.PGPASSWORD || "admin",
      ssl: isCloudPostgres ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      max: 10,
    };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
  // Connected client to the pool
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
