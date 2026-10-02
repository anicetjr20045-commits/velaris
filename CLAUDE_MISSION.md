# MISSION GLOBALE VELARIS — OVERHAUL COMPLET PAR CLAUDE OPUS 5.5

## Ordre de mission de l'utilisateur

L'utilisateur demande à Claude Code (Opus 5.5) de repasser sur l'intégralité du projet Velaris (`/root/projets/velaris`), d'analyser, de corriger, de perfectionner et de consolider tous les aspects.

---

### 1. Design Intérieur & Élimination Stricte des Émojis UI
- Repasser sur tous les composants intérieurs (`src/components/`).
- **Règle absolue** : Aucun émoji (`💰`, `⏱️`, `🎤`, `💳`, `⚡`, `🎵`, etc.) dans les boutons, cartes, en-têtes, puces ou labels UI. Remplacer par des icônes SVG fines (`lucide-react`, 14-16px) ou une numérotation typographique sobre (`01`, `02`).
  - *Note* : Les émojis utilisés comme données de déclencheurs WhatsApp reçus (`trigger_content`) peuvent être conservés en tant que chaînes de caractères de données, mais l'interface visuelle (boutons, sélecteurs, labels) doit utiliser des icônes et du texte sobre.
- Harmoniser le Design System selon les règles : Univers sombre graphite luxueux (`#050608`, `#08090C`, `#0E1015`), bordures architecturales discrètes (`border-white/[0.08]`), cartes glassmorphismes précises, chiffres tabulaires monospace.

### 2. Intelligence de l'Agent IA & Copilot Studio
- Analyser et optimiser [`src/services/copilot.ts`](file:///root/projets/velaris/src/services/copilot.ts) et [`src/components/StudioCopilotView.tsx`](file:///root/projets/velaris/src/components/StudioCopilotView.tsx).
- Rendre le système de génération de paroles poétiques, de briefs et d'orchestration de chansons plus intelligent, robuste et cohérent.

### 3. Connexion VPS <-> WAHA <-> Plateforme <-> WhatsApp (Haute Disponibilité)
- Analyser et stabiliser toute la chaîne de connexion :
  - [`src/services/waha.ts`](file:///root/projets/velaris/src/services/waha.ts)
  - [`src/hooks/useWaha.ts`](file:///root/projets/velaris/src/hooks/useWaha.ts)
  - [`src/components/QrConnectModal.tsx`](file:///root/projets/velaris/src/components/QrConnectModal.tsx)
  - [`src/components/WhatsAppLinesView.tsx`](file:///root/projets/velaris/src/components/WhatsAppLinesView.tsx)
- S'assurer que la synchronisation WhatsApp (messages entrants, sortants, statuts lu/non lu, reconnexion automatique en cas de déconnexion WAHA) supporte une charge importante de clients sans plantage ni désynchronisation.
- Vérifier la gestion de la session préservée `anicet2` (ne jamais la perturber).

### 4. Moteur d'Automatisations Robuste
- Analyser [`src/services/automation.ts`](file:///root/projets/velaris/src/services/automation.ts), [`src/services/songAutomation.ts`](file:///root/projets/velaris/src/services/songAutomation.ts) et [`src/components/AutomationsView.tsx`](file:///root/projets/velaris/src/components/AutomationsView.tsx).
- S'assurer que le routage et le déclenchement des automatisations (texte, audio/note vocale, vidéo, réaction emoji `🎵`) fonctionnent de manière infaillible même sous grand volume de messages simultanés.

### 5. Paiements SasPay, Webhooks & Kie.ai
- Analyser et auditer l'implémentation de SasPay ([`src/services/saspay.ts`](file:///root/projets/velaris/src/services/saspay.ts), `supabase/functions/saspay-webhook/index.ts`) :
  - Abonnements récurrents : 3 000 F CFA / mois et 7 000 F CFA / 3 mois.
  - Rechargement de crédits en paiement libre (taux : 1 crédit = 85 F CFA).
  - Contrôle cryptographique anti-fraude (HMAC-SHA256, tolérance d'âge 300s).
- Analyser l'intégration Kie.ai ([`src/services/kie.ts`](file:///root/projets/velaris/src/services/kie.ts)) et la facturation des crédits ([`src/services/billing.ts`](file:///root/projets/velaris/src/services/billing.ts)). Corriger toute faille de sécurité ou d'exposition de clés dans le bundle client si nécessaire.

### 6. Base de Données Supabase & Protection des Quotas
- Analyser les tables, politiques RLS et requêtes dans [`supabase_stabilization_production.sql`](file:///root/projets/velaris/supabase_stabilization_production.sql) et le hook live [`src/hooks/useStudioLive.ts`](file:///root/projets/velaris/src/hooks/useStudioLive.ts).
- Corriger toute anomalie pouvant provoquer des requêtes infinies, des fuites de mémoire ou l'épuisement des quotas gratuits Supabase.

### 7. Reconstruction Complète de la Console Administrateur
- Reconstruire [`src/components/AdminConsoleView.tsx`](file:///root/projets/velaris/src/components/AdminConsoleView.tsx) pour en faire un tableau de bord de direction professionnel :
  - Métriques complètes : MRR récurrent, chiffre d'affaires cumulé, crédits vendus vs consommés, taux de conversion des briefs en chansons.
  - Télémétrie en temps réel de tous les sous-systèmes (WAHA, Supabase, SasPay, Kie.ai).
  - Gestion des utilisateurs et audit des transactions financières.
  - Journal des événements et des erreurs système.
  - Design architectural d'élite (Linear / Stripe), sans aucun emoji, micro-bordures et graphiques épurés.

### 8. Étude Technique Spéciale : Agent IA Autonome sur WhatsApp pour Chaque Utilisateur
- Répondre de manière approfondie et pragmatique à la question de l'utilisateur :
  *« Est-ce techniquement possible et faisable que chaque utilisateur ait son propre agent IA qui répond directement à ses clients sur WhatsApp (répondre aux questions, savoir quand s'arrêter, passer la main à l'humain, connaître toutes les règles sans s'embrouiller) ? Pourquoi les tentatives précédentes basées sur une accumulation de règles ont échoué, et quelle est l'architecture exacte recommandée pour réussir ? »*
- Fournir les recommandations architecturales précises (State Machine / FSM, Intent Routing, Tool Calling, Human-in-the-loop handover, structured order state, garde-fous).

---

## Instructions d'Exécution
1. Procède aux vérifications et corrections de code directement dans le repo `/root/projets/velaris`.
2. Compile avec `npm run build` et `tsc -p tsconfig.app.json --noEmit` pour t'assurer de zéro régression.
3. Rédige un rapport complet d'analyse, des corrections apportées et l'étude technique dans un fichier `RAPPORT_CLAUDE_OPUS.md`.
