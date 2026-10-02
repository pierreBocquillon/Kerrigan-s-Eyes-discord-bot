// Kerrigan's Eyes integration settings (all optional: without KE_URL the integration is disabled).

const bool = (v, def) => (v === undefined || v === '' ? def : !['0', 'false', 'no', 'off'].includes(String(v).toLowerCase()))

// a full URL is accepted too (https://bot.example.com/webhooks/ke): only its path matters to the bot
function webhookPath (value) {
  const v = (value || '').trim()
  if (!v) return '/webhooks/ke'
  try {
    return new URL(v).pathname || '/webhooks/ke'
  } catch {
    return v.startsWith('/') ? v : `/${v}`
  }
}

function loadConfig (env = process.env) {
  const url = (env.KE_URL || '').trim()
  return {
    enabled: !!url && bool(env.KE_ENABLED, true),
    url,
    // address of the KE interface seen from a browser ("Open in KE" links), KE_URL by default
    publicUrl: (env.KE_PUBLIC_URL || url).trim().replace(/\/+$/, ''),
    username: env.KE_USERNAME || '',
    password: env.KE_PASSWORD || '',
    token: env.KE_SESSION_TOKEN || '',
    channelId: env.KE_CHANNEL_ID || '',
    // webhook called by KE (Settings > Webhooks): path on the bot's HTTP server and shared secret
    webhookPath: webhookPath(env.KE_WEBHOOK_PATH),
    webhookSecret: env.KE_WEBHOOK_SECRET || '',
    roleId: env.KE_ROLE_ID || ''
  }
}

module.exports = { loadConfig }
