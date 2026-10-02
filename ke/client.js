// HTTP client of the Kerrigan's Eyes API (the bot signs in with a KE account, like the web interface).
// A "guest" account is enough: the lab state and the sessions are readable by guests.

const COOKIE = 'ke_session'

class KEError extends Error {
  constructor (status, detail) {
    super(detail || `HTTP ${status}`)
    this.status = status
    this.detail = detail
  }
}

class KEClient {
  constructor ({ baseUrl, username, password, token, timeoutMs = 20000 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.username = username
    this.password = password
    this.token = token || null
    this.staticToken = !!token
    this.timeoutMs = timeoutMs
    this._loggingIn = null
  }

  async login () {
    if (this.staticToken) return
    if (!this.username || !this.password) throw new Error('KE_USERNAME / KE_PASSWORD are not set')
    if (!this._loggingIn) {
      this._loggingIn = (async () => {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': 'KE-Discord-Bot' },
          body: JSON.stringify({ username: this.username, password: this.password }),
          signal: AbortSignal.timeout(this.timeoutMs)
        })
        if (!res.ok) throw new KEError(res.status, await detailOf(res))
        const cookies = typeof res.headers.getSetCookie === 'function'
          ? res.headers.getSetCookie()
          : [res.headers.get('set-cookie') || '']
        const found = cookies.map(c => c.match(new RegExp(`${COOKIE}=([^;]+)`))).find(Boolean)
        if (!found) throw new Error('KE sign-in: no session cookie in the answer')
        this.token = found[1]
      })().finally(() => { this._loggingIn = null })
    }
    return this._loggingIn
  }

  async _fetch (path, { timeoutMs } = {}, retry = true) {
    if (!this.token) await this.login()
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { cookie: `${COOKIE}=${this.token}`, 'user-agent': 'KE-Discord-Bot' },
      signal: AbortSignal.timeout(timeoutMs || this.timeoutMs)
    })
    if (res.status === 401 && retry && !this.staticToken) {
      this.token = null // session expired or revoked: sign in again, once
      return this._fetch(path, { timeoutMs }, false)
    }
    if (!res.ok) throw new KEError(res.status, await detailOf(res))
    return res
  }

  async json (path) {
    const res = await this._fetch(path)
    return res.json()
  }

  state () {
    return this.json('/api/state')
  }
}

async function detailOf (res) {
  try {
    const body = await res.json()
    return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
  } catch {
    return `HTTP ${res.status}`
  }
}

module.exports = { KEClient, KEError }
