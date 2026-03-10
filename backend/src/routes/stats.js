"use strict";

const express = require("express");
const router = express.Router();
const db = require("../database");
const litellm = require("../litellm");
const { logger } = require("../logger");

/**
 * GET /api/stats
 * Dashboard statistics.
 */
router.get("/", (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/health
 * Service health check.
 */
router.get("/health", async (req, res) => {
  const status = { api: "ok", litellm: "unknown", db: "unknown" };

  // DB check
  try {
    db.getStats();
    status.db = "ok";
  } catch {
    status.db = "error";
  }

  // LiteLLM check
  try {
    await litellm.healthCheck();
    status.litellm = "ok";
  } catch {
    status.litellm = "degraded";
  }

  const allOk = Object.values(status).every((v) => v === "ok");
  res.status(allOk ? 200 : 207).json({ success: true, data: status });
});

/**
 * GET /api/providers
 * Returns a curated list of known LiteLLM provider prefixes and example models
 * to help users fill in the model registration form.
 */
router.get("/providers", (req, res) => {
  res.json({
    success: true,
    data: KNOWN_PROVIDERS,
  });
});

const KNOWN_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    prefix: "openai/",
    requiresApiKey: true,
    defaultApiBase: "https://api.openai.com/v1",
    exampleModels: ["openai/gpt-4o", "openai/gpt-4-turbo", "openai/gpt-3.5-turbo"],
    modelTypes: ["chat", "embedding", "image", "audio"],
    docs: "https://docs.litellm.ai/docs/providers/openai",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    prefix: "anthropic/",
    requiresApiKey: true,
    defaultApiBase: "https://api.anthropic.com",
    exampleModels: [
      "anthropic/claude-3-5-sonnet-20241022",
      "anthropic/claude-3-opus-20240229",
      "anthropic/claude-3-haiku-20240307",
    ],
    modelTypes: ["chat"],
    docs: "https://docs.litellm.ai/docs/providers/anthropic",
  },
  {
    id: "google",
    name: "Google Gemini",
    prefix: "gemini/",
    requiresApiKey: true,
    defaultApiBase: null,
    exampleModels: ["gemini/gemini-1.5-pro", "gemini/gemini-1.5-flash", "gemini/gemini-pro"],
    modelTypes: ["chat", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/gemini",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    prefix: "ollama/",
    requiresApiKey: false,
    defaultApiBase: "http://host.docker.internal:11434",
    exampleModels: ["ollama/llama3", "ollama/mistral", "ollama/codellama", "ollama/phi3"],
    modelTypes: ["chat", "completion", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/ollama",
  },
  {
    id: "cohere",
    name: "Cohere",
    prefix: "cohere/",
    requiresApiKey: true,
    defaultApiBase: null,
    exampleModels: ["cohere/command-r-plus", "cohere/command-r", "cohere/command"],
    modelTypes: ["chat", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/cohere_chat",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    prefix: "mistral/",
    requiresApiKey: true,
    defaultApiBase: null,
    exampleModels: ["mistral/mistral-large-latest", "mistral/mistral-medium", "mistral/mistral-small"],
    modelTypes: ["chat"],
    docs: "https://docs.litellm.ai/docs/providers/mistral",
  },
  {
    id: "groq",
    name: "Groq",
    prefix: "groq/",
    requiresApiKey: true,
    defaultApiBase: "https://api.groq.com/openai/v1",
    exampleModels: ["groq/llama3-70b-8192", "groq/mixtral-8x7b-32768", "groq/gemma-7b-it"],
    modelTypes: ["chat"],
    docs: "https://docs.litellm.ai/docs/providers/groq",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    prefix: "azure/",
    requiresApiKey: true,
    defaultApiBase: "https://<your-resource>.openai.azure.com",
    exampleModels: ["azure/gpt-4o", "azure/gpt-35-turbo"],
    modelTypes: ["chat", "embedding", "image"],
    docs: "https://docs.litellm.ai/docs/providers/azure",
  },
  {
    id: "vertex_ai",
    name: "Google Vertex AI",
    prefix: "vertex_ai/",
    requiresApiKey: false,
    defaultApiBase: null,
    exampleModels: ["vertex_ai/gemini-1.5-pro", "vertex_ai/claude-3-5-sonnet@20241022"],
    modelTypes: ["chat", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/vertex",
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    prefix: "bedrock/",
    requiresApiKey: false,
    defaultApiBase: null,
    exampleModels: [
      "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
      "bedrock/amazon.titan-text-express-v1",
    ],
    modelTypes: ["chat", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/bedrock",
  },
  {
    id: "huggingface",
    name: "HuggingFace",
    prefix: "huggingface/",
    requiresApiKey: true,
    defaultApiBase: "https://api-inference.huggingface.co/models/<model>",
    exampleModels: ["huggingface/HuggingFaceH4/zephyr-7b-beta"],
    modelTypes: ["chat", "completion", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/huggingface",
  },
  {
    id: "openai_compatible",
    name: "OpenAI-Compatible (Custom)",
    prefix: "openai/",
    requiresApiKey: false,
    defaultApiBase: "https://your-custom-endpoint.example.com/v1",
    exampleModels: ["openai/your-model-name"],
    modelTypes: ["chat", "completion", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/openai_compatible",
  },
  {
    id: "together_ai",
    name: "Together AI",
    prefix: "together_ai/",
    requiresApiKey: true,
    defaultApiBase: null,
    exampleModels: [
      "together_ai/togethercomputer/llama-3-70b",
      "together_ai/mistralai/Mixtral-8x7B-Instruct-v0.1",
    ],
    modelTypes: ["chat", "embedding"],
    docs: "https://docs.litellm.ai/docs/providers/togetherai",
  },
  {
    id: "replicate",
    name: "Replicate",
    prefix: "replicate/",
    requiresApiKey: true,
    defaultApiBase: null,
    exampleModels: ["replicate/meta/llama-3-70b-instruct"],
    modelTypes: ["chat", "image"],
    docs: "https://docs.litellm.ai/docs/providers/replicate",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    prefix: "deepseek/",
    requiresApiKey: true,
    defaultApiBase: "https://api.deepseek.com/v1",
    exampleModels: ["deepseek/deepseek-chat", "deepseek/deepseek-coder"],
    modelTypes: ["chat"],
    docs: "https://docs.litellm.ai/docs/providers/deepseek",
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    prefix: "perplexity/",
    requiresApiKey: true,
    defaultApiBase: "https://api.perplexity.ai",
    exampleModels: ["perplexity/llama-3.1-sonar-large-128k-online"],
    modelTypes: ["chat"],
    docs: "https://docs.litellm.ai/docs/providers/perplexity",
  },
];

module.exports = router;
