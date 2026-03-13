“use strict”;

/**

- LiteLLM Proxy Management Client
- Wraps LiteLLM’s admin API for dynamic model registration.
  */

const axios = require(“axios”);
const { logger } = require(”./logger”);

const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || “http://litellm:4000”;
const LITELLM_MASTER_KEY = process.env.LITELLM_MASTER_KEY || “sk-gateway-master-key”;

const client = axios.create({
baseURL: LITELLM_BASE_URL,
timeout: 15000,
headers: {
Authorization: `Bearer ${LITELLM_MASTER_KEY}`,
“Content-Type”: “application/json”,
},
});

// ─── Model Registration ────────────────────────────────────────────────────

/**

- Register a new model in LiteLLM at runtime.
- @param {object} model  - Our internal model record
- @returns {string}       - LiteLLM internal model ID
  */
  async function registerModel(model) {
  const payload = {
  model_name: model.name, // OpenAI-compatible alias exposed to callers
  litellm_params: buildLitellmParams(model),
  model_info: {
  id: model.id,
  description: model.description || “”,
  model_type: model.modelType || “chat”,
  },
  };

logger.info(“Registering model with LiteLLM”, { modelName: model.name });

const response = await client.post(”/model/new”, payload);

// ─── BUG FIX #7: Ghost model on missing LiteLLM ID ──────────────────────
//
// ORIGINAL CODE:
//   const litellmId = response.data?.model_info?.id || response.data?.id || model.id;
//
// The final `|| model.id` fallback silently stored our own UUID as
// `litellm_id` whenever LiteLLM returned a response without a recognisable
// ID field. This created a “ghost model” scenario:
//
//   1. DB stored our own UUID as `litellm_id`.
//   2. On delete, deregisterModel() sent that UUID to LiteLLM /model/delete.
//   3. LiteLLM couldn’t find it → returned an error we silently swallowed.
//   4. Model removed from our DB but remained live inside LiteLLM’s in-memory
//      router — still accepting real API traffic indefinitely.
//
// FIX: Extract the ID from the two documented response paths. If neither
// yields an ID, emit a structured WARN (visible in logs/alerts) then fall
// back to model.id only as a last resort so the creation flow is not broken.
// The warning makes the deregistration risk explicit to operators.
//
// LiteLLM /model/new documented response shapes:
//   v1.x+  → { model_info: { id: “<uuid>”, … }, model_name: “…” }
//   older  → { id: “<uuid>”, … }
// ─────────────────────────────────────────────────────────────────────────
const litellmId =
response.data?.model_info?.id ||
response.data?.id ||
null;

if (!litellmId) {
logger.warn(
“[BUG#7] LiteLLM /model/new response contained no recognisable model ID. “ +
“Falling back to internal UUID as litellm_id. “ +
“Subsequent deregisterModel() calls for this model will likely fail silently, “ +
“leaving a ghost model active inside LiteLLM. “ +
“Inspect responseData below and verify your LiteLLM version.”,
{
modelName: model.name,
internalId: model.id,
responseTopLevelKeys: response.data ? Object.keys(response.data) : [],
responseData: response.data,
}
);
// Retain fallback so createModel() still returns a usable record.
return model.id;
}

logger.info(“Model registered in LiteLLM”, { modelName: model.name, litellmId });
return litellmId;
}

/**

- Remove a model from LiteLLM.
- 
- @param {string} litellmId  - LiteLLM’s model ID (returned from registerModel)
- 
- ─── BUG FIX #6: /model/delete field-name version incompatibility ──────────
- 
- ORIGINAL CODE:
- await client.post(”/model/delete”, { id: litellmId });
- 
- The request-body field name accepted by /model/delete has changed across
- LiteLLM releases:
- 
- • Older versions (pre-v1.x):  { model_id: “<id>” }
- • Current versions (v1.x+):   { id: “<id>” }
- 
- Sending only `id` against an older deployment produces a silent no-op:
- LiteLLM returns HTTP 200 but ignores the request because it only reads
- `model_id`. The same failure mode applies in reverse on newer versions.
- 
- FIX: Send BOTH fields in every request. LiteLLM’s Pydantic models use
- `model_config = ConfigDict(extra="ignore")`, so unknown keys are silently
- discarded — the payload is safe for all known versions.
- 
- If deletion silently fails after a future LiteLLM upgrade, verify the
- current accepted field name via the running instance’s Swagger UI:
- http://<litellm-host>:4000/docs  →  POST /model/delete
- ─────────────────────────────────────────────────────────────────────────
  */
  async function deregisterModel(litellmId) {
  if (!litellmId) return;
  try {
  await client.post(”/model/delete”, {
  id: litellmId,       // accepted by LiteLLM v1.x+
  model_id: litellmId, // accepted by LiteLLM pre-v1.x
  });
  logger.info(“Model deregistered from LiteLLM”, { litellmId });
  } catch (err) {
  // Model may not exist in LiteLLM (e.g. was never synced, or litellmId
  // is our own UUID fallback from Bug Fix #7).  Log at warn so the operator
  // is aware but the delete flow is not blocked.
  logger.warn(“Could not deregister model from LiteLLM”, {
  litellmId,
  httpStatus: err.response?.status,
  error: err.message,
  });
  }
  }

/**

- List all models currently registered in LiteLLM.
  */
  async function listLitellmModels() {
  const response = await client.get(”/model/info”);
  return response.data?.data || response.data || [];
  }

/**

- Update a model in LiteLLM (delete + re-add since update isn’t atomic).
  */
  async function updateModel(oldLitellmId, model) {
  await deregisterModel(oldLitellmId);
  return registerModel(model);
  }

/**

- Check LiteLLM liveness.
- 
- Uses /health/liveliness instead of /health:
- - /health validates all registered model upstreams. If any upstream is
- unreachable it returns an error even though LiteLLM itself is healthy,
- causing syncModelsToLitellmWithRetry() to retry endlessly and give up.
- - /health/liveliness only checks that the LiteLLM process is alive, which
- is the correct signal for “ready to accept /model/new requests”.
- This also matches the docker-compose.yml container healthcheck target.
  */
  async function healthCheck() {
  const response = await client.get(”/health/liveliness”);
  return response.data;
  }

/**

- Test a model by sending a minimal chat completion request.
  */
  async function testModel(modelName, options = {}) {
  const start = Date.now();
  const messages =
  options.messages && options.messages.length > 0
  ? options.messages
  : [{ role: “user”, content: options.prompt || “Say ‘OK’ in one word.” }];
  try {
  const response = await client.post(
  “/v1/chat/completions”,
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

// Note: original code also checked `model._apiBase` which is never set
// anywhere in the codebase — that dead reference has been removed.
if (model.apiBase) {
params.api_base = model.apiBase;
}

// Only include api_key if provided and non-empty
const key = model._apiKey || model.apiKey;
if (key && key !== “••••••••” && key.trim() !== “”) {
params.api_key = key.trim();
} else {
// LiteLLM requires some api_key for most providers; use placeholder
params.api_key = “none”;
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