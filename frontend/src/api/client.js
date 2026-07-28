const TOKEN_KEY = 'tradeiq_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  listTrades: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/trades${qs ? `?${qs}` : ''}`);
  },
  createTrade: (payload) => request('/trades', { method: 'POST', body: payload }),
  updateTrade: (id, payload) => request(`/trades/${id}`, { method: 'PUT', body: payload }),
  deleteTrade: (id) => request(`/trades/${id}`, { method: 'DELETE' }),
  evaluateTrade: (draft) => request('/trades/evaluate', { method: 'POST', body: draft }),
  importTrades: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/trades/import', { method: 'POST', body: form, isForm: true });
  },

  dashboard: (period) => request(`/analytics/dashboard?period=${period}`),

  listRules: () => request('/rules'),
  createRule: (payload) => request('/rules', { method: 'POST', body: payload }),
  updateRule: (id, payload) => request(`/rules/${id}`, { method: 'PUT', body: payload }),
  deleteRule: (id) => request(`/rules/${id}`, { method: 'DELETE' }),
};

export { getToken, setToken };
