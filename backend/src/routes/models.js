"use strict";

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const router = express.Router();

const db = require("../database");
const litellm = require("../litellm");
const { logger } = require("../logger");

const GATEWAY_PUBLIC_URL =
  (process.env.GATEWAY_PUBLIC_URL || "http://localhost").replace(/\/$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildModelAlias(provider, litellmModel) {
  // Avoid double-prefix: if litellmModel already starts with "provider/", use it directly.
  // e.g. provider="anthropic", model="anthropic/claude-3-5-sonnet" → "anthropic/claude-3-5-sonnet"
  //      provider="myorg",      model="anthropic/claude-3-5-sonnet" → "myorg/anthropic/claude-3-5-sonnet"
  const base = litellmModel.startsWith(`${provider}/`) ? litellmModel : `${provider}/${litellmModel}`;
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9\-_./]/g, "-")   // keep slashes so provider/model stays readable
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug;
}

function modelResponse(model) {
  return {
    ...model,
    openaiEndpoint: `${GATEWAY_PUBLIC_URL}/v1`,
    openaiModelName: model.name,
    curlExample: buildCurlExample(model.name),
    pythonExample: buildPythonExample(model.name),
  };
}

function buildCurlExample(modelName) {
  return `curl ${GATEWAY_PUBLIC_URL}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer any-key" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
}

function buildPythonExample(modelName) {
  return `from openai import OpenAI

client = OpenAI(
    base_url="${GATEWAY_PUBLIC_URL}/v1",
    api_key="any-key",  # No real key needed
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`;
}

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/models
 * List all registered models.
 */
router.get("/", (req, res) => {
  try {
    const models = db.listModels();
    res.json({
      success: true,
      data: models.map(modelResponse),
      count: models.length,
    });
  } catch (err) {
    logger.error("Failed to list models", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to fetch models" });
  }
});

/**
 * GET /api/models/:id
 * Get a single model.
 */
router.get("/:id", (req, res) => {
  try {
    const model = db.getModel(req.params.id);
    if (!model) return res.status(404).json({ success: false, error: "Model not found" });
    res.json({ success: true, data: modelResponse(model) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/models
 * Register a new model.
 *
 * Body:
 *   displayName   string  – Human-readable name (e.g. "My Claude Proxy")
 *   provider      string  – Provider label (e.g. "anthropic", "openai", "ollama")
 *   litellmModel  string  – LiteLLM model identifier (e.g. "anthropic/claude-3-opus-20240229")
 *   apiBase       string? – Custom API base URL (optional)
 *   apiKey        string? – API key (optional – for keyless providers leave empty)
 *   description   string? – Human-readable description
 *   tags          string[]? – Tags for filtering
 *   modelType     string? – "chat" | "completion" | "embedding" | "image" | "audio"
 */
router.post("/", async (req, res) => {
  const {
    displayName,
    provider,
    litellmModel,
    apiBase,
    apiKey,
    description,
    tags = [],
    modelType = "chat",
  } = req.body;

  // Validation
  if (!displayName || !provider || !litellmModel) {
    return res.status(400).json({
      success: false,
      error: "displayName, provider, and litellmModel are required",
    });
  }

  const id = uuidv4();
  const name = buildModelAlias(provider, litellmModel);

  // Check for duplicate alias
  if (db.getModelByName(name)) {
    return res.status(409).json({
      success: false,
      error: `A model with alias "${name}" already exists. Use a different provider label or model.`,
    });
  }

  const modelRecord = {
    id,
    name,
    displayName,
    provider,
    litellmModel,
    apiBase: apiBase || null,
    apiKey: apiKey || null,       // BUG FIX: was _apiKey — serializeModel reads m.apiKey, not m._apiKey
    description: description || null,
    tags,
    modelType,
    enabled: true,
    litellmId: null,
  };

  try {
    // Persist to DB first
    db.createModel(modelRecord);

    // Register with LiteLLM asynchronously
    try {
      // Pass _apiKey explicitly so buildLitellmParams can access the raw key
      const litellmId = await litellm.registerModel({ ...modelRecord, _apiKey: modelRecord.apiKey });
      db.updateModel(id, { litellmId });
      modelRecord.litellmId = litellmId;
    } catch (litellmErr) {
      logger.warn("Could not register model with LiteLLM (will retry on next request)", {
        modelName: name,
        error: litellmErr.message,
      });
    }

    const created = db.getModel(id);
    logger.info("Model created", { id, name });
    res.status(201).json({ success: true, data: modelResponse(created) });
  } catch (err) {
    logger.error("Failed to create model", { error: err.message });
    res.status(500).json({ success: false, error: "Failed to create model" });
  }
});

/**
 * PATCH /api/models/:id
 * Update model metadata.
 */
router.patch("/:id", async (req, res) => {
  try {
    const existing = db.getModel(req.params.id);
    if (!existing) return res.status(404).json({ success: false, error: "Model not found" });

    const allowedFields = ["displayName", "description", "tags", "modelType", "enabled", "apiKey", "apiBase"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    db.updateModel(req.params.id, updates);

    // Re-sync with LiteLLM if key/endpoint changed
    if (updates.apiKey !== undefined || updates.apiBase !== undefined) {
      try {
        const updated = db.getModel(req.params.id);
        const newLitellmId = await litellm.updateModel(existing.litellmId, {
          ...updated,
          _apiKey: updates.apiKey || existing._apiKey,
        });
        db.updateModel(req.params.id, { litellmId: newLitellmId });
      } catch (litellmErr) {
        logger.warn("LiteLLM re-sync failed", { error: litellmErr.message });
      }
    }

    const updated = db.getModel(req.params.id);
    res.json({ success: true, data: modelResponse(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/models/:id
 * Remove a model.
 */
router.delete("/:id", async (req, res) => {
  try {
    const model = db.getModel(req.params.id);
    if (!model) return res.status(404).json({ success: false, error: "Model not found" });

    // Deregister from LiteLLM
    if (model.litellmId) {
      await litellm.deregisterModel(model.litellmId);
    }

    db.deleteModel(req.params.id);
    logger.info("Model deleted", { id: req.params.id, name: model.name });
    res.json({ success: true, message: "Model deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/models/:id/test
 * Send a test request through LiteLLM for this model.
 */
router.post("/:id/test", async (req, res) => {
  try {
    const model = db.getModel(req.params.id);
    if (!model) return res.status(404).json({ success: false, error: "Model not found" });

    // BUG FIX: Accept full messages array from TestPanel (not just a single prompt string)
    const result = await litellm.testModel(model.name, {
      prompt: req.body.prompt,
      messages: req.body.messages,
    });

    // Log usage
    db.logUsage({
      modelId: model.id,
      modelName: model.name,
      requestType: "test",
      status: result.success ? 200 : 500,
      latencyMs: result.latencyMs,
      tokensIn: result.response?.usage?.prompt_tokens || 0,
      tokensOut: result.response?.usage?.completion_tokens || 0,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/models/:id/toggle
 * Enable or disable a model.
 */
router.post("/:id/toggle", (req, res) => {
  try {
    const model = db.getModel(req.params.id);
    if (!model) return res.status(404).json({ success: false, error: "Model not found" });
    db.updateModel(req.params.id, { enabled: !model.enabled });
    const updated = db.getModel(req.params.id);
    res.json({ success: true, data: modelResponse(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
