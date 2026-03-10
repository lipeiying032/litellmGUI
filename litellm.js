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

  // BUG FIX #7: Previously fell back to `model.id` (our own UUID) when LiteLLM
  // did not return a model ID in the response. This caused a subtle "ghost model"
  // bug:
  //   1. Our DB stored our own UUID as `litellm_id`.
  //   2. On delete, deregisterModel() sent that UUID to LiteLLM's /model/delete.
  //   3. LiteLLM couldn't find it, logged a 404, we silently swallowed the error.
  //   4. The model was removed from our DB but remained live in LiteLLM's memory,
  //      still accepting requests under the alias indefinitely.
  //
  // Fix: extract the ID from the documented response paths, emit a clear warning
  // if neither is present (so operators can detect the regression immediately),
  // and only then fall back to our own UUID as a last resort. The fallback is
  // retained to avoid breaking the creation flow — callers still get a record —
  // but the warning makes the deregistration risk visible in the logs.
  const litellmId =
    response.data?.model_info?.id ||
    response.data?.id ||
    null;

  if (!litellmId) {
    logger.warn(
      "LiteLLM did not return a model ID in /model/new response. " +
      "Falling back to internal UUID as litellm_id. " +
      "Deregistration (DELETE) for this model may silently fail — " +
      "the model could remain active in LiteLLM after being removed from the DB. " +
      "Check the LiteLLM version or /model/new response shape.",
      { modelName: model.name, responseData: response.data }
    );
    // Fall back to our own ID so the creation flow doesn't break, but the
    // warning above gives operators the signal they need to investigate.
    return model.id;
  }

  logger.info("Model registered in LiteLLM", { modelName: model.name, litellmId });
  return litellmId;
}

/**
 * Remove a model from LiteLLM.
 * @param {string} litellmId  - LiteLLM's model ID (returned from registerModel)
 *
 * NOTE: The /model/delete request body field name has varied across LiteLLM
 * versions. Current versions (>= v1.x) expect { id: litellmId }.
 * We also send { model_id: litellmId } as a forward-compatibility hedge — older
 * versions that used "model_id" will pick it up, newer versions ignore extra keys.
 * If deletion silently fails after a LiteLLM upgrade, verify the field name
 * against the running version's Swagger at http://<litellm-host>:4000/docs.
 */
async function deregisterModel(litellmId) {
  if (!litellmId) return;
  try {
    await client.post("/model/delete", { id: litellmId, model_id: litellmId });
    logger.info("Model deregistered from LiteLLM", { litellmId });
  } catch (err) {
    // Model may not exist in LiteLLM (e.g. was never synced, or litellmId is
    // our own UUID fallback from Bug Fix #7) — log at warn level so the
    // operator is aware but the delete flow is not blocked.
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
 * Check LiteLLM liveness.
 *
 * Uses /health/liveliness instead of /health:
 * - /health checks all registered model upstreams. If any upstream is
 *   unreachable, it returns an error even though LiteLLM itself is running,
 *   causing syncModelsToLitellmWithRetry() to retry unnecessarily and give up.
 * - /health/liveliness only checks that the LiteLLM process is alive, which
 *   is the correct signal for "is LiteLLM ready to accept /model/new requests?".
 *   This also matches the docker-compose.yml container healthcheck endpoint.
 */
async function healthCheck() {
  const response = await client.get("/health/liveliness");
  return response.data;
}

/**
 * Test a model by sending a minimal chat completion request.
 */
async function testModel(modelName, options = {}) {
  const start = Date.now();
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

  if (model.apiBase) {
    params.api_base = model.apiBase;
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
