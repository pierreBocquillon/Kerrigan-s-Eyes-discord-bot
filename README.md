# Kerrigan's Eyes — bot Discord

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm%20Noncommercial%201.0.0-8b5cf6)](LICENSE)

Bot Discord de **Kerrigan's Eyes**. L'intégration est optionnelle : elle n'est active que si `KE_URL` est défini dans `.env`
(sinon le bot se connecte mais n'a aucune commande).

## Notifications (webhooks)

Kerrigan's Eyes **appelle le bot** quand quelque chose se passe : aucun sondage, aucune requête inutile.
Le bot reçoit les évènements sur `POST /webhooks/ke` (port `PORT`) et les poste dans le salon `KE_CHANNEL_ID` :

| Évènement KE | Message |
|---|---|
| `session.started` / `session.resumed` / `session.stopped` | ▶️ « Un duel vient d'être lancé : **Nom du duel** » (reprise, arrêt de la même façon) |
| `session.ended` | ✅ « Un training vient de se terminer : **Nom** » (⚠️ avec le nombre de games en échec) |
| `session.processed` | 🔬 « Analyses et rendus 2D terminés pour le duel **Nom** » |
| `bot.added` / `bot.version_added` | 🤖 « Un nouveau bot vient d'être ajouté : **Nom** » / 🆕 nouvelle version |
| `map.added` | 🗺️ « Une nouvelle map vient d'être ajoutée : **Nom** » |
| `lab.recap` (récap planifié dans KE : jours + heures, ex. samedi 17h30 et lundi 9h, ou tous les jours) | 🗞️ un message « État du labo », puis une carte par session (en cours + 5 dernières terminées) |
| `ping` (bouton *Test* dans KE) | 🔗 Webhook connecté |

Chaque appel est signé (`X-KE-Signature` = HMAC-SHA256 de `timestamp.corps` avec le secret) : le bot refuse
tout appel non signé ou trop ancien (> 5 min). Si Discord échoue, le bot répond une erreur et KE réessaie.

## Commandes

- `/status` — games en cours, analyses et rendus 2D (en cours / en attente), CPU, RAM, débit.
- `/sessions` (alias `/campaigns`) — une carte par session : statut, avancement, finies / en échec / en cours / en file,
  5 cartes par message (plusieurs messages si besoin). Options : `filtre`, `limite`, `id`.

Ces commandes lisent l'API de KE au moment où elles sont lancées, avec le compte `KE_USERNAME` (un compte **guest** suffit).

## Mise en place

1. `.env` (voir `.env.example`) : `KE_URL`, `KE_PUBLIC_URL`, `KE_USERNAME`, `KE_PASSWORD`, `KE_CHANNEL_ID`.
2. Lance le bot : `docker compose up --build -d`. Son port `PORT` doit être joignable par le serveur de KE.
3. Dans KE : **Settings > Webhooks > Add a webhook**, URL `http(s)://<adresse du bot>:<PORT>/webhooks/ke`.
4. Copie le secret affiché par KE dans `KE_WEBHOOK_SECRET` (`.env`), puis redémarre le bot.
5. Bouton **Test** (▶) dans KE : le message « Webhook connecté » doit apparaître dans le salon.

Si le bot et KE tournent sur la même machine en Docker, l'URL peut être `http://host.docker.internal:<PORT>/webhooks/ke`
(ou le nom du conteneur du bot si les deux sont sur le même réseau Docker).

## Licence

© 2026 T&T. Tous droits réservés. Sous licence [PolyForm Noncommercial License 1.0.0](LICENSE) (la même que Kerrigan's Eyes) :
utilisation, modification et partage autorisés **pour tout usage non commercial**. **Tout usage commercial nécessite une licence séparée de T&T.**
