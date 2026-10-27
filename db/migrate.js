const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function runMigration() {
  console.log("⏳ Starting PostgreSQL schema migration for ReelMitra...");
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  try {
    await db.query(sql);
    console.log("✅ Schema migration completed successfully!");
    
    // Print all verified tables
    const res = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("📋 Verified tables in database:");
    res.rows.forEach((r, idx) => console.log(`   ${idx + 1}. ${r.table_name}`));
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
}

runMigration();
