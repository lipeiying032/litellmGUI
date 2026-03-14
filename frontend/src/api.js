const BASE = import.meta.env.VITE_API_BASE || “/api”;

async function request(method, path, body) {
let res;
try {
res = await fetch(`${BASE}${path}`, {
method,
headers: { “Content-Type”: “application/json” },
body: body ? JSON.stringify(body) : undefined,
});
} catch (networkErr) {
// fetch() itself failed (no network, CORS, etc.)
throw new Error(“Network error – check your connection and try again.”);
}

// Try to parse JSON. If the server returns an HTML error page (e.g. nginx
// 502 while the backend is still starting), res.json() throws. In Safari on
// iOS this error reads “The string did not match the expected pattern” which
// is completely opaque to the user. We catch it and return a clear message.
let data;
try {
data = await res.json();
} catch (_parseErr) {
// Non-JSON response – likely nginx gateway error or service not ready yet
if (res.status === 502 || res.status === 503 || res.status === 504) {
throw new Error(
`Service unavailable (HTTP ${res.status}). ` +
“The gateway may still be starting up – please wait 1-2 minutes and try again.”
);
}
throw new Error(
`Unexpected response from server (HTTP ${res.status}). ` +
“The service may still be starting up – please try again shortly.”
);
}

if (!data.success) throw new Error(data.error || “Request failed”);
return data;
}

export const api = {
// Models
listModels: () => request(“GET”, “/models”),
getModel: (id) => request(“GET”, `/models/${id}`),
createModel: (body) => request(“POST”, “/models”, body),
updateModel: (id, body) => request(“PATCH”, `/models/${id}`, body),
deleteModel: (id) => request(“DELETE”, `/models/${id}`),
// BUG FIX: accepts messages array (full conversation) not just a string prompt
testModel: (id, messages) => request(“POST”, `/models/${id}/test`, {
messages: Array.isArray(messages) ? messages : undefined,
prompt: typeof messages === “string” ? messages : undefined,
}),
toggleModel: (id) => request(“POST”, `/models/${id}/toggle`),

// Stats & info
getStats: () => request(“GET”, “/stats”),
getHealth: () => request(“GET”, “/health”),
getProviders: () => request(“GET”, “/providers”),
};