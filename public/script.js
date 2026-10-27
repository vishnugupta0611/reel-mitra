// Determine API Base URL (works if opened via http://localhost:5000 or file://)
const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : "";

const sqlInput = document.getElementById("sqlInput");
const executeBtn = document.getElementById("executeBtn");
const clearBtn = document.getElementById("clearBtn");
const refreshTablesBtn = document.getElementById("refreshTablesBtn");
const tablesList = document.getElementById("tablesList");
const tableCount = document.getElementById("tableCount");

const statusBadge = document.getElementById("statusBadge");
const rowCount = document.getElementById("rowCount");
const execTime = document.getElementById("execTime");

const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const tableWrapper = document.getElementById("tableWrapper");
const emptyState = document.getElementById("emptyState");
const resultsTable = document.getElementById("resultsTable");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");

// Database switcher elements
const activeDbName = document.getElementById("activeDbName");
const openDbModalBtn = document.getElementById("openDbModalBtn");
const closeDbModalBtn = document.getElementById("closeDbModalBtn");
const dbModal = document.getElementById("dbModal");
const dbForm = document.getElementById("dbForm");
const newDbName = document.getElementById("newDbName");
const newDbUri = document.getElementById("newDbUri");
const savedDbList = document.getElementById("savedDbList");

// ============================================================================
// Database Profiles in localStorage
// ============================================================================
function getSavedDbs() {
  try {
    return JSON.parse(localStorage.getItem("reelmitra_saved_dbs")) || [];
  } catch (e) {
    return [];
  }
}

function saveDbs(list) {
  localStorage.setItem("reelmitra_saved_dbs", JSON.stringify(list));
}

function getActiveDbId() {
  return localStorage.getItem("reelmitra_active_db_id") || "default";
}

function setActiveDbId(id) {
  localStorage.setItem("reelmitra_active_db_id", id);
}

function getActiveDb() {
  const activeId = getActiveDbId();
  if (activeId === "default") {
    return { id: "default", name: "Default DB", connectionString: "" };
  }
  const found = getSavedDbs().find((db) => db.id === activeId);
  return found || { id: "default", name: "Default DB", connectionString: "" };
}

function updateActiveDbDisplay() {
  const active = getActiveDb();
  activeDbName.textContent = active.name;
  activeDbName.title = active.connectionString ? `Connected to: ${active.name}` : "Connected to Server Default DB";
}

function getRequestHeaders() {
  const headers = { "Content-Type": "application/json" };
  const active = getActiveDb();
  if (active && active.connectionString) {
    headers["x-connection-string"] = active.connectionString;
  }
  return headers;
}

function renderSavedDbs() {
  const saved = getSavedDbs();
  const activeId = getActiveDbId();
  savedDbList.innerHTML = "";

  // 1. Default DB item
  const defLi = document.createElement("li");
  defLi.className = `saved-db-item ${activeId === "default" ? "active" : ""}`;
  defLi.innerHTML = `
    <div class="db-item-info">
      <span class="db-item-name">Default Database</span>
      <span class="db-item-sub">Configured in Server (.env)</span>
    </div>
    <div class="db-item-actions">
      ${activeId === "default" ? '<span class="active-pill">Active</span>' : ""}
    </div>
  `;
  defLi.addEventListener("click", () => {
    setActiveDbId("default");
    updateActiveDbDisplay();
    dbModal.classList.add("hidden");
    loadTables();
  });
  savedDbList.appendChild(defLi);

  // 2. Custom user-saved DBs
  saved.forEach((db) => {
    const li = document.createElement("li");
    const isActive = activeId === db.id;
    li.className = `saved-db-item ${isActive ? "active" : ""}`;

    // Mask password in URI for UI display
    const maskedUri = db.connectionString.replace(/:(.*?)@/, ":****@");

    li.innerHTML = `
      <div class="db-item-info">
        <span class="db-item-name">${db.name}</span>
        <span class="db-item-sub" title="${maskedUri}">${maskedUri}</span>
      </div>
      <div class="db-item-actions">
        ${isActive ? '<span class="active-pill">Active</span>' : ""}
        <button class="btn-delete-db" title="Delete from saved">✕</button>
      </div>
    `;

    // Click to connect
    li.addEventListener("click", (e) => {
      if (e.target.closest(".btn-delete-db")) return;
      setActiveDbId(db.id);
      updateActiveDbDisplay();
      dbModal.classList.add("hidden");
      loadTables();
    });

    // Delete from localStorage
    const delBtn = li.querySelector(".btn-delete-db");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const updated = getSavedDbs().filter((d) => d.id !== db.id);
      saveDbs(updated);
      if (getActiveDbId() === db.id) {
        setActiveDbId("default");
        updateActiveDbDisplay();
        loadTables();
      }
      renderSavedDbs();
    });

    savedDbList.appendChild(li);
  });
}

// Modal Toggle
openDbModalBtn.addEventListener("click", () => {
  renderSavedDbs();
  dbModal.classList.remove("hidden");
});

closeDbModalBtn.addEventListener("click", () => {
  dbModal.classList.add("hidden");
});

dbModal.addEventListener("click", (e) => {
  if (e.target === dbModal) dbModal.classList.add("hidden");
});

// Add New DB
dbForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = newDbName.value.trim();
  const uri = newDbUri.value.trim();

  if (!name || !uri) return;

  const newId = `db_${Date.now()}`;
  const saved = getSavedDbs();
  saved.push({ id: newId, name, connectionString: uri });
  saveDbs(saved);

  setActiveDbId(newId);
  updateActiveDbDisplay();

  newDbName.value = "";
  newDbUri.value = "";
  dbModal.classList.add("hidden");

  loadTables();
});

// ============================================================================
// Tables & Query Execution
// ============================================================================
async function loadTables() {
  try {
    tablesList.innerHTML = '<li class="loading-item">Loading tables...</li>';
    const res = await fetch(`${API_BASE}/api/tables`, {
      headers: getRequestHeaders(),
    });
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || "Failed to load tables");

    const tables = data.tables || [];
    tableCount.textContent = tables.length;
    tablesList.innerHTML = "";

    if (tables.length === 0) {
      tablesList.innerHTML = '<li class="loading-item">No public tables found</li>';
      return;
    }

    tables.forEach((tableName) => {
      const li = document.createElement("li");
      li.textContent = tableName;
      li.title = `Click to query ${tableName}`;
      li.addEventListener("click", () => {
        sqlInput.value = `SELECT * FROM ${tableName} LIMIT 50;`;
        executeQuery();
      });
      tablesList.appendChild(li);
    });
  } catch (err) {
    tableCount.textContent = "0";
    tablesList.innerHTML = `<li class="loading-item" style="color:#ef4444;">Error: ${err.message}</li>`;
  }
}

async function executeQuery() {
  const query = sqlInput.value.trim();
  if (!query) return;

  executeBtn.disabled = true;
  executeBtn.innerHTML = '<span class="play-icon">⏳</span> Running...';
  statusBadge.className = "badge";
  statusBadge.textContent = "Running";

  try {
    const res = await fetch(`${API_BASE}/api/query`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ query }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showError(data.error || "Query execution failed", data.executionTimeMs || 0);
    } else {
      showSuccess(data);
    }
  } catch (err) {
    showError(err.message, 0);
  } finally {
    executeBtn.disabled = false;
    executeBtn.innerHTML = '<span class="play-icon">▶</span> Execute';
  }
}

function showSuccess(data) {
  errorBox.classList.add("hidden");
  emptyState.classList.add("hidden");
  resultsTable.classList.remove("hidden");

  statusBadge.className = "badge success";
  statusBadge.textContent = data.command || "Success";
  rowCount.textContent = `${data.rowCount || (data.rows ? data.rows.length : 0)} rows`;
  execTime.textContent = `${data.executionTimeMs || 0} ms`;

  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const columns = data.columns || [];
  const rows = data.rows || [];

  if (columns.length === 0 && rows.length === 0) {
    emptyState.innerHTML = `<p>Query executed successfully: ${data.command || "OK"} (0 rows returned)</p>`;
    emptyState.classList.remove("hidden");
    resultsTable.classList.add("hidden");
    return;
  }

  const trHead = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    trHead.appendChild(th);
  });
  tableHead.appendChild(trHead);

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const val = row[col];

      if (val === null || val === undefined) {
        td.textContent = "null";
        td.classList.add("null-value");
      } else if (typeof val === "object") {
        td.textContent = JSON.stringify(val);
      } else {
        td.textContent = String(val);
      }
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

function showError(message, duration) {
  resultsTable.classList.add("hidden");
  emptyState.classList.add("hidden");
  errorBox.classList.remove("hidden");
  errorText.textContent = message;

  statusBadge.className = "badge error";
  statusBadge.textContent = "Error";
  rowCount.textContent = "0 rows";
  execTime.textContent = `${duration} ms`;
}

// Event Listeners
executeBtn.addEventListener("click", executeQuery);

// Double-click on input box executes query
sqlInput.addEventListener("dblclick", () => {
  executeQuery();
});

clearBtn.addEventListener("click", () => {
  sqlInput.value = "";
  sqlInput.focus();
});

refreshTablesBtn.addEventListener("click", loadTables);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    executeQuery();
  }
});

// Initialization
updateActiveDbDisplay();
loadTables();

// ============================================================================
// AI Query Assistant
// ============================================================================
const aiPromptInput = document.getElementById("aiPromptInput");
const aiAskBtn = document.getElementById("aiAskBtn");

async function generateAiQuery() {
  const prompt = aiPromptInput.value.trim();
  if (!prompt) return;

  aiAskBtn.disabled = true;
  aiAskBtn.textContent = "Generating...";

  try {
    const res = await fetch(`${API_BASE}/api/ai/query`, {
      method: "POST",
      headers: getRequestHeaders(),
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      showError("AI Error: " + (data.error || "Failed to generate query"), 0);
    } else if (data.sql) {
      sqlInput.value = data.sql;
      statusBadge.className = "badge success";
      statusBadge.textContent = data.provider === "ollama" ? "AI (Ollama Fallback)" : "AI Generated";
      sqlInput.focus();
    }
  } catch (err) {
    showError("AI Request failed: " + err.message, 0);
  } finally {
    aiAskBtn.disabled = false;
    aiAskBtn.textContent = "Generate SQL";
  }
}

aiAskBtn.addEventListener("click", generateAiQuery);
aiPromptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    generateAiQuery();
  }
});
