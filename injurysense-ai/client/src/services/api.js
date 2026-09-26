const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function apiRequest(path, options = {}) {
  try {
    if (window.location.protocol === 'file:' && API_URL === '/api') {
      throw new Error('BACKEND REQUIRED: This feature is unavailable in offline mode')
    }
    let token
    try { token = JSON.parse(localStorage.getItem('injurysenseUser') || 'null')?.token } catch {}
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || response.statusText || 'Request failed')
    window.dispatchEvent(new CustomEvent('injurysense:api-status', { detail: { available: true } }))
    return payload
  } catch (error) {
    window.dispatchEvent(new CustomEvent('injurysense:api-status', { detail: { available: false } }))
    if (error instanceof TypeError) throw new Error('BACKEND REQUIRED: This feature is unavailable in offline mode')
    throw error
  }
}

export async function safeApiRequest(path, options = {}) {
  try { return await apiRequest(path, options) }
  catch (error) {
    console.warn('API unavailable:', error)
    return null
  }
}

export { API_URL }
