"use strict";

const Database = require("better-sqlite3");
const path = require("path");
const { logger } = require("./logger");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/gateway.db");

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { verbose: null });
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
    logger.info(`SQLite database opened at ${DB_PATH}`);
  }
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      provider    TEXT NOT NULL,
      litellm_model TEXT NOT NULL,
      api_base    TEXT,
      api_key     TEXT,
      description TEXT,
      tags        TEXT DEFAULT '[]',
      model_type  TEXT DEFAULT 'chat',
      enabled     INTEGER DEFAULT 1,
      litellm_id  TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id     TEXT REFERENCES models(id),
      model_name   TEXT NOT NULL,
      request_type TEXT NOT NULL,
      status       INTEGER NOT NULL,
      latency_ms   INTEGER,
      tokens_in    INTEGER,
      tokens_out   INTEGER,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_models_enabled ON models(enabled);
    CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_logs(model_id);
    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);
  `);

  // Seed default settings
  const upsertSetting = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );
  upsertSetting.run("gateway_version", "1.0.0");
  upsertSetting.run("require_auth", "false");
}

// ─── Model CRUD ────────────────────────────────────────────────────────────

function listModels({ enabledOnly = false } = {}) {
  const db = getDb();
  const where = enabledOnly ? "WHERE enabled = 1" : "";
  const rows = db.prepare(`SELECT * FROM models ${where} ORDER BY created_at DESC`).all();
  return rows.map(deserializeModel);
}

function getModel(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM models WHERE id = ?").get(id);
  return row ? deserializeModel(row) : null;
}

function getModelByName(name) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM models WHERE name = ?").get(name);
  return row ? deserializeModel(row) : null;
}

function createModel(model) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO models
      (id, name, display_name, provider, litellm_model, api_base, api_key,
       description, tags, model_type, enabled, litellm_id)
    VALUES
      (@id, @name, @display_name, @provider, @litellm_model, @api_base, @api_key,
       @description, @tags, @model_type, @enabled, @litellm_id)
  `);
  stmt.run({ ...serializeModel(model) });
  return getModel(model.id);
}

function updateModel(id, updates) {
  const db = getDb();

  // BUG FIX #5: Guard against empty updates to avoid invalid SQL "SET , updated_at..."
  const keys = Object.keys(updates).filter((k) => k !== "id");
  if (keys.length === 0) return getModel(id);

  // BUG FIX #3: Convert boolean `enabled` → integer for SQLite (better-sqlite3 rejects booleans)
  const normalized = { ...updates };
  if (typeof normalized.enabled === "boolean") {
    normalized.enabled = normalized.enabled ? 1 : 0;
  }

  const fields = keys
    .map((k) => {
      const col = k === "displayName" ? "display_name"
        : k === "litellmModel" ? "litellm_model"
        : k === "apiBase" ? "api_base"
        : k === "apiKey" ? "api_key"
        : k === "modelType" ? "model_type"
        : k === "litellmId" ? "litellm_id"
        : k;
      return `${col} = @${k}`;
    })
    .join(", ");

  db.prepare(
    `UPDATE models SET ${fields}, updated_at = datetime('now') WHERE id = @id`
  ).run({ id, ...normalized });
  return getModel(id);
}

function deleteModel(id) {
  const db = getDb();
  db.prepare("DELETE FROM models WHERE id = ?").run(id);
}

function logUsage(entry) {
  const db = getDb();
  db.prepare(`
    INSERT INTO usage_logs (model_id, model_name, request_type, status, latency_ms, tokens_in, tokens_out)
    VALUES (@modelId, @modelName, @requestType, @status, @latencyMs, @tokensIn, @tokensOut)
  `).run(entry);
}

function getStats() {
  const db = getDb();
  return {
    totalModels: db.prepare("SELECT COUNT(*) as n FROM models").get().n,
    enabledModels: db.prepare("SELECT COUNT(*) as n FROM models WHERE enabled = 1").get().n,
    totalRequests: db.prepare("SELECT COUNT(*) as n FROM usage_logs").get().n,
    successRequests: db.prepare("SELECT COUNT(*) as n FROM usage_logs WHERE status = 200").get().n,
    avgLatency: db.prepare("SELECT AVG(latency_ms) as n FROM usage_logs WHERE status = 200").get().n || 0,
  };
}

// ─── Serialization helpers ─────────────────────────────────────────────────

function serializeModel(m) {
  // IMPORTANT: raw key is stored as _apiKey in model records coming from routes,
  // m.apiKey may be the masked "••••••••" string — never write that to the DB.
  const rawKey = m._apiKey || (m.apiKey && m.apiKey !== "••••••••" ? m.apiKey : null) || m.api_key || null;
  return {
    id: m.id,
    name: m.name,
    display_name: m.displayName || m.display_name,
    provider: m.provider,
    litellm_model: m.litellmModel || m.litellm_model,
    api_base: m.apiBase || m.api_base || null,
    api_key: rawKey,
    description: m.description || null,
    tags: JSON.stringify(m.tags || []),
    model_type: m.modelType || m.model_type || "chat",
    enabled: m.enabled !== false ? 1 : 0,
    litellm_id: m.litellmId || m.litellm_id || null,
  };
}

function deserializeModel(row) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    provider: row.provider,
    litellmModel: row.litellm_model,
    apiBase: row.api_base,
    apiKey: row.api_key ? "••••••••" : null, // mask key
    _apiKey: row.api_key, // raw key for internal use
    description: row.description,
    tags: JSON.parse(row.tags || "[]"),
    modelType: row.model_type,
    enabled: row.enabled === 1,
    litellmId: row.litellm_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  getDb,
  listModels,
  getModel,
  getModelByName,
  createModel,
  updateModel,
  deleteModel,
  logUsage,
  getStats,
};
