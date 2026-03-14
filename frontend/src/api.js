// VITE_API_BASE is always /api in both Docker Compose and HF Spaces.
// Avoid import.meta.env here to prevent vite:define esbuild transform errors.
const BASE = (typeof import.meta !== ‘undefined’ && import.meta.env && import.meta.env.VITE_API_BASE)
? import.meta.env.VITE_API_BASE
: ‘/api’;

async function request(method, path, body) {
let res;
try {
res = await fetch(`${BASE}${path}`, {
method,
headers: { ‘Content-Type’: ‘application/json’ },
body: body ? JSON.stringify(body) : undefined,
});
} catch (networkErr) {
throw new Error(‘Network error – check your connection and try again.’);
}

let data;
try {
data = await res.json();
} catch (_parseErr) {
if (res.status === 502 || res.status === 503 || res.status === 504) {
throw new Error(
’Service unavailable (HTTP ’ + res.status + ’). ’ +
‘The gateway may still be starting – please wait 1-2 minutes and try again.’
);
}
throw new Error(
’Unexpected server response (HTTP ’ + res.status + ‘). Please try again shortly.’
);
}

if (!data.success) throw new Error(data.error || ‘Request failed’);
return data;
}

export const api = {
listModels: () => request(‘GET’, ‘/models’),
getModel: (id) => request(‘GET’, `/models/${id}`),
createModel: (body) => request(‘POST’, ‘/models’, body),
updateModel: (id, body) => request(‘PATCH’, `/models/${id}`, body),
deleteModel: (id) => request(‘DELETE’, `/models/${id}`),
testModel: (id, messages) => request(‘POST’, `/models/${id}/test`, {
messages: Array.isArray(messages) ? messages : undefined,
prompt: typeof messages === ‘string’ ? messages : undefined,
}),
toggleModel: (id) => request(‘POST’, `/models/${id}/toggle`),
getStats: () => request(‘GET’, ‘/stats’),
getHealth: () => request(‘GET’, ‘/health’),
getProviders: () => request(‘GET’, ‘/providers’),
};