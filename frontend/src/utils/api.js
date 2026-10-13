const DEFAULT_API_BASE = 'http://localhost:4000/api';

export function createApi({
  baseUrl = DEFAULT_API_BASE,
  getToken = () => null,
} = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    };

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.message) message = data.message;
      } catch {
        // ignore JSON parse errors
      }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }

    // Some endpoints return no JSON; keep safe.
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  return {
    request,
  };
}

export function toQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

