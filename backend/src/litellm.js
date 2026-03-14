"use strict";

/**
 * LiteLLM Proxy Management Client
 * Wraps LiteLLM admin API for dynamic model registration.
 */

const axios = require("axios");
const { logger } = require("./logger");

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || "http://litellm:4000";
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || "sk-gateway-master-key";

const client = axios.create({
  baseURL: LITELLM_BASE_URL,
  timeout: 15000,
  headers: {
    Authorization: "Bearer " + LITELLM_MASTER_KEY,
    "Content-Type": "application/json",
  },
});

async function registerModel(model) {
  const payload = {
    model_name: model.name,
    litellm_params: buildLitellmParams(model),
    model_info: {
      id: model.id,
      description: model.description || "",
      model_type: model.modelType || "chat",
    },
  };

  logger.info("Registering model with LiteLLM", { modelName: model.name });

  const response = await client.post("/model/new", payload);

  const litellmId =
    (response.data && response.data.model_info && response.data.model_info.id) ||
    (response.data && response.data.id) ||
    null;

  if (!litellmId) {
    logger.warn(
      "LiteLLM /model/new response contained no recognisable model ID. " +
        "Falling back to internal UUID. " +
        "Deregistration may fail silently leaving a ghost model in LiteLLM.",
      {
        modelName: model.name,
        internalId: model.id,
        responseTopLevelKeys: response.data ? Object.keys(response.data) : [],
        responseData: response.data,
      }
    );
    return model.id;
  }

  logger.info("Model registered in LiteLLM", { modelName: model.name, litellmId: litellmId });
  return litellmId;
}

async function deregisterModel(litellmId) {
  if (!litellmId) return;
  try {
    await client.post("/model/delete", {
      id: litellmId,
      model_id: litellmId,
    });
    logger.info("Model deregistered from LiteLLM", { litellmId: litellmId });
  } catch (err) {
    logger.warn("Could not deregister model from LiteLLM", {
      litellmId: litellmId,
      httpStatus: err.response && err.response.status,
      error: err.message,
    });
  }
}

async function listLitellmModels() {
  const response = await client.get("/model/info");
  return (response.data && response.data.data) || response.data || [];
}

async function updateModel(oldLitellmId, model) {
  await deregisterModel(oldLitellmId);
  return registerModel(model);
}

async function healthCheck() {
  const response = await client.get("/health/liveliness");
  return response.data;
}

async function testModel(modelName, options) {
  if (!options) { options = {}; }
  const start = Date.now();
  const messages =
    options.messages && options.messages.length > 0
      ? options.messages
      : [{ role: "user", content: options.prompt || "Say OK in one word." }];
  try {
    const response = await client.post(
      "/v1/chat/completions",
      {
        model: modelName,
        messages: messages,
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
      error: (err.response && err.response.data) || err.message,
    };
  }
}

function buildLitellmParams(model) {
  const params = {
    model: model.litellmModel,
  };

  if (model.apiBase) {
    params.api_base = model.apiBase;
  }

  const key = model._apiKey || model.apiKey;
  if (key && key !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" && key.trim() !== "") {
    params.api_key = key.trim();
  } else {
    params.api_key = "none";
  }

  return params;
}

module.exports = {
  registerModel: registerModel,
  deregisterModel: deregisterModel,
  listLitellmModels: listLitellmModels,
  updateModel: updateModel,
  healthCheck: healthCheck,
  testModel: testModel,
};