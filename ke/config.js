// Configuration de l'intégration Kerrigan's Eyes (tout est optionnel : sans KE_URL, l'intégration est désactivée).

const bool = (v, def) => (v === undefined || v === '' ? def : !['0', 'false', 'no', 'off'].includes(String(v).toLowerCase()))

// accepte aussi une URL complète (https://bot.example.com/webhooks/ke) : seul le chemin compte pour le bot
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
    // adresse de l'interface KE vue depuis un navigateur (liens "Ouvrir dans KE"), par défaut KE_URL
    publicUrl: (env.KE_PUBLIC_URL || url).trim().replace(/\/+$/, ''),
    username: env.KE_USERNAME || '',
    password: env.KE_PASSWORD || '',
    token: env.KE_SESSION_TOKEN || '',
    channelId: env.KE_CHANNEL_ID || '',
    // webhook appelé par KE (Settings > Webhooks) : chemin sur le serveur HTTP du bot et secret partagé
    webhookPath: webhookPath(env.KE_WEBHOOK_PATH),
    webhookSecret: env.KE_WEBHOOK_SECRET || '',
    roleId: env.KE_ROLE_ID || ''
  }
}

module.exports = { loadConfig }
