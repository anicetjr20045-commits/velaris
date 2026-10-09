# GUIDE COMPLET DE REPRISE TECHNIQUE (HANDOVER) — PROJET VELARIS

> Ce document fournit toutes les clés techniques, architecturales et opérationnelles nécessaires pour reprendre, exécuter, tester, modifier et déployer le moteur de vente et la plateforme Velaris.

---

## 1. VUE D'ENSEMBLE & MISSION DU SYSTÈME

**Velaris** est une plateforme studio et un moteur d'agent commercial automatisé sur WhatsApp dédié à la création et vente de **chansons personnalisées** en Afrique de l'Ouest (Burkina Faso `+226`, Côte d'Ivoire `+225`, et International).

### Le Parcours Commercial (Entonnoir Linéaire)
1. **Accueil & Découverte de l'occasion** : Anniversaire, mariage, déclaration d'amour, hommage...
2. **Collecte du Brief (3 Piliers)** :
   - Destinataire (prénom / nom)
   - Expéditeur (lien de parenté ou identité)
   - Date ou souvenirs / message d'amour à transmettre
3. **Note Vocale de Procédure** :
   - Présentation de la démarche studio via une note vocale officielle (`assets/procedure_voice.ogg`).
   - Envoyée strictement 1 seule fois par discussion.
4. **Présentation des Formules** :
   - **Découverte (1 200 F CFA)** : Chanson complète générée en 18 minutes.
   - **Prestige (3 000 F CFA)** : Chanson complète + montage vidéo souvenir avec photos.
   - Un extrait vidéo démo (`assets/montage_sample.mp4`) peut être transmis sur demande expresse (strictement 1 seule fois, avec garde contre les partages de liens TikTok/YouTube externes).
5. **Validation des Paroles (Lyrics)** :
   - Génération de paroles structurées (Couplets, Refrain, Pont) via le module `lyrics-composer`.
6. **Paiement Mobile Money** :
   - Côte d'Ivoire (+225) : exclusivement Wave (`+225...`).
   - Burkina Faso (+226) : exclusivement Orange Money (`+226...`).
   - Déclaré par le client, confirmé obligatoirement par le gérant ou webhook SasPay avant production finale.

---

## 2. TOPOLOGIE TECHNIQUE & STACK

| Composant | Technologie / Fournisseur | Rôle |
| :--- | :--- | :--- |
| **Backend / Moteur** | Node.js 22 (ESM Strict), TypeScript | Ingestion webhooks, machine à états, outbox |
| **Base de Données** | PostgreSQL 16 via Supabase | Tables relationnelles, RPCs transactionnels atomiques |
| **Connecteur WhatsApp** | WAHA (WhatsApp HTTP API, Chromium WEBJS) | Gestion des sessions WhatsApp (`Test` +22656240533) |
| **Cerveau Commercial** | DeepSeek Flash (`deepseek-v4-1-flash`) via Kie.ai | Génération de réponses courtes, typées et sans emoji |
| **Transcription Vocale** | Gemini 3.8 Flash Multimodal (`inlineData`) via Kie.ai | Transcription instantanée des notes vocales WhatsApp |
| **Reverse Proxy** | Caddy v2 (Docker Alpine) | Routage SSL automatique, HTTPS, reverse proxy WAHA/Engine |
| **Frontend Dashboard** | React 18, Vite, Tailwind CSS, Lucide | Interface commerçant, cockpit de gestion |

---

## 3. ARBORESCENCE DU REPOSITORY (`/root/projets/velaris`)

```
velaris/
├── engine/                       # Cœur du moteur commercial WhatsApp
│   ├── src/
│   │   ├── config.ts             # Chargement & validation stricte des variables d'environnement
│   │   ├── main.ts               # Point d'entrée serveur (serveur HTTP sur port 3001)
│   │   ├── ingest/
│   │   │   └── process-event.ts  # Réception et signature HMAC des webhooks WAHA
│   │   ├── queue/
│   │   │   ├── run-turn.ts       # Orchestrateur de tour de discussion (Turn Worker)
│   │   │   ├── outbox.ts         # Expédition régulée, délais humains, typing, garde silence
│   │   │   ├── clock.ts          # Horloges et fenêtres d'ouverture studio/gérant
│   │   │   └── render.ts         # Rendu des gabarits et messages médias
│   │   ├── llm/
│   │   │   ├── sales-brain.ts    # Prompt commercial VELARIS_CLOSING_PROMPT_TEMPLATE & déduplications
│   │   │   ├── deepseek.ts       # Client API DeepSeek / Kie.ai avec gestion d'erreurs
│   │   │   ├── provider.ts       # Interfaces LlmProvider et typages
│   │   │   └── json-guard.ts     # Nettoyage et extraction JSON stricte
│   │   ├── lyrics/
│   │   │   ├── composer.ts       # Compositeur de paroles selon les 4 occasions maîtresses
│   │   │   ├── corpus.ts         # Hits patrons étalons et contrôles qualité
│   │   │   └── occasions.ts      # Détection et invariants par occasion
│   │   └── services/
│   │       └── transcribe.ts     # AudioTranscriber : téléchargement WAHA et transcription Gemini
│   ├── test/                     # 170 tests unitaires complets (PGlite in-memory + Mocks)
│   ├── Dockerfile                # Image conteneur de production
│   └── tsconfig.json             # TypeScript strict avec verbatimModuleSyntax
├── supabase/                     # Migrations SQL Supabase
│   ├── migrations/
│   │   ├── 20261004_agent_core.sql               # Tables fondamentales, transitions commandes
│   │   ├── 20261006_agent_turn.sql               # Moteur de tours, contextes atomiques, locks
│   │   └── 20261008_transcribe_and_outbox.sql   # Support transcripts et outbox avancée
├── vps/                          # Fichiers de déploiement serveur
│   ├── docker-compose.yml        # Orchestration Docker (WAHA, velaris-engine, Caddy)
│   ├── Caddyfile                 # Configuration du proxy Caddy
│   └── env.example               # Modèle des variables d'environnement
├── ACTIVE_STATE.md               # Historique exhaustif de tous les jalons (1 à 109)
└── package.json                  # Scripts racine
```

---

## 4. FLUX D'EXÉCUTION D'UN TOUR DE CONVERSATION (LIFECYCLE)

1. **Ingestion (`process-event.ts`)** :
   - Le webhook WhatsApp arrive de WAHA avec signature `X-HMAC-Signature`.
   - Si le message émane du gérant (`source !== 'api'`), tous les messages sortants de l'IA en cours de frappe ou en attente sont **immédiatement annulés en base**.
   - Le message est inséré via la RPC PostgreSQL `agent_ingest_message`.
   - Si c'est une note vocale, `AudioTranscriber` la télécharge immédiatement et lance sa transcription via Gemini Flash.

2. **Tamponnage (Quiet Window)** :
   - Une fenêtre de temporisation de 4 secondes (`quiet_window_ms = 4000ms`) est observée pour concaténer les messages clients consécutifs en un seul bloc cohérent.

3. **Exécution du Tour (`run-turn.ts`)** :
   - `TurnWorker` réserve le tour de manière exclusive via un jeton de verrou (`lockToken`).
   - Vérification de l'état : si `control_mode === 'human'`, le tour est immédiatement clôturé sans réponse automatique (`human_control_no_relay`).
   - Appel de `generateSalesReply` ([`sales-brain.ts`](file:///root/projets/velaris/engine/src/llm/sales-brain.ts)) via DeepSeek Flash.
   - **Gardes appliquées** :
     - Vocal de procédure : envoyé strictly 1 fois par discussion.
     - Vidéo démo : neutralisée si le client a partagé son propre lien TikTok/YouTube, et strictly 1 fois par discussion.
     - Choix de formule : alerte enrichie envoyée au gérant dès que le client choisit Découverte ou Prestige.
   - Les messages générés sont enregistrés dans la table `agent_outbox` avec statut `pending`.

4. **Expédition Régulée (`outbox.ts`)** :
   - `OutboxSender` prend les messages un par un.
   - Il active le statut de frappe sur WhatsApp (`waha.typing`) pendant un délai humain réaliste (1,5s à 4s).
   - **Bouclier Anti-Interférence Gérant** : Dès la fin du délai et avant tout appel `waha.send()`, il revérifie l'état en base. Si le message a été annulé ou si le gérant est intervenu entre-temps sur son téléphone, l'envoi est abandonné net et l'indicateur de frappe est éteint.

---

## 5. DÉVELOPPEMENT LOCAL & EXÉCUTION DES TESTS

### Pré-requis
- Node.js >= 22
- npm

### Installation & Lancement des tests
```bash
cd /root/projets/velaris/engine
npm install

# Exécuter l'intégralité de la suite de tests (170 tests, 30 suites)
npm test

# Compiler TypeScript vers dist/
npm run build
```

La suite de tests tourne sur **PGlite** (PostgreSQL in-process sans dépendance externe) et valide :
- La machine à états et les 36 transitions de commande.
- Les signatures HMAC et la désérialisation JSON stricte.
- Le mock DeepSeek et la détection d'intention.
- Les gardes anti-doublon et la neutralisation des vidéos externes.
- Le silence post-délai et l'interruption prioritaire gérant.
- La transcription des vocaux.

---

## 6. DÉPLOIEMENT EN PRODUCTION (VPS CONTABO)

Le serveur de production est hébergé sur :
- **IP VPS** : `162.35.113.220` (root)
- **Répertoire de déploiement** : `/root/waha-vps-setup`

### Procédure de Déploiement en 3 Commandes :
```bash
# 1. Compiler localement
cd /root/projets/velaris/engine
npm run build

# 2. Transférer le dossier dist vers le VPS
scp -r dist/* root@162.35.113.220:/root/waha-vps-setup/velaris-engine/dist/

# 3. Rebuilder et relancer le conteneur Docker sur le VPS
ssh root@162.35.113.220 "cd /root/waha-vps-setup && docker build -t velaris-engine:latest ./velaris-engine && docker compose up -d velaris-engine"
```

### Vérifier la Santé du Moteur en Production
```bash
# Consulter les logs en temps réel
ssh root@162.35.113.220 "docker logs -f --tail 50 velaris-engine"

# Vérifier les sessions WAHA actives
ssh root@162.35.113.220 "curl -s -H 'X-Api-Key: b4cffb1ef75fb400a79e30faa3a97802' http://127.0.0.1:3000/api/sessions?all=true"
```

---

## 7. GESTION DES SESSIONS WHATSAPP (RÈGLES CRITIQUES)

Le serveur WAHA héberge actuellement deux sessions WhatsApp distinctes :
1. **Session `"Test"` (`+22656240533`)** :
   - Session active de l'agent commercial Velaris.
   - Reçoit les webhooks et dialogue avec les clients.
2. **Session `"anicet2"` (`+22658357772`)** :
   - Session personnelle ou dédiée à un autre flux.
   - **Protection Absolue** : La variable `WAHA_PROTECTED_SESSIONS=anicet2` interdit formellement au moteur d'envoyer le moindre message sur cette session.

---

## 8. SYNCHRONISATION DES DÉPÔTS GITHUB

Toutes les modifications du projet sont synchronisées sur GitHub :

| Projet | Répertoire Local | Dépôt GitHub | Branche Active |
| :--- | :--- | :--- | :--- |
| **Velaris Plateforme & Moteur** | `/root/projets/velaris` | `https://github.com/anicetjr20045-commits/velaris.git` | `main` |
| **Velaris Agent (Playground)** | `/root/projets/velaris-agent` | `https://github.com/anicetjr20045-commits/digital-agent-ai.git` | `main` & `lovable-sync` |
| **Velaris Partners** | `/root/projets/velarisse/code` | Synchronisation Lovable | `main` |

---

## 9. FICHIER D'ÉTAT DÉTAILLÉ (`ACTIVE_STATE.md`)

Pour comprendre l'historique complet des 109 étapes et les décisions prises à chaque bug résolu, consultez [`ACTIVE_STATE.md`](file:///root/projets/velaris/ACTIVE_STATE.md). Il détaille chaque jalon, les corrections apportées, les RPC PostgreSQL créées, et les audits de code réalisés.
