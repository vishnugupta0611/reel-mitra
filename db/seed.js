const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function runSeed() {
  console.log("⏳ Seeding sample data into ReelMitra database...");
  const seedPath = path.join(__dirname, "seed.sql");
  const sql = fs.readFileSync(seedPath, "utf8");

  try {
    await db.query(sql);
    console.log("✅ Seed data inserted successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
}

runSeed();
