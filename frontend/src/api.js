const BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // Models
  listModels: () => request("GET", "/models"),
  getModel: (id) => request("GET", `/models/${id}`),
  createModel: (body) => request("POST", "/models", body),
  updateModel: (id, body) => request("PATCH", `/models/${id}`, body),
  deleteModel: (id) => request("DELETE", `/models/${id}`),
  // BUG FIX: accepts messages array (full conversation) not just a string prompt
  testModel: (id, messages) => request("POST", `/models/${id}/test`, {
    messages: Array.isArray(messages) ? messages : undefined,
    prompt: typeof messages === "string" ? messages : undefined,
  }),
  toggleModel: (id) => request("POST", `/models/${id}/toggle`),

  // Stats & info
  getStats: () => request("GET", "/stats"),
  getHealth: () => request("GET", "/health"),
  getProviders: () => request("GET", "/providers"),
};
