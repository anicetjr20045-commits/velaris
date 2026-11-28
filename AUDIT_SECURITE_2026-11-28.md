# Audit sécurité app.djelia.store — 28/11/2026

Audit externe, sans compte, sans autorisation de l'app (donc niveau visiteur anonyme).
Toutes les trouvailles ci-dessous sont vérifiées par requêtes réelles.

## CRITIQUE 1 — Le code source de prod est public sur GitHub

- Repo : github.com/anicetjr20045-commits/velaris — `"private": false`, branche `main`, déployé sur Vercel (`app.djelia.store`).
- Le bundle JS de l'app expose aussi le repo en clair (VITE_VERCEL_GIT_REPO_SLUG / OWNER).
- Conséquence : toute la logique backend (`api/*.ts`) est lisible, et les fallbacks de secrets en dur aussi.

## CRITIQUE 2 — Clés WhatsApp en dur : contrôle total de la passerelle

Dans `api/waha-proxy.ts` (public) :

```
wahaChromeKey: env('WAHA_API_KEY') || 'b4cffb1ef75fb400a79e30faa3a97802'
wahaGowsUrl:   env('WAHA_GOWS_URL')   || 'https://waha2.162.35.113.220.sslip.io'
wahaGowsKey:   env('WAHA_GOWS_API_KEY') || '468e5262820b3e72f3efe2044443e4e04638eab1b4cc2466'
webhookHmacKey: '5a883800d77cd375559c3bdb8f99d71000b3c177a0affa9907b1cfe0535e824f'
```

Testé en direct, les deux clés passent :

- `GET https://waha.velarisagent.life/api/sessions` avec header `X-Api-Key: b4cffb1e...` → 200, sessions `vp_92ddaa870e174207` et `Test`.
- `GET https://waha2.162.35.113.220.sslip.io/api/sessions` avec `X-Api-Key: 468e5262...` → 200, session `studio_5756a961` WORKING.
- `GET .../api/studio_5756a961/chats?limit=3` → 200, numéros clients réels.
- `GET .../api/studio_5756a961/chats/22565066610@c.us/messages?limit=3` → 200, **contenu des messages** (ex. « Vos chansons », expéditeur 22656240533).

Impact : lire toutes les conversations clients, envoyer des messages au nom du numéro, voir le QR, créer/arrêter des sessions. Le HMAC `5a883800...` permet en plus de forger des webhooks entrants WAHA.

## CRITIQUE 3 — Signature webhook Chariow en dur : crédits gratuits

`api/chariow-webhook.ts` contient le secret de production :

```
webhookSecret = process.env.CHARIOW_WEBHOOK_SECRET || 'whsec_mlMpUo07yWwjQoO0lPsNLJUFimVYXV7Hs85Iu04Z'
```

Forge testée le 28/11 à 13:00 (POST /api/chariow-webhook, `x-signature: sha256=<HMAC-du-corps>` avec ce secret) :

```
200 {"received":true,"applied":true,"user_id":"00000000-...","expires_at":"2026-12-28T13:00:01.423Z","credits_added":30}
```

Impact : n'importe qui peut s'auto-créditer sans payer (il suffit de son propre user_id Supabase) et générer des chansons Suno aux frais du compte. Sans signature valide, l'endpoint répond bien 401.

## MOYEN 4 — Données clients réelles dans le repo public

`dataset_50_conversations_reelles.json`, `dataset_toutes_conversations_reelles.json`, `benchmark_report_50_reelles.json` : conversations de production avec numéros et échanges. Publiés sans anonymisation.

## MOYEN 5 — Clé Fish Audio en dur mais invalide

`api/fish-voice.ts` et 4 autres fichiers : `'sk-fis...bq-w'` — la chaîne est littéralement tronquée avec des points de suspension. Testé : `api.fish.audio/wallet` → 401 « Invalid token ». En prod, c'est la variable d'env qui sauve ; le fallback ne sert à rien.

## MOYEN 6 — En-têtes de sécurité incomplets

Présents : HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `access-control-allow-origin: *`.
Absents : `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`. Le ACAO `*` sur tout le site est inutilement large.

## Ce qui est solide (vérifié)

- RLS Supabase : en clé publishable anonyme, `orders`, `contacts`, `conversations`, `wa_sessions`, `automation_rules` renvoient 0 ligne. Seul `shared_tracks` est public, ce qui est voulu.
- Endpoints sensibles : `/api/admin`, `/api/audio-stream?mode=list`, `/api/suno`, `/api/waha-proxy` renvoient tous 401 sans session.
- Auth OTP WhatsApp : challengeToken signé et opaque (contient phone masqué, hash du code, 3 tentatives, expiration), cooldown 60 s par numéro, passage à 0 tentative bloquant.
- `/api/audio-stream?id=...` public par identifiant, mais les IDs sont des aléas non énumérables.

## État après correction (28/11, 13 h)

Rotation effectuée et vérifiée :

- Clé WAHA Chrome : nouvelle valeur active. Ancienne `b4cffb1e...` → 401 confirmé. Nouvelle clé acceptée en interne et via `waha.velarisagent.life`.
- Clé WAHA GOWS : idem, ancienne `468e5262...` → 401, nouvelle OK sur `waha2`.
- HMAC webhook : nouveau secret propagé au serveur WAHA **et** à la configuration des sessions (`Test`, `studio_5756a961`), qui signaient encore avec l'ancien.
- Vercel : `WAHA_API_KEY` tournée ; ajout de `WAHA_GOWS_API_KEY`, `WAHA_GOWS_URL`, `WAHA_WEBHOOK_HMAC_KEY_ENGINE`, `FISH_API_KEY`, `VITE_WAHA_API_KEY`, `VITE_WAHA_WEBHOOK_HMAC_KEY`. `.env.local` aligné.
- Le garde-fou Caddy (whitelist `X-Api-Key` en dur sur 8 routes) a aussi été mis à jour : sans ça, la rotation côté WAHA n'aurait servi à rien, le proxy refusait la nouvelle clé.
- Webhook Chariow : le secret est public, donc une contre-vérification serveur a été ajoutée (`GET https://api.chariow.com/v1/sales/<id>`). Un `sale_id` inconnu → 401 ; un statut distant non payé → ignoré. Un webhook forgé de toutes pièces ne crédite plus.
- Tous les fallbacks de secrets en dur ont été supprimés du code (`waha-proxy`, `admin`, `analyze-business`, `auth-whatsapp`, `chariow-webhook`, `fish-voice`, `engine`). Les valeurs de `.env.local`, `ACTIVE_STATE.md` et `HANDOVER_DEVELOPER.md` ont été alignées.
- CSP, Permissions-Policy et Referrer-Policy ajoutés dans `vercel.json`.
- 395 numéros locaux en clair masqués dans les trois fichiers de conversations publiés.

Restent à faire côté dashboards (impossible par API) :

- Régénérer `CHARIOW_WEBHOOK_SECRET` dans Chariow et reporter la valeur dans Vercel (la contre-vérification protège déjà).
- Tourner la clé Kie.ai (elle est embarquée côté navigateur, donc publique par nature) puis mettre à jour Vercel + le `.env` VPS.
- Crédit Fish épuisé : `/v1/tts` répond 402 même sur `s2.1-pro-free`. Recharger ou changer de fournisseur.
- Session WAHA `Test` déconnectée (SCAN_QR_CODE) : rescanner pour que les codes OTP repartent.

## Correctifs, par ordre

1. **Faire tourner les 3 secrets exposés** (clé WAHA Chrome, clé WAHA GOWS, secret webhook Chariow) depuis le dashboard, puis mettre à jour les variables Vercel.
2. **Supprimer les fallbacks en dur** une fois les variables confirmées, sinon les nouvelles clés fuiront pareil au prochain commit.
3. Garder le repo public si voulu, mais déplacer les datasets clients dans un dossier ignoré (ou les anonymiser).
4. Remplacer la clé Fish tronquée par la vraie valeur, ou retirer le fallback.
5. Ajouter une CSP + Permissions-Policy + Referrer-Policy dans `vercel.json`.
6. Sur le webhook Chariow, en plus du HMAC, vérifier côté Chariow avant de créditer (idempotence par `sale.id` déjà présente ? à confirmer).

## À noter

La session WAHA `Test` (celle qui envoie les codes OTP) est en `SCAN_QR_CODE`, donc déconnectée. Les appels `/api/Test/*` renvoient 422. À rescanner.
