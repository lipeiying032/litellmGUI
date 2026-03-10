"use strict";

/**
 * LiteLLM Proxy Management Client
 * Wraps LiteLLM's admin API for dynamic model registration.
 */

const axios = require("axios");
const { logger } = require("./logger");

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || "http://litellm:4000";
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || "sk-gateway-master-key";

const client = axios.create({
  baseURL: LITELLM_BASE_URL,
  timeout: 15000,
  headers: {
    Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
    "Content-Type": "application/json",
  },
});

// ─── Model Registration ────────────────────────────────────────────────────

/**
 * Register a new model in LiteLLM at runtime.
 * @param {object} model  - Our internal model record
 * @returns {string}       - LiteLLM internal model ID
 */
async function registerModel(model) {
  const payload = {
    model_name: model.name, // OpenAI-compatible alias exposed to callers
    litellm_params: buildLitellmParams(model),
    model_info: {
      id: model.id,
      description: model.description || "",
      model_type: model.modelType || "chat",
    },
  };

  logger.info("Registering model with LiteLLM", { modelName: model.name });

  const response = await client.post("/model/new", payload);
  const litellmId = response.data?.model_info?.id || response.data?.id || model.id;
  logger.info("Model registered in LiteLLM", { modelName: model.name, litellmId });
  return litellmId;
}

/**
 * Remove a model from LiteLLM.
 * @param {string} litellmId  - LiteLLM's model ID
 */
async function deregisterModel(litellmId) {
  if (!litellmId) return;
  try {
    await client.post("/model/delete", { id: litellmId });
    logger.info("Model deregistered from LiteLLM", { litellmId });
  } catch (err) {
    // Model may not exist in LiteLLM (e.g. was never synced) — ignore
    logger.warn("Could not deregister model from LiteLLM", {
      litellmId,
      error: err.message,
    });
  }
}

/**
 * List all models currently registered in LiteLLM.
 */
async function listLitellmModels() {
  const response = await client.get("/model/info");
  return response.data?.data || response.data || [];
}

/**
 * Update a model in LiteLLM (delete + re-add since update isn't atomic).
 */
async function updateModel(oldLitellmId, model) {
  await deregisterModel(oldLitellmId);
  return registerModel(model);
}

/**
 * Check LiteLLM health.
 */
async function healthCheck() {
  const response = await client.get("/health");
  return response.data;
}

/**
 * Test a model by sending a minimal chat completion request.
 */
async function testModel(modelName, options = {}) {
  const start = Date.now();
  // BUG FIX: Use provided messages array if available, otherwise fall back to single prompt
  const messages = options.messages && options.messages.length > 0
    ? options.messages
    : [{ role: "user", content: options.prompt || "Say 'OK' in one word." }];
  try {
    const response = await client.post(
      "/v1/chat/completions",
      {
        model: modelName,
        messages,
        max_tokens: 256,
        stream: false,
      },
      { timeout: 30000 }
    );
    return {
      success: true,
      latencyMs: Date.now() - start,
      response: response.data,
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err.response?.data || err.message,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildLitellmParams(model) {
  const params = {
    model: model.litellmModel,
  };

  if (model.apiBase || model._apiBase) {
    params.api_base = model.apiBase || model._apiBase;
  }

  // Only include api_key if provided and non-empty
  const key = model._apiKey || model.apiKey;
  if (key && key !== "••••••••" && key.trim() !== "") {
    params.api_key = key.trim();
  } else {
    // LiteLLM requires some api_key for most providers; use placeholder
    params.api_key = "none";
  }

  return params;
}

module.exports = {
  registerModel,
  deregisterModel,
  listLitellmModels,
  updateModel,
  healthCheck,
  testModel,
};
