require("dotenv").config();
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");
const db = require("./config/db");
const { errorHandler, notFoundHandler } = require("./middlewares/errorMiddleware");

const app = express();

// Cache connection pools for custom databases
const dynamicPools = new Map();
const schemaCache = new Map();

function getDb(connectionString) {
  if (!connectionString) {
    return db;
  }
  const cleanConn = connectionString.trim();
  if (!dynamicPools.has(cleanConn)) {
    const isCloud = !cleanConn.includes("localhost") && !cleanConn.includes("127.0.0.1");
    const pool = new Pool({
      connectionString: cleanConn,
      ssl: isCloud ? { rejectUnauthorized: false } : false,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      max: 5,
    });
    pool.on("error", (err) => {
      console.error("Dynamic DB pool error:", err.message);
    });
    dynamicPools.set(cleanConn, pool);
  }
  return dynamicPools.get(cleanConn);
}

// Fetch schema and limited sample data for AI context
async function getDatabaseContext(connectionString) {
  const cacheKey = connectionString || "default";
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.context;
  }

  const targetDb = getDb(connectionString);
  const cols = await targetDb.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position;
  `);

  const schemaMap = {};
  cols.rows.forEach((r) => {
    if (!schemaMap[r.table_name]) schemaMap[r.table_name] = [];
    schemaMap[r.table_name].push(`${r.column_name} (${r.data_type})`);
  });

  const tables = Object.keys(schemaMap);
  const samples = await Promise.all(
    tables.map(async (t) => {
      try {
        const s = await targetDb.query(`SELECT * FROM ${t} LIMIT 1`);
        return { table: t, sample: s.rows[0] || null };
      } catch {
        return { table: t, sample: null };
      }
    })
  );

  let context = "";
  tables.forEach((t) => {
    context += `Table: ${t}\nColumns: ${schemaMap[t].join(", ")}\n`;
    const s = samples.find((x) => x.table === t);
    if (s && s.sample) {
      const safe = { ...s.sample };
      if (safe.password_hash) safe.password_hash = "[hidden_hash]";
      context += `Sample row: ${JSON.stringify(safe)}\n`;
    }
    context += "\n";
  });

  schemaCache.set(cacheKey, { context, timestamp: Date.now() });
  return context;
}

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Query Viewer Backend Endpoints
app.get("/api/tables", async (req, res) => {
  const connectionString = req.headers["x-connection-string"] || req.query.connectionString;
  try {
    const targetDb = getDb(connectionString);
    const result = await targetDb.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    res.json({ tables: result.rows.map((r) => r.table_name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/query", async (req, res) => {
  const { query } = req.body;
  const connectionString = req.body.connectionString || req.headers["x-connection-string"];

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "SQL query string is required" });
  }

  const start = Date.now();
  try {
    const targetDb = getDb(connectionString);
    const result = await targetDb.query(query);
    const duration = Date.now() - start;
    const columns = result.fields ? result.fields.map((f) => f.name) : [];

    res.json({
      columns,
      rows: result.rows || [],
      rowCount: result.rowCount !== null ? result.rowCount : (result.rows ? result.rows.length : 0),
      executionTimeMs: duration,
      command: result.command || "SELECT",
    });
  } catch (err) {
    const duration = Date.now() - start;
    res.status(400).json({
      error: err.message,
      executionTimeMs: duration,
    });
  }
});

// AI Query Assistant (Groq Primary -> Local Ollama Fallback)
app.post("/api/ai/query", async (req, res) => {
  const { prompt } = req.body;
  const connectionString = req.body.connectionString || req.headers["x-connection-string"];

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const context = await getDatabaseContext(connectionString);

    const systemPrompt = `You are an expert PostgreSQL SQL query assistant.
Given the following database schema and limited sample rows, write an accurate and executable SQL query matching the user request.

Database Schema & Sample Data:
${context}

Rules:
1. Return ONLY the executable SQL query. Do not wrap in markdown or backticks if possible, and do not add conversational explanations.
2. Only use existing table names and column names shown in the schema above.
3. Use sensible LIMIT clauses (e.g. LIMIT 50) when retrieving lists unless asked otherwise.`;

    let sql = null;
    let providerUsed = "groq";

    // 1. Try Groq (Primary)
    if (process.env.GROQ_API_KEY) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 1,
            max_completion_tokens: 2048,
            top_p: 1,
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          if (data.choices?.[0]?.message?.content) {
            sql = data.choices[0].message.content;
          }
        } else {
          const errData = await groqRes.json().catch(() => ({}));
          console.warn(`[AI] Groq failed (${groqRes.status}):`, errData.error?.message || "Rate limit or service error. Falling back to Ollama...");
        }
      } catch (groqErr) {
        console.warn("[AI] Groq network error, falling back to local Ollama:", groqErr.message);
      }
    }

    // 2. Fallback to Local Ollama if Groq failed or was unavailable
    if (!sql) {
      providerUsed = "ollama";
      const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:1.5b-instruct";

      console.log(`[AI] Using fallback local Ollama model: ${ollamaModel}`);
      const ollamaRes = await fetch(`${ollamaBase}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        throw new Error(`Both Groq and local Ollama failed. Ollama error: ${errText}`);
      }

      const ollamaData = await ollamaRes.json();
      sql = ollamaData.choices?.[0]?.message?.content || "";
    }

    sql = sql.replace(/^```(?:sql)?\n?/i, "").replace(/\n?```$/i, "").trim();

    res.json({ sql, provider: providerUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() as current_time, current_database() as db_name");
    res.json({
      message: "ReelMitra API is running!",
      database: result.rows[0].db_name,
      server_time: result.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed", details: error.message });
  }
});

// Mount API v1 Routes
app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/api/v1/users", require("./routes/userRoutes"));
app.use("/api/v1/categories", require("./routes/categoryRoutes"));
app.use("/api/v1/editors", require("./routes/editorsRoutes"));
app.use("/api/v1/editor", require("./routes/editorRoutes"));
app.use("/api/v1/uploads", require("./routes/uploadRoutes"));

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 PostgreSQL Query Viewer running on http://localhost:${PORT}`);
    try {
      const res = await db.query("SELECT current_database() as db");
      console.log(`📦 Connected to Render PostgreSQL: ${res.rows[0].db}`);
    } catch (err) {
      console.error("❌ PostgreSQL connection error:", err.message);
    }
  });
}

module.exports = app;
