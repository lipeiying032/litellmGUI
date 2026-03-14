const BASE = "/api";

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("HTTP " + res.status + " -- server returned: " + text.slice(0, 200));
  }

  if (!data.success) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  listModels: function() { return request("GET", "/models"); },
  getModel: function(id) { return request("GET", "/models/" + id); },
  createModel: function(body) { return request("POST", "/models", body); },
  updateModel: function(id, body) { return request("PATCH", "/models/" + id, body); },
  deleteModel: function(id) { return request("DELETE", "/models/" + id); },
  testModel: function(id, messages) {
    return request("POST", "/models/" + id + "/test", {
      messages: Array.isArray(messages) ? messages : undefined,
      prompt: typeof messages === "string" ? messages : undefined,
    });
  },
  toggleModel: function(id) { return request("POST", "/models/" + id + "/toggle"); },
  getStats: function() { return request("GET", "/stats"); },
  getHealth: function() { return request("GET", "/health"); },
  getProviders: function() { return request("GET", "/providers"); },
};