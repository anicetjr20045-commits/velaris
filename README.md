# 🎵 Velaris — Académie & Studio OS de Chansons Personnalisées sur WhatsApp

> **La Première Académie & Suite Logicielle Tout-en-Un** permettant à des créateurs et entrepreneurs de lancer leur propre **Studio de Chansons Personnalisées sur WhatsApp**.

---

## 🌐 Liens Utiles & Production

- **Site en Production (GitHub Pages)** : [https://anicetjr20045-commits.github.io/velaris/](https://anicetjr20045-commits.github.io/velaris/)
- **Accès Direct Studio OS & Copilot** : [https://anicetjr20045-commits.github.io/velaris/#copilot](https://anicetjr20045-commits.github.io/velaris/#copilot)
- **Spécification du Design System Intérieur** : [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)
- **État Actif & Journal de Suivi** : [`ACTIVE_STATE.md`](./ACTIVE_STATE.md)

---

## 💎 Fonctionnalités Clés

### 1. L'Académie du Studio (Former)
- **Module 1** : Fondations du Studio & Grille Tarifaire (1 200 F / 3 000 F / 5 000 F).
- **Module 2** : Acquisition Publicitaire Rentable (Meta & TikTok Ads dès 5 000 F CFA).
- **Module 3** : Psychologie du Closing WhatsApp & Scripts mot-à-mot.
- **Module 4** : Production Musicale Suno IA & Livraison en 18 minutes.

### 2. La Suite Logicielle Studio OS (Outiller & Automatiser)
- **Cockpit Télémétrique** : Suivi des ventes, CA total, commandes en production et taux de closing en temps réel.
- **Atelier de Production** : Transcription des notes vocales WhatsApp, composition poétique des paroles, lecteur d'ondes sonores et boutons maîtres de production.
- **Analyste & Copilot IA** : Assistant d'entreprise multi-outils connecté à Supabase en direct (recall de conversations, synthèse de briefs, rédaction et envoi direct de messages WhatsApp en 1 clic).
- **Discussions WhatsApp Dual-Pane** : Messagerie unifiée connectée à l'API WAHA avec snippets de closing rapide.
- **Kanban Pipeline Clients** : Entonnoir automatisé en 4 étapes de prospect à livraison.
- **Caisse & Trésorerie** : Journal des encaissements directs Wave et Orange Money avec export CSV.

### 3. Architecture Multi-Tenant & Sécurité RLS
- **Isolation Totale des Données** : Politiques PostgreSQL Row Level Security (RLS) garantissant que chaque studio ne voit et ne manipule que ses propres données privées.
- **Ligne WhatsApp Dédiée** : Chaque studio dispose de sa session WAHA dédiée (`studio_<id>`) avec QR code privé.
- **Anti-Déconnexion Matérielle** : Configuration `noweb.markOnline: false` et reprise automatique des flux sans conflit avec le smartphone.

---

## 🎨 Design System (Standards Linear, Stripe, Apple)

L'ensemble de l'interface intérieure applique les directives d'artisanat d'élite :
- **Zéro Émoji** : Purge intégrale de tout émoji dans l'interface, remplacés par des icônes SVG vectorielles fines (Lucide 14-16px).
- **Graphite Sombre Architectural** : Fonds `#050608`, surfaces `#07080B`, éléments surélevés `#0D0F14` et micro-bordures `border-white/[0.06]`.
- **Télémétrie Monospace** : Toutes les données financières, temporelles et d'encaissement formatées en police monospace tabulaire.
- Pour plus de détails, consulter [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

---

## 🛠️ Stack Technique

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, Lucide React
- **Base de Données & Auth** : Supabase PostgreSQL avec RLS multi-tenant
- **Passerelle WhatsApp** : WAHA (WhatsApp HTTP API) déployée sur VPS avec `waha-bridge` Node.js
- **Audio Engine** : Suno IA & Web Audio API

---

## 🚀 Commandes de Développement

```bash
# Installation des dépendances
npm install

# Lancement du serveur local
npm run dev

# Vérification du typage et build de production
npm run build
```
