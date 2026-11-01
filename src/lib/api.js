// Small wrapper for the /api serverless functions.
// Every endpoint returns { ok: true, data } or { ok: false, error }.
export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const body = await res.json().catch(() => ({ ok: false, error: 'BAD_RESPONSE' }))
  if (!res.ok && body.ok !== false) return { ok: false, error: `HTTP_${res.status}` }
  return body
}
