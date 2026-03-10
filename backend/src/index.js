"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { logger } = require("./logger");
const modelsRouter = require("./routes/models");
const statsRouter = require("./routes/stats");
const db = require("./database");
const litellm = require("./litellm");

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.url === "/api/health",
  })
);

// Rate limiting
app.use(
  "/api/",
  rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests" },
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────

// BUG FIX: The simple stub was removed. statsRouter's /health checks LiteLLM + DB health.
app.use("/api/models", modelsRouter);
app.use("/api", statsRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: "Internal server error" });
});

// ─── Startup ──────────────────────────────────────────────────────────────

async function start() {
  // Initialize DB
  db.getDb();
  logger.info("Database initialized");

  // BUG FIX: 5s hardcoded delay was unreliable — LiteLLM can take 30-60s to start.
  // Use retry loop with backoff instead.
  syncModelsToLitellmWithRetry();

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`AI Gateway Backend running on port ${PORT}`);
    logger.info(`Gateway public URL: ${process.env.GATEWAY_PUBLIC_URL || "http://localhost"}`);
  });
}

/**
 * Retry wrapper: attempts sync with exponential backoff for up to ~5 minutes.
 * Handles the case where LiteLLM container starts slower than the backend.
 */
async function syncModelsToLitellmWithRetry() {
  const MAX_ATTEMPTS = 10;
  const BASE_DELAY_MS = 5000;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await litellm.healthCheck();
      await syncModelsToLitellm();
      return;
    } catch (err) {
      const delay = Math.min(BASE_DELAY_MS * attempt, 30000);
      logger.warn(`LiteLLM not ready (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  logger.error("LiteLLM did not become ready after all retry attempts. Models not synced.");
}

/**
 * On startup, re-register all persisted models with LiteLLM.
 * This handles the case where LiteLLM was restarted and lost its in-memory state.
 */
async function syncModelsToLitellm() {
  try {
    const models = db.listModels({ enabledOnly: true });
    logger.info(`Syncing ${models.length} models to LiteLLM...`);

    for (const model of models) {
      try {
        // _apiKey is the raw (unmasked) API key set by deserializeModel
        const litellmId = await litellm.registerModel({ ...model, _apiKey: model._apiKey });
        db.updateModel(model.id, { litellmId });
        logger.info(`Synced: ${model.name}`);
      } catch (err) {
        logger.warn(`Failed to sync model ${model.name}: ${err.message}`);
      }
    }

    logger.info("Model sync complete");
  } catch (err) {
    logger.error("Model sync failed", { error: err.message });
  }
}

start().catch((err) => {
  logger.error("Fatal startup error", { error: err.message });
  process.exit(1);
});
